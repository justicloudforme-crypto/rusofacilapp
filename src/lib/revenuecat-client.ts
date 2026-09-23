"use client";

import { Capacitor } from "@capacitor/core";
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "@revenuecat/purchases-capacitor";
import {
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
 * Причина числом: этот модуль теперь читает клиентский компонент экрана
 * покупки, а обычный импорт положил бы код плагина в общий пакет, который
 * качает КАЖДЫЙ посетитель сайта в браузере, где покупки нет вовсе. Тип
 * `Purchases` при этом импортируется как тип — типы из сборки стираются.
 *
 * ВИТРИНА RevenueCat UI ЗДЕСЬ БОЛЬШЕ НЕ ЗОВЁТСЯ. До 7.224 отсюда
 * вызывался `RevenueCatUI.presentPaywall()` — экран, нарисованный в
 * консоли RevenueCat. Он не нарисован там ни разу, и звать его значило бы
 * повторить долг 179: кнопку, которая молча не делает ничего. Экран
 * выбора рисуем мы сами, а цены берём строками из магазина.
 */

let configured = false;

async function sdk() {
  const mod = await import("@revenuecat/purchases-capacitor");
  return mod.Purchases;
}

function currentPlatformApiKey(): string | undefined {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return REVENUECAT_IOS_PUBLIC_KEY || undefined;
  if (platform === "android") return REVENUECAT_ANDROID_PUBLIC_KEY || undefined;
  return undefined;
}

/** Настраивает SDK. Звать можно сколько угодно раз — второй вызов пустой.
 *  Возвращает `false`, если настроить нечем (браузер, iOS без ключа). */
export async function configureRevenueCat(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (configured) return true;

  const apiKey = currentPlatformApiKey();
  if (!apiKey) {
    console.warn("[revenuecat] нет публичного ключа для этой платформы — SDK не настроен");
    return false;
  }

  const Purchases = await sdk();
  await Purchases.configure({ apiKey });
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
  const Purchases = await sdk();
  const { customerInfo } = await Purchases.logIn({ appUserID: userId });
  return customerInfo;
}

/** Возврат к анониму при выходе: на общем телефоне следующий вошедший не
 *  должен унаследовать чужую покупку. */
export async function logoutRevenueCat(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !configured) return;
  const Purchases = await sdk();
  await Purchases.logOut();
}

export async function getCustomerInfo(): Promise<CustomerInfo | undefined> {
  if (!(await configureRevenueCat())) return undefined;
  const Purchases = await sdk();
  const { customerInfo } = await Purchases.getCustomerInfo();
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
  const Purchases = await sdk();
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
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

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  if (!(await configureRevenueCat())) return { kind: "error", message: "" };
  try {
    const Purchases = await sdk();
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return { kind: "purchased", customerInfo };
  } catch (err) {
    return outcomeFromError(err);
  }
}

export async function restorePurchases(): Promise<CustomerInfo | undefined> {
  if (!(await configureRevenueCat())) return undefined;
  const Purchases = await sdk();
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
}
