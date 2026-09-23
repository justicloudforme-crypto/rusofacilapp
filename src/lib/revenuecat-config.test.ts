import { describe, expect, it } from "vitest";
import {
  NATIVE_PURCHASE_MIN_SHELL_VERSION,
  OFFERING_PACKAGE_ORDER,
  PRO_ENTITLEMENT_ID,
  REVENUECAT_ANDROID_PUBLIC_KEY,
  STORE_PRODUCTS,
  planFromStoreProductId,
  playSubscriptionCenterUrl,
} from "./revenuecat-config";
import { PLAN_TIER, isPlanId } from "./plans";

describe("право доступа записано побайтово", () => {
  /**
   * ЗАЧЕМ ЭТО ПРОВЕРЯТЬ. «á» бывает двух видов: один символ U+00E1 (NFC) и
   * «a» плюс комбинирующий акут U+0061 U+0301 (NFD). На экране они
   * неразличимы, а в JS и в HTTP это РАЗНЫЕ строки. Право доступа в
   * консоли RevenueCat заведено в первом виде; попади сюда второй — SDK
   * никогда не нашёл бы активного права, и человек с оплаченной подпиской
   * упирался бы в замок, а причина была бы невидима глазом.
   */
  it("это NFC: один символ U+00E1, а не буква плюс комбинирующий знак", () => {
    expect(PRO_ENTITLEMENT_ID).toBe(PRO_ENTITLEMENT_ID.normalize("NFC"));
    expect(PRO_ENTITLEMENT_ID).not.toBe(PRO_ENTITLEMENT_ID.normalize("NFD"));
    expect([...PRO_ENTITLEMENT_ID].map((c) => c.codePointAt(0)!.toString(16))).toContain("e1");
    expect(Buffer.from(PRO_ENTITLEMENT_ID, "utf8").toString("hex")).toBe(
      "7275736f66c3a163696c6170705f70726f"
    );
  });
});

describe("перепись товаров магазина", () => {
  it("три товара и ровно те, что заведены в Google Play", () => {
    expect(Object.keys(STORE_PRODUCTS).sort()).toEqual([
      "premium_lifetime",
      "standard:annual",
      "standard:monthly",
    ]);
  });

  it("каждый план переписи — настоящий план сайта, и уровни совпадают", () => {
    for (const plan of Object.values(STORE_PRODUCTS)) {
      expect(isPlanId(plan)).toBe(true);
      expect(PLAN_TIER[plan]).toBe(plan === "lifetime" ? "premium" : "standard");
    }
  });

  it("разовый товар даёт Premium, подписка — standard", () => {
    expect(planFromStoreProductId({ productId: "premium_lifetime" })).toBe("lifetime");
    expect(planFromStoreProductId({ productId: "standard:monthly" })).toBe("monthly");
    expect(planFromStoreProductId({ productId: "standard:annual" })).toBe("annual");
  });

  it("товар, разложенный на два поля, читается так же", () => {
    expect(planFromStoreProductId({ productId: "standard", basePlanId: "annual" })).toBe("annual");
  });

  it("незнакомый товар не превращается в подписку молча", () => {
    expect(planFromStoreProductId({ productId: "standard:weekly" })).toBeNull();
    expect(planFromStoreProductId({ productId: "" })).toBeNull();
    expect(planFromStoreProductId({ productId: null })).toBeNull();
  });

  it("переменная окружения перекрывает умолчание", () => {
    const saved = process.env.REVENUECAT_PRODUCT_LIFETIME;
    process.env.REVENUECAT_PRODUCT_LIFETIME = "otro_producto";
    try {
      expect(planFromStoreProductId({ productId: "otro_producto" })).toBe("lifetime");
    } finally {
      if (saved === undefined) delete process.env.REVENUECAT_PRODUCT_LIFETIME;
      else process.env.REVENUECAT_PRODUCT_LIFETIME = saved;
    }
  });
});

describe("остальная настройка", () => {
  it("публичный ключ Play на месте и он именно ключ Play", () => {
    expect(REVENUECAT_ANDROID_PUBLIC_KEY.startsWith("goog_")).toBe(true);
  });

  it("покупка включается с оболочки 4 — той самой, в которую её кладут", () => {
    expect(NATIVE_PURCHASE_MIN_SHELL_VERSION).toBe(4);
  });

  it("порядок пакетов — три имени предложения default", () => {
    expect([...OFFERING_PACKAGE_ORDER]).toEqual(["$rc_monthly", "$rc_annual", "$rc_lifetime"]);
  });

  it("ссылка управления ведёт в центр подписок и несёт наш пакет", () => {
    const url = playSubscriptionCenterUrl();
    expect(url).toContain("/store/account/subscriptions");
    expect(url).toContain("package=com.rusofacilapp.app");
  });
});
