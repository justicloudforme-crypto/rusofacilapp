/**
 * ОДНО МЕСТО, ГДЕ ЗАПИСАНА НАСТРОЙКА МАГАЗИННОЙ ПОКУПКИ — заход 7.224.
 *
 * Здесь лежат ровно четыре вещи: публичный ключ SDK, право доступа,
 * перепись товаров магазина и версия оболочки, начиная с которой покупка
 * внутри приложения вообще существует. Читают отсюда И клиент
 * (`src/lib/revenuecat-client.ts`, экран покупки), И сервер (вебхук
 * `/api/webhooks/revenuecat`), И сторож `npm run check:native-purchase` —
 * поэтому файл намеренно БЕЗ `server-only` и без единого импорта.
 *
 * ПОЧЕМУ КЛЮЧ ЗАПИСАН ЗДЕСЬ, А НЕ В `android/`. Оболочка не несёт сайт
 * внутри себя: она грузит `https://rusofacilapp.com` удалённо
 * (`server.url` в `capacitor.config.ts`). Значит код, который зовёт
 * `Purchases.configure`, — это код САЙТА, собранный на Vercel, и никакая
 * строка из `android/` до него не доезжает в принципе. «Там же, где
 * оболочка держит остальную конфигурацию сборки» для удалённой оболочки
 * означает «в одном модуле настроек, а не россыпью по компонентам», и
 * этот модуль — вот он.
 *
 * ПОЧЕМУ У КЛЮЧА ЕСТЬ ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ, А НЕ ОДНА ПЕРЕМЕННАЯ
 * ОКРУЖЕНИЯ. Замер 7.192: в боевом чанке стояло `s.env.NEXT_PUBLIC_
 * REVENUECAT_ANDROID_API_KEY`, то есть значение на сборке не подставилось
 * вовсе, и SDK молча не конфигурировался — снаружи это выглядело как
 * кнопка, не делающая ничего. Публичный ключ SDK на то и публичный, что
 * его место — внутри клиентского пакета (так устроена ЛЮБАЯ нативная
 * интеграция RevenueCat); секретна здесь только `REVENUECAT_WEBHOOK_SECRET`,
 * и её в этом файле нет. Переменная окружения оставлена как ПЕРЕКРЫТИЕ —
 * чтобы тестовый ключ можно было подставить, не трогая код.
 */

/**
 * Право доступа, заведённое владельцем в консоли RevenueCat, — к нему
 * привязаны все три товара.
 *
 * ЗАПИСЬ ВАЖНА ПОБАЙТОВО. «á» здесь — ОДИН символ U+00E1 (форма NFC,
 * `c3 a1` в UTF-8), а не «a» плюс комбинирующий акут (NFD, `61 cc 81`).
 * Две эти строки выглядят на экране одинаково и не равны друг другу ни в
 * JS, ни в HTTP. Сторож `check:native-purchase` сверяет нормализацию.
 */
export const PRO_ENTITLEMENT_ID = "rusofácilapp_pro";

/** Публичный ключ SDK для Google Play. Не секрет: он предназначен для
 *  клиента и живёт внутри пакета приложения. */
export const REVENUECAT_ANDROID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY || "goog_YlQIdtFbcQHnAPVjhJnMggEQIQF";

/** Публичный ключ SDK для App Store. Пока пуст: приложения iOS в магазине
 *  нет, продуктов там не заведено, и выдумывать значение нечего. */
export const REVENUECAT_IOS_PUBLIC_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY || "";

/** Наш внутренний идентификатор плана. Повторяет `PlanId` из
 *  `src/lib/plans.ts` — тот модуль про Stripe, и тянуть его сюда значило
 *  бы тянуть Stripe в клиентский пакет оболочки. Что два списка совпадают,
 *  держит `src/lib/revenuecat-config.test.ts`. */
export type StorePlanId = "monthly" | "annual" | "lifetime";

/**
 * ПЕРЕПИСЬ ТОВАРОВ МАГАЗИНА → НАШ ПЛАН.
 *
 * Значения — ровно те, что владелец завёл в Google Play и импортировал в
 * RevenueCat 22.09.2026: подписка `standard` с базовыми планами `monthly`
 * и `annual`, разовый товар `premium_lifetime`. Google отдаёт подписку с
 * базовым планом как `<subscriptionId>:<basePlanId>`, поэтому ключи
 * составные.
 *
 * ПОЧЕМУ СПИСОК ЗАПИСАН В КОДЕ, А НЕ ТОЛЬКО В ПЕРЕМЕННЫХ ОКРУЖЕНИЯ. До
 * этого захода соответствие жило ТОЛЬКО в `REVENUECAT_PRODUCT_*`, и цена
 * ошибки в них — молчаливая: незнакомый товар давал плану имя `unknown`,
 * а `unknown` — это не Premium, то есть человек, заплативший 2 299 песо
 * за Premium, получил бы `standard` и не увидел бы ни C1, ни звёздных
 * пазлов. Никто бы не упал: вебхук ответил бы 200. Переменные оставлены
 * ПЕРЕКРЫТИЕМ на случай, если товар в консоли когда-нибудь переименуют,
 * — но правда по умолчанию записана здесь.
 */
