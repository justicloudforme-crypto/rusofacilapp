import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nativeAccessCopy } from "@/lib/native-access-copy";
import { resetActivationForTests } from "@/lib/access-activation";
import type { RestoreOutcome } from "@/lib/revenuecat-client";
import NativePurchasePanel from "./NativePurchasePanel";

// Заход 7.265, Sentry NEXTJS-1A 13.10.2026: магазин ответил кодом 6 («уже
// куплено»), экран говорил «No se pudo completar», а в Sentry уходил
// warning «NativeStorePurchaseFailed: 6» рядом с настоящими сбоями.

let restoreAnswer: RestoreOutcome = { kind: "none", everBought: false };
const restoreNamed = vi.fn(async () => restoreAnswer);
let serverTier = "free";

vi.mock("@/lib/revenuecat-client", () => ({
  ERROR_ALREADY_PURCHASED: "6",
  loadStore: async () => ({
    ok: true,
    packages: [{ identifier: "$rc_monthly", product: { priceString: "$99.00" } }],
  }),
  purchasePackage: async () => ({ kind: "error", message: "This product is already active for the user.", code: "6" }),
  restoreNamed: () => restoreNamed(),
  storeFailureCode: () => "x",
}));

const captureMessage = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureMessage: (...args: unknown[]) => captureMessage(...args) }));

const copy = nativeAccessCopy("es").purchase;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ tier: serverTier }), { status: 200 })),
  );
});

afterEach(() => {
  cleanup();
  resetActivationForTests();
  vi.unstubAllGlobals();
  restoreNamed.mockClear();
  captureMessage.mockClear();
  serverTier = "free";
  restoreAnswer = { kind: "none", everBought: false };
});

async function tapPlan() {
  render(<NativePurchasePanel lang="es" copy={copy} userId="u1" next="/es/profile" />);
  const option = await screen.findByTestId("native-purchase-option");
  await act(async () => {
    fireEvent.click(option);
  });
}

const names = () => captureMessage.mock.calls.map((call) => String(call[0]));
const ownedEvent = () => captureMessage.mock.calls.find((call) => call[0] === "NativeStoreAlreadyOwned");

describe("7.265: «уже куплено» — не ошибка", () => {
  it("перенос запрещён — «привязана к другой учётке», без кода, событие info", async () => {
    restoreAnswer = { kind: "other-account", code: "7" };
    await tapPlan();
    await waitFor(() => expect(screen.getByTestId("native-purchase-message").textContent).toBe(copy.alreadyOwnedOtherAccount));
    expect(screen.queryByTestId("native-purchase-code")).toBeNull();
    expect(screen.queryByTestId("native-purchase-option")).toBeNull();
    expect(restoreNamed).toHaveBeenCalledTimes(1);
    expect(names().some((n) => n.startsWith("NativeStorePurchaseFailed"))).toBe(false);
    expect(ownedEvent()?.[1]).toMatchObject({ level: "info", tags: { code: "RC-BUY-6", resolution: "other-account" } });
    const timing = captureMessage.mock.calls.find((call) => call[0] === "NativePurchaseTiming");
    expect(timing?.[1]).toMatchObject({ level: "info", tags: { outcome: "already_owned", code: "RC-BUY-6" } });
  });

  it("доступ на этой учётке уже открыт — сказано, восстановления нет", async () => {
    serverTier = "standard";
    await tapPlan();
    await waitFor(() => expect(screen.getByTestId("native-purchase-message").textContent).toBe(copy.alreadyOwnedOpen));
    expect(restoreNamed).not.toHaveBeenCalled();
    expect(ownedEvent()?.[1]).toMatchObject({ level: "info", tags: { resolution: "already-open" } });
  });

  it("магазин ничего не вернул — «пока не видим», без «No se pudo»", async () => {
    await tapPlan();
    await waitFor(() => expect(screen.getByTestId("native-purchase-message").textContent).toBe(copy.alreadyOwnedNotFound));
    expect(screen.getByTestId("native-purchase-message").textContent).not.toBe(copy.failed);
    expect(ownedEvent()?.[1]).toMatchObject({ tags: { resolution: "not-found" } });
  });
});
