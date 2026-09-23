"use client";

import { Capacitor } from "@capacitor/core";
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import {
  OFFERING_PACKAGE_ORDER,
  PRO_ENTITLEMENT_ID,
  REVENUECAT_ANDROID_PUBLIC_KEY,
  REVENUECAT_IOS_PUBLIC_KEY,
} from "@/lib/revenuecat-config";

export { PRO_ENTITLEMENT_ID };

/**
 * Тонкая обёртка над SDK магазина. Всё, что ниже, живёт ТОЛЬКО внутри
 * приложения: в браузере каждая функция возвращает «ничего» первой же
 * строкой.
 *
 * ПЛАГИН ГРУЗИТСЯ ЛЕНИВО — `await import(...)`, а не обычный импорт.
 * Причина числом: этот модуль читает клиентский компонент экрана покупки,
 * а обычный импорт положил бы код плагина в общий пакет, который качает
 * КАЖДЫЙ посетитель сайта в браузере, где покупки нет вовсе.
 *
 * ВИТРИНА RevenueCat UI ЗДЕСЬ НЕ ЗОВЁТСЯ. До 7.224 отсюда вызывался
 * `RevenueCatUI.presentPaywall()` — экран, нарисованный в консоли
 * RevenueCat. Он не нарисован там ни разу, и звать его значило бы
 * повторить долг 179: кнопку, которая молча не делает ничего.
 */

/* ------------------------------------------------------------------ *
 * ДВЕ ПРИЧИНЫ, ПО КОТОРЫМ ЭТОТ ФАЙЛ ПЕРЕПИСАН В 7.225
 * ------------------------------------------------------------------ */

/**
 * ПРИЧИНА ПЕРВАЯ — `Purchases` ЭТО THENABLE, И `return mod.Purchases` ИЗ
 * `async`-ФУНКЦИИ ВЕШАЛ ПОКУПКУ НАВСЕГДА.
 *
 * Дефект, снятый владельцем с телефона 23.09.2026: экран покупки вечно
 * показывал «Загружаем варианты…», ошибки не было, и в RevenueCat не
 * появилось НИ ОДНОГО клиента.
 *
 * Здесь стояло:
 *
 *     async function sdk() {
 *       const mod = await import("@revenuecat/purchases-capacitor");
 *       return mod.Purchases;     // ← вот это
 *     }
 *
 * `mod.Purchases` — `Proxy` поверх `Proxy` Capacitor, и ловушка `get` у
 * второго отдаёт ФУНКЦИЮ на ЛЮБОЕ имя свойства, кроме `$$typeof` и
 * `toJSON` (`@capacitor/core`, `registerPlugin` → `createPluginMethodWrapper`).
 * Значит `typeof Purchases.then === "function"`, то есть объект —
 * THENABLE.
 *
 * `return` thenable из `async`-функции — это `Promise.resolve(thenable)`,
 * а он ОБЯЗАН позвать `thenable.then(resolve, reject)`. Обёртка Capacitor
 * свои аргументы игнорирует: она возвращает промис с отказом
 * `"Purchases.then()" is not implemented on android` и не зовёт ни
 * `resolve`, ни `reject`. **Промис `sdk()` не завершается никогда.**
 *
 * Поэтому `sdk()` теперь возвращает ОБЁРТКУ `{ api }`, а не сам объект
 * плагина: обычный объект thenable-ом не является, и промис завершается.
 * Сторож `check:native-purchase` запрещает голый возврат обратно.
 *
 * Почему этого не видел никто. В браузере `Capacitor.isNativePlatform()`
 * — false, и код выходит ДО первого обращения к `sdk()`; ни один
 * браузерный прибор до этой строки не доходил в принципе.
 */

/**
 * ПРИЧИНА ВТОРАЯ — МОСТ CAPACITOR УМЕЕТ ПРОГЛОТИТЬ ВЫЗОВ МОЛЧА.
 *
 * `native-bridge.js` (тот самый файл, что оболочка кладёт в `<head>`
 * каждого документа) в `cap.toNative` делает так:
 *
 *     try {
 *       if (typeof postToNative === "function") { …; postToNative(callData); }
 *       else { console.warn(`implementation unavailable for: ${pluginName}`); }
 *     } catch (e) { console.error(e); }
 *     return null;
 *
 * а `cap.nativePromise` к этому моменту уже создал промис. Если
 * `postToNative` не создался (он создаётся, только когда `window.androidBridge`
 * существует В МОМЕНТ запуска скрипта моста) или `postMessage` бросил, —
 * промис не завершится НИКОГДА, и отказ не долетит ни до `catch`, ни до
 * Sentry.
 *
 * Отменить вызов Capacitor нечем, поэтому защита ровно одна: СРОК. Каждое
 * обращение к магазину ниже идёт через `within(...)`, и по истечении срока
 * экран получает названный исход, а не крутящийся кружок.
 */

