import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import HighlightBoundary from "./HighlightBoundary";

/**
 * ТЕКСТ УРОКА ОСТАЁТСЯ НА ЭКРАНЕ, ЧТО БЫ НИ СЛУЧИЛОСЬ С ПОДСВЕТКОЙ.
 *
 * 29.08.2026 подсветка терминов унесла 240 адресов в «Something went
 * wrong»: выражение не собралось, исключение поднялось из клиентского
 * компонента, и ближайшей границей оказалась `error.tsx` МАРШРУТА — то
 * есть вся страница. С тех пор `try/catch` стоял ровно вокруг
 * `new RegExp` и не покрывал ни цикл разбора, ни отрисовку всплывающих
 * карточек у каждого найденного термина.
 *
 * Здесь проверяется именно то, чего не хватало: граница ВОКРУГ
 * подсветки, и запасной вариант у неё — сам текст.
 */
afterEach(() => cleanup());

function Exploding(): never {
  throw new Error("подсветка упала");
}

describe("граница ошибок вокруг подсветки", () => {
  it("падение подсветки оставляет текст урока на экране", () => {
    const text = "El ruso se escribe con el alfabeto cirílico, que tiene 33 letras.";
    // React печатает пойманное исключение в консоль сам; глушим, чтобы
    // прогон не тонул в ожидаемом шуме.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <p>
        <HighlightBoundary fallback={text}>
          <Exploding />
        </HighlightBoundary>
      </p>,
    );
    expect(screen.getByText(text)).toBeTruthy();
    spy.mockRestore();
  });

  it("ОТРИЦАТЕЛЬНЫЙ контроль: пока ничего не падает, граница ничего не подменяет", () => {
    // Без этого «текст на экране» доказывалось бы границей, которая
    // всегда печатает запасной вариант, — то есть подсветкой, выключенной
    // насовсем.
    render(
      <p>
        <HighlightBoundary fallback="запасной текст">
          <span>настоящая подсветка</span>
        </HighlightBoundary>
      </p>,
    );
    expect(screen.getByText("настоящая подсветка")).toBeTruthy();
    expect(screen.queryByText("запасной текст")).toBeNull();
  });

  it("компонент действительно завёрнут в границу, а не «где-то рядом»", () => {
    // Утверждение про ФАЙЛ, а не про экран: границу легко поставить
    // снаружи `GlossaryText`, и тогда она не поймала бы разбор, который
    // идёт в его собственной отрисовке.
    const source = readFileSync(join(process.cwd(), "src", "components", "glossary", "GlossaryText.tsx"), "utf8");
    expect(source).toContain("HighlightBoundary");
    // Разбор обязан идти у ребёнка границы, а не в теле `GlossaryText`.
    expect(source).toMatch(/<HighlightBoundary[\s\S]*<Linkified[\s\S]*<\/HighlightBoundary>/);
    // И сборка выражения — из общего модуля, а не второй копией здесь.
    expect(source).toContain("buildGlossaryPattern");
    expect(source).not.toContain("new RegExp");
  });
});
