import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import HashTokenForm from "./HashTokenForm";

/**
 * ДОЛГ 164. Правило заперто с обеих сторон: токен ПРИЕЗЖАЕТ из фрагмента
 * (иначе форму нечем отправить) и ИСЧЕЗАЕТ из адреса сразу после чтения
 * (иначе он уедет в Sentry вместе с `location.href`).
 */
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/es/reset-password");
});

const draw = () =>
  render(
    <HashTokenForm action="/api/auth/reset-password" lang="es" missingLabel="ссылка недействительна">
      <button type="submit">ок</button>
    </HashTokenForm>,
  );

describe("HashTokenForm (долг 164)", () => {
  it("берёт токен из фрагмента и кладёт его в скрытое поле", () => {
    window.history.replaceState(null, "", "/es/reset-password#token=abc.def");
    const { container } = draw();
    const field = container.querySelector<HTMLInputElement>('input[name="token"]');
    expect(field?.value).toBe("abc.def");
  });

  it("стирает фрагмент из адреса сразу — Sentry нечего прикладывать", () => {
    window.history.replaceState(null, "", "/es/reset-password#token=abc.def");
    // Позитивный контроль прибора: до рендера фрагмент в адресе ЕСТЬ.
    expect(window.location.hash).toBe("#token=abc.def");
    draw();
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain("abc.def");
  });

  it("без токена формы нет вовсе, а человеку сказано, что ссылка недействительна", () => {
    window.history.replaceState(null, "", "/es/reset-password?error=weak_password");
    const { container } = draw();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByText("ссылка недействительна")).toBeTruthy();
  });

  it("строка запроса переживает стирание фрагмента: сообщение об ошибке не теряется", () => {
    window.history.replaceState(null, "", "/es/reset-password?error=weak_password#token=abc");
    draw();
    expect(window.location.search).toBe("?error=weak_password");
    expect(window.location.hash).toBe("");
  });
});