let configured = false;

/** Обёртка вокруг объекта плагина. Существует ровно за тем, чтобы из
 *  `async`-функции не возвращался thenable — см. «ПРИЧИНА ПЕРВАЯ». */
type StoreSdk = { api: typeof import("@revenuecat/purchases-capacitor").Purchases };

async function sdk(): Promise<StoreSdk> {
  const mod = await import("@revenuecat/purchases-capacitor");
  return { api: mod.Purchases };
}

/* ------------------------------------------------------------------ *
 * СРОКИ И ИСХОДЫ
 * ------------------------------------------------------------------ */

/**
 * Сколько ждём магазин, прежде чем назвать это отказом.
 *
 * Пятнадцать секунд — не «на глазок»: обращения `configure`, `logIn` и
 * `getOfferings` это сетевые вызовы к `api.revenuecat.com`, и их обычная
 * цена — единицы секунд. Всё, что дольше, человеку уже неотличимо от
 * поломки, а у нас для поломки есть честный текст и кнопка «Повторить».
 */
export const STORE_DEADLINE_MS = 15_000;

/** Шаг, на котором оборвалось. Едет в Sentry и в код ошибки на экране —
 *  чтобы следующая проверка на телефоне назвала причину сама. */
export type StoreStep = "import" | "configure" | "login" | "offerings" | "restore";

/**
 * Отчего варианты не показались. Четыре разных разговора с человеком, а не
 * один немой кружок:
 *
 *   plugin-missing    — в этой оболочке магазина нет вовсе (браузер, старая
 *                       сборка, плагин не зарегистрирован, нет ключа);
 *   store-unreachable — до магазина не достучались: срок вышел или мост
 *                       проглотил вызов;
 *   no-products       — магазин ответил, а товаров для этой учётной записи
 *                       нет (так бывает, когда аккаунт Google не тестировщик
 *                       трека);
 *   offline           — сети нет.
 */
export type StoreFailure = "plugin-missing" | "store-unreachable" | "no-products" | "offline";

export type StoreLoad =
  | { ok: true; packages: PurchasesPackage[] }
  | { ok: false; reason: StoreFailure; step: StoreStep; code: string };

const STEP_CODE: Record<StoreStep, string> = {
  import: "IMP",
  configure: "CFG",
  login: "LOG",
  offerings: "OFR",
  restore: "RST",
};

const REASON_CODE: Record<StoreFailure, string> = {
  "plugin-missing": "PLG",
  "store-unreachable": "CONN",
  "no-products": "EMPTY",
  offline: "NET",
};

/** Короткий код для фотографии экрана: `RC-CONN-OFR` и так далее. */
export function storeFailureCode(reason: StoreFailure, step: StoreStep): string {
  return `RC-${REASON_CODE[reason]}-${STEP_CODE[step]}`;
}

/** Срок вышел. Отдельный класс, потому что его разбирают по имени. */
class StoreTimeout extends Error {
  constructor(readonly step: StoreStep) {
    super(`store step "${step}" did not answer in ${STORE_DEADLINE_MS} ms`);
    this.name = "StoreTimeout";
  }
}

/**
 * Ждать не дольше срока.
 *
 * Отменить сам вызов Capacitor нечем — мост не даёт такой возможности, —
 * поэтому проигравший промис остаётся висеть. Это осознанная цена: висящий
 * промис ничего не держит и никого не будит, а вот висящий ЭКРАН — это
 * ровно тот дефект, который чинится.
 */