export const STORE_PRODUCTS: Readonly<Record<string, StorePlanId>> = {
  "standard:monthly": "monthly",
  "standard:annual": "annual",
  premium_lifetime: "lifetime",
};

/** Идентификатор подписки Google (без базового плана) — нужен и ссылке
 *  «управлять подпиской» в центре подписок Google Play. */
export const PLAY_SUBSCRIPTION_ID = "standard";

/** Пакет приложения. Тот же литерал, что `appId` в `capacitor.config.ts`;
 *  сличает `check:native-purchase`. */
export const ANDROID_PACKAGE_NAME = "com.rusofacilapp.app";

/**
 * Версия оболочки, начиная с которой внутри приложения существует покупка.
 *
 * Зачем число, а не «включено/выключено». В закрытом тесте уже живёт
 * `versionCode 3`, в которой нативной покупки нет вовсе и быть не может:
 * её webview не несёт ни плагина, ни разрешения BILLING. Покажи мы ей
 * кнопку покупки — человек получил бы ровно то, чем был долг 179:
 * кнопку, не делающую ничего. Сайт отличает версии по токену и куке
 * (`src/lib/native-shell-token.ts`), и покупка включается только тем, кто
 * умеет её выполнить.
 *
 * Это НИЖНЯЯ ГРАНИЦА, а не номер нынешней сборки, и с 24.09.2026 (заход
 * 7.228, `versionCode 5`) она от него отличается намеренно. Сличается так:
 * `NATIVE_PURCHASE_MIN_SHELL_VERSION` ≤ `versionCode` в
 * `android/app/build.gradle`, а `NATIVE_SHELL_VERSION` в
 * `capacitor.config.ts` равен `versionCode` — держит
 * `npm run check:native-purchase`. Требовать равенства всех трёх, как было
 * до 7.228, значило бы отбирать покупку у всех, кто ещё не обновился: в
 * закрытом тесте у 25 человек живёт оболочка 4, и покупать она умеет.
 */
export const NATIVE_PURCHASE_MIN_SHELL_VERSION = 4;

/** Имена пакетов в offering `default` консоли RevenueCat. Порядок — тот,
 *  в котором они показываются человеку: самый дешёвый вход сверху. */
export const OFFERING_PACKAGE_ORDER = ["$rc_monthly", "$rc_annual", "$rc_lifetime"] as const;

/**
 * Товар события вебхука → наш план.
 *
 * Разбирается ТРИ формы, и все три встречаются у Google:
 *   1. `standard:monthly` — подписка вместе с базовым планом (так RevenueCat
 *      называет товар с Billing Library 5+);
 *   2. `standard` + отдельное поле `base_plan_id` — та же покупка, если
 *      RevenueCat когда-нибудь разложит её на два поля;
 *   3. `premium_lifetime` — разовый товар, базового плана у него нет.
 *
 * Перекрытие переменными окружения проверяется ПЕРВЫМ: если владелец
 * переименовал товар в консоли и вписал новое имя в Vercel, правым обязан
 * быть он, а не записанное здесь умолчание.
 */
export function planFromStoreProductId(input: {
  productId?: string | null;
  basePlanId?: string | null;
}): StorePlanId | null {
  const productId = (input.productId ?? "").trim();
  if (!productId) return null;

  const overrides: Array<[string | undefined, StorePlanId]> = [
    [process.env.REVENUECAT_PRODUCT_MONTHLY, "monthly"],
    [process.env.REVENUECAT_PRODUCT_ANNUAL, "annual"],
    [process.env.REVENUECAT_PRODUCT_LIFETIME, "lifetime"],
  ];
  for (const [value, plan] of overrides) {
    if (value && value.trim() && value.trim() === productId) return plan;
  }

  const direct = STORE_PRODUCTS[productId];
  if (direct) return direct;

  const basePlanId = (input.basePlanId ?? "").trim();
  if (basePlanId) {
    const composed = STORE_PRODUCTS[`${productId}:${basePlanId}`];
    if (composed) return composed;
  }
  return null;
}

/**
 * Адрес центра подписок Google Play — туда ведёт «Управлять подпиской» у
 * того, кто купил подписку в приложении.
 *
 * Отменить магазинную подписку может только сам магазин: у нас нет и не
 * может быть права закрыть чужую регулярную оплату. Поэтому здесь ссылка,
 * а не наша кнопка отмены, — наша отменяет то, что завели мы (Stripe).
 *
 * Имя платёжной системы стоит в АДРЕСЕ, а не в тексте кнопки: долг 196
 * запрещает называть платёжные системы в интерфейсе оболочки, и подпись
 * ссылки их не называет.
 */
export function playSubscriptionCenterUrl(): string {
  return `https://play.google.com/store/account/subscriptions?sku=${PLAY_SUBSCRIPTION_ID}&package=${ANDROID_PACKAGE_NAME}`;
}
