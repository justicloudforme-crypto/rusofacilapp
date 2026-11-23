import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARRIED_CACHE_NAME,
  type CarriedGeneration,
  GENERATION_CACHE_NAME,
  MAX_CARRIED_GENERATIONS,
  PAGE_CACHE_PREFIX,
  buildFingerprint,
  carriedFingerprints,
  pageCacheNames,
  planCarriedGenerations,
  staleCacheNames,
} from "./sw-cache-names";

/**
 * The service worker's page and RSC caches must be scoped to the build.
 *
 * Debt 14, confirmed by experiment (see sw-cache-names.ts for the run): with
 * @serwist/next's fixed cache names, a returning visitor whose network failed
 * after a deploy was served the PRE-DEPLOY page at HTTP 200 out of the
 * service worker's cache — for up to the 24-hour expiry. After incident №1
 * that is the difference between "the fix shipped" and "the fix reached the
 * people who were hit".
 */

describe("buildFingerprint", () => {
  const manifestA = [{ url: "/_next/static/a.js", revision: "111" }, "/offline.html"];
  const manifestB = [{ url: "/_next/static/a.js", revision: "222" }, "/offline.html"];

  it("is stable for the same build", () => {
    expect(buildFingerprint(manifestA)).toBe(buildFingerprint(manifestA));
    // Order must not matter: webpack does not promise manifest order, and a
    // name that flipped between two values on one build would discard the
    // cache on every other page load — worse than the bug being fixed.
    expect(buildFingerprint([...manifestA].reverse())).toBe(buildFingerprint(manifestA));
  });

  it("changes when the build changes", () => {
    // A revision bump is what a real deploy produces.
    expect(buildFingerprint(manifestB)).not.toBe(buildFingerprint(manifestA));
    // …and so is an added or removed asset.
    expect(buildFingerprint([...manifestA, "/new.js"])).not.toBe(buildFingerprint(manifestA));
    // A same-length manifest with different content must also differ, or a
    // length-only fingerprint would pass every test above.
    expect(buildFingerprint(["/a.js", "/b.js"])).not.toBe(buildFingerprint(["/a.js", "/c.js"]));
  });

  it("survives an empty manifest instead of throwing", () => {
    // __SW_MANIFEST is typed as possibly undefined; a worker that throws at
    // startup registers nothing at all.
    expect(typeof buildFingerprint([])).toBe("string");
    expect(buildFingerprint([]).length).toBeGreaterThan(0);
  });
});

describe("cache names", () => {
  it("carry the fingerprint, so two builds cannot share entries", () => {
    const a = pageCacheNames("aaa");
    const b = pageCacheNames("bbb");
    // Семь имён с 28.09.2026 (7.233), но НА СБОРКУ приходится шесть, и
    // седьмое — общее. Шесть несут отпечаток (`html`, `content`,
    // `section`, `rsc`, `rsc-prefetch`, `others` и `sheets` — семь за
    // вычетом скачанного), а `downloads` у обеих сборок ОДНО И ТО ЖЕ, и
    // это не недосмотр: скачанное по кнопке обязано пережить выкат сайта
    // (разбор — в `src/lib/downloads.ts`). Поэтому 7 + 7 разных имён
    // дают 15, а не 16. Листы стилей СОХРАНЁННОЙ копии отпечаток несут
    // намеренно: лист принадлежит своей сборке так же, как разметка,
    // которая на него ссылается (заход 7.233, строка 314).
    expect(new Set([...Object.values(a), ...Object.values(b)]).size).toBe(15);
    expect(a.downloads, "имя кеша скачанного разъехалось по сборкам").toBe(b.downloads);
    for (const [key, name] of Object.entries(a)) {
      if (key === "downloads") continue;
      expect(name).toContain("aaa");
    }
    expect(a.downloads, "в имени кеша скачанного появился отпечаток сборки").not.toContain("aaa");
  });

  it("positive control: the names this replaces are NOT build-scoped", () => {
    // @serwist/next's own defaults, verified against the installed package.
    const worker = readFileSync(
      join(process.cwd(), "node_modules", "@serwist", "next", "dist", "index.worker.mjs"),
      "utf8"
    );
    expect(worker).toContain('rscPrefetch: "pages-rsc-prefetch"');
    expect(worker).toContain('rsc: "pages-rsc"');
    expect(worker).toContain('html: "pages"');
    // And the catch-all that actually receives navigations — the cache the
    // experiment caught serving a pre-deploy document.
    expect(worker).toContain('cacheName: "others"');
    // The "pages" route is unreachable for navigations: it keys off a
    // REQUEST Content-Type, which a GET navigation never sends.
    expect(worker).toMatch(/request\.headers\.get\("Content-Type"\)/);
    // Those three are constants: identical across every build, which is the
    // whole defect. Our names for the same three are not.
    for (const name of Object.values(pageCacheNames("x"))) {
      expect(["pages", "pages-rsc", "pages-rsc-prefetch", "others"]).not.toContain(name);
    }
  });
});

