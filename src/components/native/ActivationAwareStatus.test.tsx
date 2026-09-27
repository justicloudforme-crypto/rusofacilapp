import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ActivationAwareStatus from "./ActivationAwareStatus";
import { ACTIVATION_TIMEOUT_MS, resetActivationForTests, startActivationWatch } from "@/lib/access-activation";

// Заход 7.239: сразу после покупки кабинет показывал «Expirada» рядом с
// «Listo: tu acceso ya está abierto» — до перерисовки страницы.
const deps = (tier: string | null) => ({
  readTier: async () => tier,
  sleep: async () => {},
  now: (() => {
    let t = 0;
    return () => (t += 1);
  })(),
});

function view(serverEntitled: boolean) {
  return (
    <ActivationAwareStatus serverEntitled={serverEntitled} whenGranted={<span>Activa</span>}>
      <span>Expirada</span>
    </ActivationAwareStatus>
  );
}

afterEach(() => {
  cleanup();
  resetActivationForTests();
});

describe("ActivationAwareStatus", () => {
  it("сервер подтвердил доступ, страница ещё старая — не «Expirada», а «Activa»", async () => {
    render(view(false));
    expect(screen.getByText("Expirada")).toBeTruthy();
    await act(async () => {
      await startActivationWatch("free", deps("standard"));
    });
    expect(screen.queryByText("Expirada")).toBeNull();
    expect(screen.getByText("Activa")).toBeTruthy();
  });

  it("перерисовка пришла — снова ответ сервера", async () => {
    const { rerender } = render(view(false));
    await act(async () => {
      await startActivationWatch("free", deps("standard"));
    });
    rerender(
      <ActivationAwareStatus serverEntitled whenGranted={<span>Activa</span>}>
        <span>Activa (servidor)</span>
      </ActivationAwareStatus>,
    );
    expect(screen.getByText("Activa (servidor)")).toBeTruthy();
  });

  it("позитивный контроль: без покупки — как нарисовал сервер", () => {
    render(view(false));
    expect(screen.getByText("Expirada")).toBeTruthy();
    expect(screen.queryByText("Activa")).toBeNull();
  });
});

// Заход 7.240, задача 3: ~5 с между «Google взял оплату» и «сервер открыл
// доступ» кабинет показывал «Expirada», дату «Venció…» и тарифы.
function fullView(serverEntitled: boolean) {
  return (
    <ActivationAwareStatus
      serverEntitled={serverEntitled}
      whenGranted={<span>Activa</span>}
      whenWaiting={<span>Activando…</span>}
      whenSlow={<span>Sin confirmar</span>}
    >
      <span>Expirada</span>
    </ActivationAwareStatus>
  );
}

describe("ActivationAwareStatus — ожидание подтверждения (7.240)", () => {
  it("Google подтвердил, сервер ещё нет — «Activando…», а не «Expirada»", async () => {
    render(fullView(false));
    expect(screen.getByText("Expirada")).toBeTruthy();
    let release!: (tier: string | null) => void;
    const pending = new Promise<string | null>((resolve) => (release = resolve));
    let watch!: Promise<unknown>;
    act(() => {
      watch = startActivationWatch("free", { readTier: () => pending, sleep: async () => {}, now: () => 0 });
    });
    expect(screen.queryByText("Expirada")).toBeNull();
    expect(screen.getByText("Activando…")).toBeTruthy();
    await act(async () => {
      release("standard");
      await watch;
    });
    expect(screen.getByText("Activa")).toBeTruthy();
  });

  it("30 с без подтверждения — «Sin confirmar», не «Expirada» и не «Activa»", async () => {
    expect(ACTIVATION_TIMEOUT_MS).toBe(30_000);
    render(fullView(false));
    let t = 0;
    await act(async () => {
      await startActivationWatch("free", {
        readTier: async () => "free",
        sleep: async () => {},
        now: () => (t += 10_000),
      });
    });
    expect(screen.getByText("Sin confirmar")).toBeTruthy();
    expect(screen.queryByText("Expirada")).toBeNull();
    expect(screen.queryByText("Activa")).toBeNull();
  });

  it("контроль: без whenWaiting (старый вызов) ожидание рисует ответ сервера", () => {
    render(view(false));
    act(() => {
      void startActivationWatch("free", { readTier: () => new Promise(() => {}), sleep: async () => {}, now: () => 0 });
    });
    expect(screen.getByText("Expirada")).toBeTruthy();
  });
});
