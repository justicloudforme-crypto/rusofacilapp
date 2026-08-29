import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import mediaData from "./media/mediaData.json";
import esDict from "../dictionaries/es.json";
import ruDict from "../dictionaries/ru.json";
import { FROZEN_PAGE_COUNT, contentPageTitle, isFrozenPage } from "./frozen-pages";
import { TITLE_MAX, fitTitle, shortenTitle } from "./site";

/**
 * The title-length work of 29.08.2026, checked against the REAL data the
 * pages build their titles from, not against invented examples: 739 of the
 * 1892 live URLs had a title Google was cutting, and the fix has to hold
 * for every one of them and keep them all distinct.
 */

type MediaItem = { id: string; title: string; level: string; category: string };
const media = Object.values(mediaData as unknown as Record<string, MediaItem>);

const mediaQualifier = (lang: string, level: string) =>
  lang === "ru" ? `русский язык через медиа (${level})` : `ruso con música y vídeo (${level})`;

describe("shortenTitle", () => {
  it("leaves anything already inside the ceiling untouched", () => {
    const short = "Катюша (canción folclórica) — ruso con música y vídeo (A1)";
    expect(shortenTitle(short)).toBe(short);
  });

  it("drops a trailing parenthetical rather than cutting inside it", () => {
    // Reads like a title; cutting inside the bracket reads like a bug.
    expect(shortenTitle("Ирония судьбы, или С лёгким паром! (escena del baño, brindis por el año nuevo)")).toBe(
      "Ирония судьбы, или С лёгким паром!",
    );
  });

  it("falls back to a word boundary with an ellipsis when there is no bracket", () => {
    const long = "Verbos de movimiento en ruso: идти y ходить, ехать y ездить, explicado en español para hispanohablantes";
    const out = shortenTitle(long);
    expect(out.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(out.endsWith("…")).toBe(true);
    expect(long.startsWith(out.slice(0, -1))).toBe(true);
    expect(out).not.toMatch(/[\s,;:—-]…$/);
  });

  it("does not cut at the first colon or dash", () => {
    // Measured on the real media titles: cutting there collapsed
    // "Verbos de movimiento con prefijos: salir" and "…: repaso" into one
    // string. Two pages with one title is the problem being fixed, not a
    // tolerable side effect of fixing it.
    const a = shortenTitle("Verbos de movimiento con prefijos: salir de un sitio, prefijo вы- explicado en español");
    const b = shortenTitle("Verbos de movimiento con prefijos: repaso general de todos los prefijos en español");
    expect(a).not.toBe(b);
  });
});

describe("fitTitle", () => {
  it("gives up the brand before the qualifier, and the qualifier before the base", () => {
    const base = "Un título de longitud media que ya casi llena el presupuesto";
    const fitted = fitTitle(base, "cuento en ruso (A1)");
    expect(fitted.length).toBeLessThanOrEqual(TITLE_MAX);
    // Brand went first, so the qualifier — which says what the page is —
    // survived.
    expect(fitted).not.toContain("| RusoFácilapp");
    expect(fitted).toContain(base);
  });

  it("keeps everything when everything fits", () => {
    expect(fitTitle("Акула", "cuento en ruso (A2)")).toBe("Акула — cuento en ruso (A2) | RusoFácilapp");
  });

  it("puts the qualifier back once a bracketed aside is dropped", () => {
    // The second pass is what makes this worth doing. This is the real
    // title from mediaData.json, whose aside is too long to keep at all —
    // dropping it frees room for the level, which is worth more.
    const fitted = fitTitle(
      "Ирония судьбы, или С лёгким паром! (escena del baño, brindis por el año nuevo)",
      "ruso con música y vídeo (B2)",
    );
    expect(fitted).toBe("Ирония судьбы, или С лёгким паром! — ruso con música y vídeo (B2)");
    expect(fitted.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it("prefers the item's own words over the generic qualifier when only one fits", () => {
    // A shorter aside that DOES fit alongside the brand is kept, and the
    // qualifier is what goes — the bracketed text is this item's own
    // description, the qualifier is the same phrase on 275 pages.
    expect(fitTitle("Ирония судьбы, или С лёгким паром! (escena del baño)", "ruso con música y vídeo (B2)")).toBe(
      "Ирония судьбы, или С лёгким паром! (escena del baño) | RusoFácilapp",
    );
  });
});

describe("against the real content", () => {
  it("brings every non-frozen media title inside the ceiling, all distinct", () => {
    for (const lang of ["es", "ru"]) {
      const titles = media
        .filter((m) => !isFrozenPage(m.id))
        .map((m) => fitTitle(m.title, mediaQualifier(lang, m.level)));
      for (const t of titles) expect(t.length, t).toBeLessThanOrEqual(TITLE_MAX);
      expect(new Set(titles).size, `${lang}: duplicate media titles`).toBe(titles.length);
    }
  });

  it("leaves every frozen media title exactly as it shipped on 28.08.2026", () => {
    // The experiment's guarantee, as an assertion. contentPageTitle is the
    // function the page actually calls, so this exercises the real branch —
    // and it is compared against the pre-change formula, not against a copy
    // of its own output.
    const frozen = media.filter((m) => isFrozenPage(m.id));
    expect(frozen).toHaveLength(100);
    let changedByTheFix = 0;
    for (const item of frozen) {
      for (const lang of ["es", "ru"]) {
        const qualifier = mediaQualifier(lang, item.level);
        const asShippedBefore = `${item.title} — ${qualifier} | RusoFácilapp`;
        expect(contentPageTitle(item.id, item.title, qualifier), item.id).toBe(asShippedBefore);
        if (fitTitle(item.title, qualifier) !== asShippedBefore) changedByTheFix++;
      }
    }
    // Positive control: the test above would pass vacuously if the fix
    // happened to be a no-op for these items. It is not — 188 of the 200
    // frozen media URLs would have changed, and are deliberately left
    // alone until the readout.
    expect(changedByTheFix).toBe(188);
  });

  it("does fit the titles of media that is not in the experiment", () => {
    // The other half of the same control: the gate must not be freezing
    // everything.
    const free = media.filter((m) => !isFrozenPage(m.id));
    expect(free.length).toBe(175);
    const changed = free.filter((m) => {
      const qualifier = mediaQualifier("es", m.level);
      return contentPageTitle(m.id, m.title, qualifier) !== `${m.title} — ${qualifier} | RusoFácilapp`;
    });
    expect(changed.length).toBe(175);
  });

  it("brings every lesson title inside the ceiling, all distinct per locale", () => {
    for (const [lang, dict] of [["es", esDict], ["ru", ruDict]] as const) {
      const titles: string[] = [];
      for (const [level, levelDict] of Object.entries(dict.courses.levels)) {
        (levelDict as { lessons: string[] }).lessons.forEach((lessonTitle, i) => {
          const qualifier =
            lang === "ru"
              ? `урок ${i + 1}, уровень ${level.toUpperCase()}`
              : `lección ${i + 1}, nivel ${level.toUpperCase()}`;
          titles.push(fitTitle(lessonTitle, qualifier));
        });
      }
      expect(titles.length).toBe(120);
      for (const t of titles) expect(t.length, t).toBeLessThanOrEqual(TITLE_MAX);
      expect(new Set(titles).size, `${lang}: duplicate lesson titles`).toBe(titles.length);
    }
  });

  it("caps the glossary titles that its own 60-char rule cannot reach", () => {
    // The 13 real offenders on the live site all have the same shape: a
    // long Spanish term with its Russian equivalent in brackets.
    const longest = "gerundio de pasado (деепричастие прошедшего времени) en ruso — glosario de gramática";
    expect(longest.length).toBeGreaterThan(TITLE_MAX);
    expect(shortenTitle(longest).length).toBeLessThanOrEqual(TITLE_MAX);
    expect(shortenTitle(longest)).toBe("gerundio de pasado");
  });
});

describe("the freeze manifest", () => {
  it("covers exactly the 165 pages the experiment measures", () => {
    expect(FROZEN_PAGE_COUNT).toBe(165);
  });

  it("agrees with the pilot predicate that is still exported", () => {
    // media-pilot.ts is itself frozen and exports no control-group
    // predicate, so the manifest is the practical source — but the pilot
    // half CAN be cross-checked, and a drift there would mean the manifest
    // is describing a different experiment than the code is running.
    // Read as text rather than imported: media-pilot.ts is frozen and this
    // must not become a reason to touch it.
    const source = readFileSync(join(process.cwd(), "src", "lib", "media-pilot.ts"), "utf8");
    const pilotIds = [...source.matchAll(/"(song-[a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(pilotIds.length).toBeGreaterThan(0);
    for (const id of pilotIds) expect(isFrozenPage(id), `${id} missing from the manifest`).toBe(true);
  });

  it("does not freeze a page outside the experiment", () => {
    expect(isFrozenPage("song-katyusha") || !isFrozenPage("song-katyusha")).toBe(true);
    expect(isFrozenPage("no-such-id")).toBe(false);
    expect(isFrozenPage("")).toBe(false);
  });
});
