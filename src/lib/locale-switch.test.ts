import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SPANISH_ONLY_ROUTES, isSpanishOnlyRoute } from "./spanish-only-routes";
import { SPANISH_ONLY_FALLBACK, localeSwitchTarget } from "./locale-switch";

/**
 * Правило: переключатель языка никогда не ведёт на ошибку.
 *
 * Проверяется в трёх направлениях, и все три обязаны краснеть по
 * отдельности: (1) у каждого испанского маршрута есть хаб, (2) хаб —
 * настоящий существующий двуязычный маршрут, а не строка, (3) на
 * двуязычном маршруте переключатель по-прежнему меняет ТОЛЬКО локаль.
 */
const APP = join(process.cwd(), "src/app/[lang]");

function pageRoutes(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pageRoutes(full, `${prefix}/${entry}`));
    else if (entry === "page.tsx") out.push(prefix || "/");
  }
  return out;
}

describe("localeSwitchTarget", () => {
  const routes = pageRoutes(APP);

  it("на двуязычном маршруте меняет только локаль", () => {
    expect(localeSwitchTarget("/es/stories/abc", "ru")).toEqual({ href: "/ru/stories/abc", paired: true });
    expect(localeSwitchTarget("/ru/stories/abc", "es")).toEqual({ href: "/es/stories/abc", paired: true });
    expect(localeSwitchTarget("/es/courses/A1/a1-1", "ru")).toEqual({ href: "/ru/courses/A1/a1-1", paired: true });
    expect(localeSwitchTarget("/ru", "es")).toEqual({ href: "/es", paired: true });
    expect(localeSwitchTarget("/es", "ru")).toEqual({ href: "/ru", paired: true });
  });

  it("на испанской странице уводит в хаб раздела, а не в 404", () => {
    expect(localeSwitchTarget("/es/vocabulary/sinonimos-y-antonimos", "ru")).toEqual({
      href: "/ru/vocabulary",
      paired: false,
    });
    expect(localeSwitchTarget("/es/gramatica/alfabeto-ruso", "ru")).toEqual({
      href: "/ru/glossary",
      paired: false,
    });
    expect(localeSwitchTarget("/es/sopa-de-letras-ruso-comida", "ru")).toEqual({
      href: "/ru/word-games",
      paired: false,
    });
    expect(localeSwitchTarget("/es/alfabeto-cirilico", "ru")).toEqual({
      href: "/ru/courses",
      paired: false,
    });
  });

  it("в испанскую локаль ведёт напрямую — там страница есть", () => {
    // Обратное направление не подменяется никогда: /es/<испанский> существует.
    for (const route of SPANISH_ONLY_ROUTES) {
      const path = route.replace("[categoria]", "comida");
      expect(localeSwitchTarget(`/ru${path}`, "es")).toEqual({ href: `/es${path}`, paired: true });
    }
  });

  it("у каждого испанского маршрута назначен хаб, и он существует и двуязычен", () => {
    for (const route of SPANISH_ONLY_ROUTES) {
      const hub = SPANISH_ONLY_FALLBACK[route];
      expect(hub, `${route} без хаба`).toBeTruthy();
      // Хаб — настоящий маршрут приложения…
      expect(routes, `${route} → ${hub}: такого маршрута нет`).toContain(hub);
      // …и он НЕ испанский, иначе подмена уводила бы в тот же 404.
      expect(isSpanishOnlyRoute(hub), `${route} → ${hub}: сам испанский`).toBe(false);
      // …и его страница действительно не отказывает вне /es.
      const source = readFileSync(join(APP, hub, "page.tsx"), "utf8");
      expect(/lang !== "es"\)\s*(\n\s*)?notFound\(\)/.test(source), `${hub} отказывает вне /es`).toBe(false);
    }
  });

  it("ни один испанский маршрут не остался со своим же адресом в /ru", () => {
    const stillBroken = SPANISH_ONLY_ROUTES.filter((route) => {
      const path = route.replace("[categoria]", "comida");
      return localeSwitchTarget(`/es${path}`, "ru").href === `/ru${path}`;
    });
    expect(stillBroken).toEqual([]);
  });
});
