import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SPANISH_ONLY_ROUTES, isSpanishOnlyRoute, localeHref } from "./spanish-only-routes";

/**
 * Список испанских маршрутов сверяется с файловой системой В ОБЕ СТОРОНЫ.
 *
 * Односторонняя проверка («всё, что в списке, существует») пропустила бы
 * ровно тот отказ, ради которого список заведён: новый маршрут с
 * `lang !== "es" → notFound()`, о котором список не знает, снова начнёт
 * получать ссылки с префиксом `/ru`.
 */
const APP = join(process.cwd(), "src/app/[lang]");

function pageFiles(dir: string, prefix = ""): { route: string; file: string }[] {
  const out: { route: string; file: string }[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...pageFiles(full, `${prefix}/${entry}`));
    } else if (entry === "page.tsx") {
      out.push({ route: prefix || "/", file: full });
    }
  }
  return out;
}

/** Заглушка «эта страница только на /es» в ТЕЛЕ страницы, а не в метаданных. */
function bailsOutsideSpanish(source: string): boolean {
  return /lang !== "es"\)\s*(\n\s*)?notFound\(\)/.test(source);
}

describe("SPANISH_ONLY_ROUTES", () => {
  const found = pageFiles(APP)
    .filter(({ file }) => bailsOutsideSpanish(readFileSync(file, "utf8")))
    .map(({ route }) => route)
    .sort();

  it("не пропускает ни одного маршрута с испанской заглушкой", () => {
    expect(found).not.toHaveLength(0);
    expect(found.filter((r) => !SPANISH_ONLY_ROUTES.includes(r as never))).toEqual([]);
  });

  it("не содержит лишнего — каждая запись списка существует и правда испанская", () => {
    expect([...SPANISH_ONLY_ROUTES].filter((r) => !found.includes(r))).toEqual([]);
  });

  it("сопоставляет по форме пути, а не по подстроке", () => {
    // /vocabulary двуязычна (200 на обеих локалях), /vocabulary/<cat> — нет.
    expect(isSpanishOnlyRoute("/vocabulary")).toBe(false);
    expect(isSpanishOnlyRoute("/vocabulary/comida")).toBe(true);
    expect(isSpanishOnlyRoute("/vocabulary/comida/extra")).toBe(false);
    // /gramatica и /gramatica/<guía> обе в списке, но по своим записям.
    expect(isSpanishOnlyRoute("/gramatica")).toBe(true);
    expect(isSpanishOnlyRoute("/gramatica/alfabeto-ruso")).toBe(true);
    expect(isSpanishOnlyRoute("/gramatica/no-existe")).toBe(false);
    expect(isSpanishOnlyRoute("/stories")).toBe(false);
  });

  it("localeHref уводит на /es из обеих локалей только испанские маршруты", () => {
    expect(localeHref("ru", "/alfabeto-cirilico")).toBe("/es/alfabeto-cirilico");
    expect(localeHref("es", "/alfabeto-cirilico")).toBe("/es/alfabeto-cirilico");
    expect(localeHref("ru", "/stories")).toBe("/ru/stories");
    expect(localeHref("es", "/stories")).toBe("/es/stories");
  });
});
