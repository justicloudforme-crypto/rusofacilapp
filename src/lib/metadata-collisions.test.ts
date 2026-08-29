import { describe, expect, it } from "vitest";
import mediaData from "./media/mediaData.json";
import esDict from "../dictionaries/es.json";
import ruDict from "../dictionaries/ru.json";
import { contentPageTitle, isFrozenPage } from "./frozen-pages";
import { frozenMediaDescription, mediaDescription } from "./media/metadata";
import { TITLE_MAX, fitTitle, truncateForMeta } from "./site";

/**
 * Guards the defect the live crawl of 30.08.2026 found in the previous
 * round's own work: fitTitle dropped the qualifier before the brand, so a
 * LESSON and the grammar VIDEO of the same name both collapsed to
 * "<name> | RusoFácilapp" and two different URLs announced themselves
 * identically. The grammar videos mirror the lesson topics on purpose, so
 * that overlap is systematic and will recur with new content.
 *
 * Everything here runs against the real mediaData.json and the real lesson
 * dictionaries, and every "nothing collides" assertion is paired with a
 * positive control showing the same comparison catching a planted clash.
 */

type MediaItem = { id: string; title: string; level: string; category: string; description: string };
const media = Object.values(mediaData as unknown as Record<string, MediaItem>);

const Q = {
  es: {
    media: (l: string) => [`ruso con música y vídeo (${l})`, `vídeo (${l})`] as const,
    lesson: (n: number, l: string) => [`lección ${n}, nivel ${l}`, `lección ${n} (${l})`] as const,
  },
  ru: {
    media: (l: string) => [`русский язык через медиа (${l})`, `видео (${l})`] as const,
    lesson: (n: number, l: string) => [`урок ${n}, уровень ${l}`, `урок ${n} (${l})`] as const,
  },
};

/** Every title the two colliding families produce, as the pages build it. */
function allTitles(lang: "es" | "ru"): Map<string, string[]> {
  const byTitle = new Map<string, string[]>();
  const add = (title: string, where: string) => {
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title)!.push(where);
  };
  for (const item of media) {
    const [q, s] = Q[lang].media(item.level);
    add(contentPageTitle(item.id, item.title, q, s), `media/${item.id}`);
  }
  const dict = lang === "es" ? esDict : ruDict;
  for (const [level, levelDict] of Object.entries(dict.courses.levels)) {
    (levelDict as { lessons: string[] }).lessons.forEach((lessonTitle, i) => {
      const [q, s] = Q[lang].lesson(i + 1, level.toUpperCase());
      add(fitTitle(lessonTitle, q, s), `courses/${level}/${i + 1}`);
    });
  }
  return byTitle;
}

describe("lesson and media titles never collide", () => {
  it("produces no duplicate title across lessons and media, in either locale", () => {
    for (const lang of ["es", "ru"] as const) {
      const clashes = [...allTitles(lang).entries()]
        .filter(([, where]) => where.length > 1)
        .map(([title, where]) => `${title} :: ${where.join(", ")}`);
      expect(clashes, lang).toEqual([]);
    }
  });

  it("positive control: the same comparison catches a planted clash", () => {
    // Without this the test above could pass because the comparison is
    // broken rather than because the titles are distinct.
    const byTitle = allTitles("es");
    const anyTitle = [...byTitle.keys()][0];
    byTitle.get(anyTitle)!.push("planted/duplicate");
    const clashes = [...byTitle.entries()].filter(([, where]) => where.length > 1);
    expect(clashes.length).toBe(1);
  });

  it("keeps the two pages the live crawl caught apart", () => {
    // The real pair, with the real strings. Base is identical; only the
    // qualifier can tell them apart, so the qualifier is what must survive.
    const base = "Pronombres indefinidos: кто-то, что-то, какой-то";
    const lessonTitle = fitTitle(base, ...Q.es.lesson(23, "A2"));
    const videoTitle = fitTitle(base, ...Q.es.media("A2"));
    expect(lessonTitle).not.toBe(videoTitle);
    expect(lessonTitle.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(videoTitle.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(lessonTitle).toContain("lección 23");
    expect(videoTitle).toContain("vídeo (A2)");
  });

  it("positive control: without the short qualifier they DO collide", () => {
    // Reproduces the shipped bug exactly, so the fix above is shown to be
    // the thing that prevents it rather than a coincidence.
    const base = "Pronombres indefinidos: кто-то, что-то, какой-то";
    expect(fitTitle(base, Q.es.lesson(23, "A2")[0])).toBe(fitTitle(base, Q.es.media("A2")[0]));
  });

  it("prefers the long qualifier and only then the short one", () => {
    // Order matters: the short form is a fallback, not the default.
    expect(fitTitle("Акула", "cuento en ruso (A2)", "cuento (A2)")).toBe(
      "Акула — cuento en ruso (A2) | RusoFácilapp",
    );
  });
});

describe("media descriptions", () => {
  it("gives every non-frozen media page a description of its own", () => {
    for (const lang of ["es", "ru"] as const) {
      const free = media.filter((m) => !isFrozenPage(m.id));
      const descriptions = free.map((m) => mediaDescription(lang, m));
      const seen = new Map<string, string[]>();
      descriptions.forEach((d, i) => {
        if (!seen.has(d)) seen.set(d, []);
        seen.get(d)!.push(free[i].id);
      });
      const shared = [...seen.entries()].filter(([, ids]) => ids.length > 1);
      expect(shared.map(([d, ids]) => `${d} :: ${ids.join(", ")}`), lang).toEqual([]);
      for (const d of descriptions) {
        expect(d.length, d).toBeGreaterThanOrEqual(70);
        expect(d.length, d).toBeLessThanOrEqual(155);
      }
    }
  });

  it("positive control: the old Russian text really did repeat", () => {
    // 275 /ru media pages served five strings between them. This asserts
    // the problem existed, so the fix above is measured against something.
    const old = media.map((m) => frozenMediaDescription("ru", m));
    expect(new Set(old).size).toBe(5);
    expect(old.length).toBe(275);
  });

  it("leaves frozen media serving the exact text it served before", () => {
    const frozen = media.filter((m) => isFrozenPage(m.id));
    expect(frozen).toHaveLength(100);
    let wouldHaveChanged = 0;
    for (const item of frozen) {
      for (const lang of ["es", "ru"] as const) {
        expect(frozenMediaDescription(lang, item)).toBe(
          lang === "ru"
            ? `Изучайте русский язык через видео и музыку с субтитрами и упражнениями, уровень ${item.level}, в RusoFácilapp.`
            : item.description,
        );
        if (mediaDescription(lang, item) !== frozenMediaDescription(lang, item)) wouldHaveChanged++;
      }
    }
    // Positive control on the gate: it is not a no-op — every one of the
    // 200 frozen media URLs would otherwise have a different description.
    expect(wouldHaveChanged).toBe(200);
  });

  it("caps the Spanish side at what Google shows", () => {
    const longest = media.reduce((a, b) => (a.description.length > b.description.length ? a : b));
    expect(longest.description.length).toBeGreaterThan(155);
    expect(mediaDescription("es", longest).length).toBeLessThanOrEqual(155);
    expect(truncateForMeta(longest.description)).toBe(mediaDescription("es", longest));
  });
});