describe("staleCacheNames", () => {
  const current = "now";

  it("deletes other builds' page caches; keeps downloads and leaves viewed copies to the planner (строка 308, 7.301)", () => {
    const existing = [
      ...Object.values(pageCacheNames("older")),
      ...Object.values(pageCacheNames("old")),
      ...Object.values(pageCacheNames(current)),
      GENERATION_CACHE_NAME,
    ];
    const doomed = staleCacheNames(existing, current);
    // Кеш скачанного НЕ обречён: имя у него одно на все сборки (7.231).
    // Просмотренное (content, section, sheets) ЛЮБОГО прошлого поколения
    // здесь не трогается — его судит planCarriedGenerations (7.301).
    const expected = ["older", "old"].flatMap((fp) => {
      const n = pageCacheNames(fp);
      return [n.html, n.rsc, n.rscPrefetch, n.others];
    });
    expect(doomed.sort()).toEqual(expected.sort());
    expect(doomed, "выкат уносит скачанное").not.toContain(pageCacheNames(current).downloads);
    expect(doomed, "выкат уносит позапрошлое просмотренное мимо плана").not.toContain(pageCacheNames("older").content);
    expect(doomed, "метку поколения стёрли").not.toContain(GENERATION_CACHE_NAME);
  });

  it("регулярка переносимых имён совпадает с тем, что строит pageCacheNames", () => {
    for (const kind of ["content", "section", "sheets"] as const) {
      expect(CARRIED_CACHE_NAME.exec(pageCacheNames("abc123")[kind])?.[1]).toBe("abc123");
    }
    expect(CARRIED_CACHE_NAME.test(pageCacheNames("abc123").others)).toBe(false);
    expect(CARRIED_CACHE_NAME.test(GENERATION_CACHE_NAME)).toBe(false);
  });

  it("находит отпечатки переносимых кешей по живому списку", () => {
    const names = [pageCacheNames("a").content, pageCacheNames("b").sheets, pageCacheNames("c").others, GENERATION_CACHE_NAME];
    expect(carriedFingerprints(names).sort()).toEqual(["a", "b"]);
  });

  it("also deletes the fixed-name caches a returning visitor already has", () => {
    // Someone who visited before this change still holds "pages" etc., full
    // of pre-fix documents. Nothing else would ever remove them, so a fix
    // that only renamed the caches would leave the old ones untouched
    // forever — and NetworkFirst would no longer refresh them either.
    expect(staleCacheNames(["pages", "pages-rsc", "pages-rsc-prefetch", "others"], current).sort()).toEqual(
      ["others", "pages", "pages-rsc", "pages-rsc-prefetch"]
    );
  });

  it("never touches caches this app did not name", () => {
    // Deleting Serwist's own precache would re-download every asset on each
    // activate, and deleting the shared ones would undo the point of them.
    const others = ["serwist-precache-v2-https://rusofacilapp.com/", "apis", "next-static-js-assets", "static-image-assets"];
    expect(staleCacheNames(others, current)).toEqual([]);
  });

  it("positive control: given only current-build caches it deletes nothing", () => {
    // …so the assertions above are not just 'this function returns []'.
    expect(staleCacheNames(Object.values(pageCacheNames(current)), current)).toEqual([]);
    expect(staleCacheNames([`${PAGE_CACHE_PREFIX}-somethingelse`], current)).toEqual([`${PAGE_CACHE_PREFIX}-somethingelse`]);
  });
});

