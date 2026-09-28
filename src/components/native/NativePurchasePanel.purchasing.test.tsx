import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { nativeAccessCopy } from "@/lib/native-access-copy";
import { activationState, resetActivationForTests } from "@/lib/access-activation";
import type { PurchaseOutcome } from "@/lib/revenuecat-client";
import NativePurchasePanel from "./NativePurchasePanel";
import ActivationAwareStatus from "./ActivationAwareStatus";

// Ж.1 (аудит 7.241, Р17; заход 7.243). После «Comprar» в окне Google
// библиотека RevenueCat сначала отправляет чек на свой сервер (~1,5 с) и
// только потом отвечает `purchasePackage`. Всё это время экран обязан
// говорить «покупка идёт / Activando…», а не серверное «Expirada» с
// тарифами. Подмена моста: `purchasePackage` висит, пока тест не ответит.

let answer: (outcome: PurchaseOutcome) => void = () => {};
const purchasePackage = vi.fn(
  (pkg: PurchasesPackage) =>
    new Promise<PurchaseOutcome>((resolve) => {
      void pkg;
      answer = resolve;
    }),
);

vi.mock("@/lib/revenuecat-client", () => ({
  loadStore: async (userId: string) => {
    void userId;
    return {
      ok: true,
      packages: [{ identifier: "$rc_monthly", product: { priceString: "$99.00" } }],
    };
  },
  purchasePackage: (pkg: PurchasesPackage) => purchasePackage(pkg),
  restorePurchases: async () => null,
  storeFailureCode: () => "x",
}));

vi.mock("@sentry/nextjs", () => ({ captureMessage: () => {} }));

const copy = nativeAccessCopy("es").purchase;

function screenUnderTest() {
  return (
    <>
      <ActivationAwareStatus serverEntitled={false} whenGranted={<span>Activa</span>} whenWaiting={<span>{copy.activatingBadge}</span>}>
        <span>Expirada</span>
      </ActivationAwareStatus>
      <NativePurchasePanel lang="es" copy={copy} userId="u1" next="/es/profile" />
    </>
  );
}

beforeEach(() => {
  // Уровень доступа по ответу сервера — всё время «free»: вебхук ещё не пришёл.
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    void url;
    return new Response(JSON.stringify({ tier: "free" }), { status: 200 });
  }));
});

afterEach(() => {
  cleanup();
  resetActivationForTests();
  vi.unstubAllGlobals();
  purchasePackage.mockClear();
});

async function tapPlan() {
  const option = await screen.findByTestId("native-purchase-option");
  await act(async () => {
    fireEvent.click(option);
  });
  expect(purchasePackage).toHaveBeenCalledTimes(1);
}

describe("Ж.1: покупка идёт с первой секунды", () => {
  it("пока магазин не ответил — «Activando…», без «Expirada» и без тарифов", async () => {
    render(screenUnderTest());
    expect(screen.getByText("Expirada")).toBeTruthy(); // контроль: до нажатия — как сервер
    await tapPlan();
    expect(screen.queryByText("Expirada")).toBeNull();
    expect(screen.getByText(copy.activatingBadge)).toBeTruthy();
    expect(screen.queryByTestId("native-purchase-option")).toBeNull();
    expect(screen.getByTestId("native-purchase-message").textContent).toBe(copy.purchasing);
  });

  it("человек закрыл окно Google — снова как сервер и тарифы", async () => {
    render(screenUnderTest());
    await tapPlan();
    await act(async () => {
      answer({ kind: "cancelled" });
    });
    expect(screen.getByText("Expirada")).toBeTruthy();
    expect(screen.getByTestId("native-purchase-option")).toBeTruthy();
    expect(activationState().kind).toBe("idle");
  });

  it("оплата прошла, а панель уже закрыли — ожидание доступа всё равно начинается", async () => {
    const { unmount } = render(screenUnderTest());
    await tapPlan();
    unmount();
    await act(async () => {
      answer({ kind: "purchased", customerInfo: {} as never });
    });
    expect(activationState().kind).toBe("waiting");
  });
});