async function within<T>(work: Promise<T>, step: StoreStep, ms = STORE_DEADLINE_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new StoreTimeout(step)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Отказ, который значит «в этой оболочке магазина нет». Не путать с
 *  «магазин не ответил»: первое лечится новой сборкой, второе — повтором. */
function isUnimplemented(err: unknown): boolean {
  const raw = err as { code?: unknown; message?: unknown } | null;
  const code = raw && raw.code != null ? String(raw.code) : "";
  const message = typeof raw?.message === "string" ? raw.message : "";
  return code === "UNIMPLEMENTED" || code === "UNAVAILABLE" || /not implemented|unimplemented/i.test(message);
}

/** Отказ сети. Коды SDK плюс признак самого устройства. */
function isNetworkError(err: unknown): boolean {
  const raw = err as { code?: unknown; message?: unknown } | null;
  const code = raw && raw.code != null ? String(raw.code) : "";
  const message = typeof raw?.message === "string" ? raw.message : "";
  return (
    code === ERROR_NETWORK ||
    code === ERROR_OFFLINE_CONNECTION ||
    /network|offline|failed to fetch|load failed/i.test(message)
  );
}

function deviceIsOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function failure(reason: StoreFailure, step: StoreStep): StoreLoad {
  return { ok: false, reason, step, code: storeFailureCode(reason, step) };
}

/** Разбирает отказ ЛЮБОГО шага в один из четырёх исходов. */
function failureFrom(err: unknown, step: StoreStep): StoreLoad {
  if (deviceIsOffline() || isNetworkError(err)) return failure("offline", step);
  if (isUnimplemented(err)) return failure("plugin-missing", step);
  return failure("store-unreachable", step);
}

/* ------------------------------------------------------------------ *
 * ОБРАЩЕНИЯ К МАГАЗИНУ
 * ------------------------------------------------------------------ */

function currentPlatformApiKey(): string | undefined {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return REVENUECAT_IOS_PUBLIC_KEY || undefined;
  if (platform === "android") return REVENUECAT_ANDROID_PUBLIC_KEY || undefined;
  return undefined;
}

/** Есть ли в этой оболочке магазин вообще. Ноль обращений куда бы то ни
 *  было: только признаки самой страницы. */
export function storeIsPossible(): boolean {
  return Capacitor.isNativePlatform() && currentPlatformApiKey() !== undefined;
}

/** Настраивает SDK. Звать можно сколько угодно раз — второй вызов пустой.
 *  Возвращает `false`, если настроить нечем (браузер, iOS без ключа). */
export async function configureRevenueCat(): Promise<boolean> {
  if (!storeIsPossible()) return false;
  if (configured) return true;

  const apiKey = currentPlatformApiKey();
  if (!apiKey) return false;

  const { api } = await within(sdk(), "import");
  await within(api.configure({ apiKey }), "configure");
  configured = true;
  return true;
}

/**
 * Связывает покупателя магазина с нашим пользователем. Ровно тот же
 * идентификатор, который вебхук потом прочтёт в `event.app_user_id`, —
 * это и есть весь механизм привязки доступа к аккаунту САЙТА, а не к
 * платёжной системе.
 */
export async function loginRevenueCat(userId: string): Promise<CustomerInfo | undefined> {
  if (!(await configureRevenueCat())) return undefined;
  const { api } = await within(sdk(), "import");
  const { customerInfo } = await within(api.logIn({ appUserID: userId }), "login");
  return customerInfo;
}

/** Возврат к анониму при выходе: на общем телефоне следующий вошедший не
 *  должен унаследовать чужую покупку. */
export async function logoutRevenueCat(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !configured) return;
  const { api } = await within(sdk(), "import");
  await within(api.logOut(), "login");
}

export async function getCustomerInfo(): Promise<CustomerInfo | undefined> {
  if (!(await configureRevenueCat())) return undefined;
  const { api } = await within(sdk(), "import");
  const { customerInfo } = await within(api.getCustomerInfo(), "login");
  return customerInfo;
}

export function isProEntitlementActive(customerInfo: CustomerInfo | undefined): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
}

/** Предложение `default` из консоли RevenueCat — три пакета с ценами
 *  СТРОКАМИ магазина. Ни одной цифры цены на нашей стороне. */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!(await configureRevenueCat())) return null;
  const { api } = await within(sdk(), "import");
  const offerings = await within(api.getOfferings(), "offerings");
  return offerings.current ?? null;
}

/**
 * ВЕСЬ ПУТЬ ДО ВАРИАНТОВ ПОКУПКИ, С НАЗВАННЫМ ИСХОДОМ НА КАЖДОМ ШАГЕ.
 *
 * Экран покупки зовёт ровно это и больше ничего: раньше он собирал цепочку
 * сам и сводил ВСЕ четыре причины отказа в одно немое `null`. Теперь
 * причина имеет имя, шаг и короткий код — по ним следующая проверка на
 * телефоне говорит, где оборвалось, без разбора логов.
 *
 * Обещание у этой функции одно и жёсткое: она ЗАВЕРШАЕТСЯ. Ни один путь
 * внутри не способен оставить вызвавшего ждать вечно — за это отвечает
 * `within(...)` на каждом обращении к мосту.
 */