describe("the worker actually uses this", () => {
  const sw = readFileSync(join(process.cwd(), "src", "app", "sw.ts"), "utf8");

  it("scopes the three page caches and cleans up on activate", () => {
    // Without this the module above could be perfect and unreferenced.
    expect(sw).toContain("pageCacheNames");
    expect(sw).toContain("buildFingerprint");
    expect(sw).toContain("staleCacheNames");
    expect(sw).toMatch(/addEventListener\("activate"/);
    // The rebuilt routes must replace defaultCache, not sit beside it.
    expect(sw).toContain("runtimeCaching,");
    expect(sw).not.toMatch(/runtimeCaching:\s*defaultCache/);
  });
});

/**
 * ОФЛАЙН-2 (заход 7.229): кеш сохранённого содержания — пятое имя, и оно
 * НАМЕРЕННО начинается с общего префикса.
 *
 * На этом префиксе висят две уже оплаченные вещи, и обе нужны здесь
 * дословно: выход из учётной записи стирает такие кеши целиком
 * (`personalPageCaches`, `src/lib/signed-out.ts`), а новая сборка
 * выбрасывает чужие отпечатки (`staleCacheNames`). Сохранённый урок
 * ОБЯЗАН исчезать при выходе: он платный.
 */
describe("кеш сохранённого содержания (офлайн-2)", () => {
  it("носит общий префикс — значит выход из аккаунта его стирает", () => {
    expect(pageCacheNames("zzz").content.startsWith(PAGE_CACHE_PREFIX)).toBe(true);
  });

  it("помечен отпечатком сборки — сохранённый HTML не переживает выката (долг 14)", () => {
    expect(pageCacheNames("zzz").content).toContain("zzz");
    expect(pageCacheNames("zzz").content).not.toBe(pageCacheNames("yyy").content);
  });

  it("кеш ТЕКУЩЕЙ сборки не выбрасывается при активации; просмотренное прошлых — не здесь", () => {
    const mine = pageCacheNames("zzz").content;
    const older = pageCacheNames("yyy").content;
    const oldest = pageCacheNames("xxx").content;
    const stale = staleCacheNames([mine, older, oldest], "zzz");
    expect(stale).toEqual([]);
  });
});

describe("planCarriedGenerations — долг 308, заход 7.301", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = Date.UTC(2026, 10, 22);
  const base = { now: NOW, maxDocs: 36, maxAgeMs: 30 * DAY, maxGenerations: MAX_CARRIED_GENERATIONS };
  const gen = (fingerprint: string, urls: string[], savedDaysAgo: number | null = 1): CarriedGeneration => ({
    fingerprint,
    docs: urls.map((url) => ({ kind: url.endsWith("/courses") ? ("section" as const) : ("content" as const), url })),
    newestSavedAt: savedDaysAgo === null ? null : NOW - savedDaysAgo * DAY,
  });
  const dropped = (fp: string) => ["content", "section", "sheets"].map((k) => pageCacheNames(fp)[k as "content"]);

  it("ДВА ВЫКАТА ПОДРЯД: урок, сохранённый под позапрошлой сборкой и не открытый с тех пор, остаётся (ровно долг 308)", () => {
    const plan = planCarriedGenerations({
      ...base,
      current: "c",
      history: ["b", "a"],
      generations: [gen("a", ["https://x/ru/courses/a1/2"]), gen("b", [], null)],
    });
    expect(plan.dropCaches, "позапрошлое поколение с единственной копией урока унесено").not.toContain(pageCacheNames("a").content);
    expect(plan.dropCaches, "пустое поколение остаётся висеть").toEqual(dropped("b"));
    expect(plan.history).toEqual(["c", "a"]);
  });

  it("пересохранённое в более новом поколении: старое уходит целиком", () => {
    const plan = planCarriedGenerations({
      ...base,
      current: "c",
      history: ["b", "a"],
      generations: [gen("b", ["u1", "u2"]), gen("a", ["u1"])],
    });
    expect(plan.dropCaches).toEqual(dropped("a"));
    expect(plan.history).toEqual(["c", "b"]);
  });

  it("частично пересохранённое: старое остаётся, но его копия-дубль стирается поштучно", () => {
    const plan = planCarriedGenerations({
      ...base,
      current: "c",
      history: ["b", "a"],
      generations: [gen("b", ["u1"]), gen("a", ["u1", "u2"])],
    });
    expect(plan.dropCaches).toEqual([]);
    expect(plan.dropEntries).toEqual([{ cacheName: pageCacheNames("a").content, url: "u1" }]);
  });

  it("копии текущего поколения — самые новые: дубль в прошлом стирается, текущее не трогается", () => {
    const plan = planCarriedGenerations({
      ...base,
      current: "c",
      history: ["b"],
      generations: [gen("c", ["u1"]), gen("b", ["u1", "u2"])],
    });
    expect(plan.dropEntries).toEqual([{ cacheName: pageCacheNames("b").content, url: "u1" }]);
    expect(plan.dropCaches).toEqual([]);
  });

  it("старше срока кеша содержания (30 дней) — уходит", () => {
    const plan = planCarriedGenerations({
      ...base,
      current: "c",
      history: ["b", "a"],
      generations: [gen("b", ["u1"], 2), gen("a", ["u2"], 31)],
    });
    expect(plan.dropCaches).toEqual(dropped("a"));
  });

  it("потолок записей: вес просмотренного не растёт с числом выкатов", () => {
    const many = Array.from({ length: 36 }, (_, i) => `n${i}`);
    const plan = planCarriedGenerations({
      ...base,
      current: "c",
      history: ["b", "a"],
      generations: [gen("b", many), gen("a", ["old-only"])],
    });
    expect(plan.dropCaches, "потолок 36 набран более новым поколением — старое обязано уйти").toEqual(dropped("a"));
  });

  it("не больше MAX_CARRIED_GENERATIONS поколений: самые старые уходят", () => {
    const fps = Array.from({ length: MAX_CARRIED_GENERATIONS + 2 }, (_, i) => `g${i}`);
    const plan = planCarriedGenerations({
      ...base,
      current: "now",
      history: fps,
      generations: fps.map((fp) => gen(fp, [`u-${fp}`])),
    });
    expect(plan.history).toEqual(["now", ...fps.slice(0, MAX_CARRIED_GENERATIONS)]);
    expect(plan.dropCaches.sort()).toEqual(fps.slice(MAX_CARRIED_GENERATIONS).flatMap(dropped).sort());
  });

  it("установка до 7.301: истории нет — неизвестные поколения идут после известных и тоже судятся по содержимому", () => {
    const plan = planCarriedGenerations({
      ...base,
      current: "c",
      history: ["b"],
      generations: [gen("b", ["u1"]), gen("z", ["u1"]), gen("y", ["u3"])],
    });
    expect(plan.dropCaches).toEqual(dropped("z"));
    expect(plan.history).toEqual(["c", "b", "y"]);
  });

  it("опись без даты (null) срок не применяет — держит потолок", () => {
    const plan = planCarriedGenerations({ ...base, current: "c", history: [], generations: [gen("a", ["u"], null)] });
    expect(plan.dropCaches).toEqual([]);
  });
});
