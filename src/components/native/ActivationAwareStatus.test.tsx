import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ActivationAwareStatus from "./ActivationAwareStatus";
import { resetActivationForTests, startActivationWatch } from "@/lib/access-activation";

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