export async function loadStore(userId: string): Promise<StoreLoad> {
  if (!Capacitor.isNativePlatform()) return failure("plugin-missing", "import");
  if (!currentPlatformApiKey()) return failure("plugin-missing", "import");
  if (deviceIsOffline()) return failure("offline", "import");

  let api: StoreSdk["api"];
  try {
    api = (await within(sdk(), "import")).api;
  } catch (err) {
    return failureFrom(err, "import");
  }

  if (!configured) {
    try {
      await within(api.configure({ apiKey: currentPlatformApiKey()! }), "configure");
      configured = true;
    } catch (err) {
      return failureFrom(err, "configure");
    }
  }

  try {
    await within(api.logIn({ appUserID: userId }), "login");
  } catch (err) {
    return failureFrom(err, "login");
  }

  let offering: PurchasesOffering | null;
  try {
    const offerings = await within(api.getOfferings(), "offerings");
    offering = offerings.current ?? null;
  } catch (err) {
    return failureFrom(err, "offerings");
  }

  const available = offering?.availablePackages ?? [];
  // Магазин ответил, а товаров нет. Это НЕ «не достучались»: так выглядит
  // аккаунт Google, не допущенный к треку закрытого теста, и лечится это
  // не повтором, а списком тестировщиков.
  if (available.length === 0) return failure("no-products", "offerings");

  // Порядок показа — наш (`OFFERING_PACKAGE_ORDER`), а не тот, в котором
  // пакеты приехали: он в консоли меняется мышью.
  const rank = (p: PurchasesPackage) => {
    const at = OFFERING_PACKAGE_ORDER.indexOf(p.identifier as (typeof OFFERING_PACKAGE_ORDER)[number]);
    return at === -1 ? OFFERING_PACKAGE_ORDER.length : at;
  };
  return { ok: true, packages: [...available].sort((a, b) => rank(a) - rank(b)) };
}

/**
 * Чем закончилась покупка. Пять исходов, и каждый — отдельный разговор с
 * человеком:
 *
 *   purchased — магазин подтвердил оплату; доступ откроется, когда
 *               доедет событие вебхука (см. экран покупки);
 *   cancelled — человек закрыл системный лист сам. Молча, без ошибок:
 *               это не сбой;
 *   pending   — Google в Мексике разрешает оплатить покупку НАЛИЧНЫМИ, и
 *               тогда покупка висит в ожидании. Доступ НЕ открываем — его
 *               не оплатили;
 *   offline   — сеть; предложить повтор;
 *   error     — всё остальное.
 */
export type PurchaseOutcome =
  | { kind: "purchased"; customerInfo: CustomerInfo }
  | { kind: "cancelled" }
  | { kind: "pending" }
  | { kind: "offline" }
  | { kind: "error"; message: string };

/** Коды ошибок SDK, записанные строками ровно так, как их отдаёт мост
 *  (`PURCHASES_ERROR_CODE` — строковое перечисление). Литералы, а не
 *  импорт перечисления: тянуть ради трёх чисел ещё один рантайм-модуль в
 *  клиентский пакет незачем. */
const ERROR_PURCHASE_CANCELLED = "1";
const ERROR_PAYMENT_PENDING = "20";
const ERROR_NETWORK = "10";
const ERROR_OFFLINE_CONNECTION = "35";

function outcomeFromError(err: unknown): PurchaseOutcome {
  const raw = err as { code?: unknown; message?: unknown; userCancelled?: unknown } | null;
  const code = raw && raw.code != null ? String(raw.code) : "";
  if (raw?.userCancelled === true || code === ERROR_PURCHASE_CANCELLED) return { kind: "cancelled" };
  if (code === ERROR_PAYMENT_PENDING) return { kind: "pending" };
  if (code === ERROR_NETWORK || code === ERROR_OFFLINE_CONNECTION) return { kind: "offline" };
  return { kind: "error", message: typeof raw?.message === "string" ? raw.message : "" };
}

/**
 * СРОКА У САМОЙ ПОКУПКИ НЕТ, И ЭТО НАМЕРЕННО.
 *
 * `purchasePackage` возвращается только после того, как человек закончил
 * с системным листом магазина: выбрал способ оплаты, ввёл пароль, может
 * быть — отошёл и вернулся. Срок здесь означал бы «мы решили, что ты
 * думаешь слишком долго», и хуже того: оплата к тому моменту уже могла
 * пройти. Подготовку (`configure`) сроком прикрывает `configureRevenueCat`.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    if (!(await configureRevenueCat())) return { kind: "error", message: "" };
    const { api } = await within(sdk(), "import");
    const { customerInfo } = await api.purchasePackage({ aPackage: pkg });
    return { kind: "purchased", customerInfo };
  } catch (err) {
    return outcomeFromError(err);
  }
}

/** Восстановление — обращение к магазину, а не разговор с человеком,
 *  поэтому срок здесь есть. */
export async function restorePurchases(): Promise<CustomerInfo | undefined> {
  if (!(await configureRevenueCat())) return undefined;
  const { api } = await within(sdk(), "import");
  const { customerInfo } = await within(api.restorePurchases(), "restore");
  return customerInfo;
}
