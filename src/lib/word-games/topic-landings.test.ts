import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { flashcardLevels } from "@/lib/flashcards/types";
import { VOCABULARY_CATEGORY_PAGES } from "@/lib/vocabulary-categories";
import { wordGameTypes } from "./types";
import { hubMetadata, puzzleDescription, puzzleTitle, TITLE_MAX, DESCRIPTION_MIN, DESCRIPTION_MAX } from "./metadata";
import { topicForPuzzle } from "./topics";
import { TOPIC_LANDINGS, TOPIC_LANDING_PATHS, GENERIC_SOPA_PUZZLE, getTopicLanding, landingPath } from "./topic-landings";

/**
 * The six themed landings are the newest members of a family that already
 * competes with itself: the generic /es/sopa-de-letras-ruso, the 160
 * puzzle URLs, and the 23 /es/vocabulary pages all talk about the same
 * words. Cannibalisation here is not hypothetical — it is the default
 * outcome unless every one of them says something different.
 */

const BRAND = " | RusoFácilapp";
const APP = join(process.cwd(), "src", "app");

/** Every title and description the site serves that could plausibly
 * collide with a landing: the landings themselves, the game landings, the
 * vocabulary pages, the puzzle pages and both hubs. */
function allCompetingMetadata(): Array<{ where: string; title: string; description: string }> {
  const out: Array<{ where: string; title: string; description: string }> = [];

  for (const landing of TOPIC_LANDINGS) {
    out.push({ where: `landing:${landing.slug}`, title: landing.metaTitle, description: landing.metaDescription });
  }
  for (const page of VOCABULARY_CATEGORY_PAGES) {
    out.push({ where: `vocabulary:${page.slug}`, title: page.metaTitle, description: page.metaDescription });
  }
  for (const lang of locales) {
    const hub = hubMetadata(lang);
    out.push({ where: `word-games-hub:${lang}`, title: hub.title, description: hub.description });
  }
  for (const lang of locales) {
    for (const type of wordGameTypes) {
      for (const level of flashcardLevels) {
        for (let sequence = 1; sequence <= 12; sequence++) {
          const wordCount = (type === "WORD_SEARCH" ? 8 : 6) + 2 * sequence;
          const topic = topicForPuzzle(type, level, sequence);
          out.push({
            where: `puzzle:${lang}/${type}/${level}/${sequence}`,
            title: puzzleTitle(lang, type, level, sequence, wordCount, topic),
            description: puzzleDescription(lang, type, level, sequence, wordCount, topic),
          });
        }
      }
    }
  }
  // The other Spanish game landings, read from their own source so an edit
  // there is caught here rather than in production.
  for (const route of ["sopa-de-letras-ruso", "crucigramas-ruso-principiantes", "sopa-de-letras-alfabeto-cirilico", "juegos-para-aprender-ruso"]) {
    const src = readFileSync(join(APP, "[lang]", route, "page.tsx"), "utf8");
    const title = src.match(/title:\s*"([^"]+)"/)?.[1];
    const description = src.match(/description:\s*\n?\s*"([^"]+)"/)?.[1];
    if (title && description) out.push({ where: `game-landing:${route}`, title, description });
  }
  return out;
}

describe("themed sopa-de-letras landings", () => {
  it("picks six themes that pass all three selection criteria", () => {
    expect(TOPIC_LANDINGS).toHaveLength(6);

    for (const landing of TOPIC_LANDINGS) {
      // criterion 3: the vocabulary page it hands the word list to exists
      const page = VOCABULARY_CATEGORY_PAGES.find((p) => p.slug === landing.topic);
      expect(page, `${landing.slug}: no /es/vocabulary/${landing.topic}`).toBeDefined();

      // criterion 2: at least two themed puzzles across at least two levels
      const coords: Array<{ level: string; type: string; sequence: number }> = [];
      for (const type of wordGameTypes) {
        for (const level of flashcardLevels) {
          for (let sequence = 1; sequence <= 10; sequence++) {
            if (topicForPuzzle(type, level, sequence) === landing.topic) coords.push({ level, type, sequence });
          }
        }
      }
      expect(coords.length, `${landing.slug}: themed puzzles`).toBeGreaterThanOrEqual(2);
      expect(new Set(coords.map((c) => c.level)).size, `${landing.slug}: distinct levels`).toBeGreaterThanOrEqual(2);

      // and specifically a WORD_SEARCH to embed, other than the generic
      // landing's own puzzle
      const embeddable = coords.filter(
        (c) =>
          c.type === "WORD_SEARCH" &&
          !(c.level === GENERIC_SOPA_PUZZLE.level && c.sequence === GENERIC_SOPA_PUZZLE.sequence),
      );
      expect(embeddable.length, `${landing.slug}: embeddable word searches`).toBeGreaterThanOrEqual(1);
    }
  });

  it("positive control: the criteria reject a theme that fails them", () => {
    // "derecho" has no themed puzzle at all, "psicologia" has exactly one.
    // If the checks above passed for these too, they would be inert.
    for (const slug of ["derecho", "psicologia"]) {
      let count = 0;
      const levels = new Set<string>();
      for (const type of wordGameTypes) {
        for (const level of flashcardLevels) {
          for (let sequence = 1; sequence <= 10; sequence++) {
            if (topicForPuzzle(type, level, sequence) === slug) { count++; levels.add(level); }
          }
        }
      }
      const passes = count >= 2 && levels.size >= 2;
      expect(passes, `${slug} should not qualify`).toBe(false);
    }
    expect(TOPIC_LANDINGS.some((l) => l.topic === "derecho" || l.topic === "psicologia")).toBe(false);
  });

  it("keeps every title and description inside the SERP limits", () => {
    for (const landing of TOPIC_LANDINGS) {
      expect(landing.metaTitle.length, landing.metaTitle).toBeLessThanOrEqual(TITLE_MAX);
      expect(landing.metaTitle.endsWith(BRAND), landing.metaTitle).toBe(true);
      expect(landing.metaDescription.length, landing.metaDescription).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(landing.metaDescription.length, landing.metaDescription).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
  });

  it("collides with nothing else the site serves", () => {
    const all = allCompetingMetadata();
    const titles = new Map<string, string>();
    const descriptions = new Map<string, string>();
    const collisions: string[] = [];
    for (const entry of all) {
      const t = titles.get(entry.title);
      if (t) collisions.push(`title shared by ${t} and ${entry.where}: ${entry.title}`);
      else titles.set(entry.title, entry.where);
      const d = descriptions.get(entry.description);
      if (d) collisions.push(`description shared by ${d} and ${entry.where}`);
      else descriptions.set(entry.description, entry.where);
    }
    expect(collisions).toEqual([]);
    // guard against the comparison running over an empty set
    expect(all.length).toBeGreaterThan(200);
  });

  it("positive control: a duplicated title is reported", () => {
    const all = [...allCompetingMetadata(), { where: "planted", title: TOPIC_LANDINGS[0].metaTitle, description: "x" }];
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const entry of all) {
      const prev = seen.get(entry.title);
      if (prev) collisions.push(`${prev} / ${entry.where}`);
      else seen.set(entry.title, entry.where);
    }
    expect(collisions).toHaveLength(1);
  });

  it("does not repeat the hub's intent", () => {
    // The hub must promise the choice of themes; a landing must promise
    // its own theme. If the hub's title stopped saying "por temas" it
    // would be back to competing with its own children.
    const hubSrc = readFileSync(join(APP, "[lang]", "sopa-de-letras-ruso", "page.tsx"), "utf8");
    const hubTitle = hubSrc.match(/title:\s*"([^"]+)"/)?.[1] ?? "";
    expect(hubTitle).toContain("por temas");
    for (const landing of TOPIC_LANDINGS) {
      expect(hubTitle).not.toBe(landing.metaTitle);
      // no landing may claim to be the generic page
      expect(landing.metaTitle.startsWith("Sopa de letras en ruso,")).toBe(false);
    }
    // and the hub links to all six
    for (const path of TOPIC_LANDING_PATHS) {
      expect(hubSrc.includes("TOPIC_LANDINGS"), "hub must render the landing list").toBe(true);
      expect(path.startsWith("/sopa-de-letras-ruso-")).toBe(true);
    }
  });

  it("writes a real, unique article for each theme", () => {
    for (const landing of TOPIC_LANDINGS) {
      const words = landing.intro.join(" ").split(/\s+/).filter(Boolean).length;
      expect(words, `${landing.slug}: ${words} words`).toBeGreaterThanOrEqual(250);
    }

    // No two landings may share a sentence — a template with the category
    // name substituted in would show up here immediately.
    const sentences = new Map<string, string>();
    const shared: string[] = [];
    for (const landing of TOPIC_LANDINGS) {
      for (const sentence of landing.intro.join(" ").split(/(?<=\.)\s+/)) {
        const key = sentence.trim().toLowerCase();
        if (key.length < 40) continue;
        const prev = sentences.get(key);
        if (prev && prev !== landing.slug) shared.push(`${prev} / ${landing.slug}: ${sentence.slice(0, 60)}`);
        else sentences.set(key, landing.slug);
      }
    }
    expect(shared).toEqual([]);
    expect(sentences.size).toBeGreaterThan(50);
  });

  it("does not rewrite the vocabulary page's own explanation", () => {
    // Each landing deliberately takes a different angle from the same
    // category's /es/vocabulary intro, which a reader may open next. A
    // long shared phrase between the two means one of them is redundant.
    const offenders: string[] = [];
    for (const landing of TOPIC_LANDINGS) {
      const page = VOCABULARY_CATEGORY_PAGES.find((p) => p.slug === landing.topic);
      if (!page) continue;
      const vocab = page.intro.join(" ").toLowerCase();
      for (const sentence of landing.intro.join(" ").split(/(?<=\.)\s+/)) {
        const s = sentence.trim().toLowerCase();
        if (s.length >= 40 && vocab.includes(s)) offenders.push(`${landing.slug}: ${sentence.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never mixes Latin and Cyrillic inside one word", () => {
    const mixed = new Set<string>();
    const text = TOPIC_LANDINGS.flatMap((l) => [l.h1, l.metaTitle, l.metaDescription, l.articleDescription, ...l.intro]).join(" ");
    for (const word of text.split(/[^\p{L}]+/u)) {
      if (/[А-Яа-яЁё]/.test(word) && /[A-Za-z]/.test(word)) mixed.add(word);
    }
    expect([...mixed]).toEqual([]);
  });

  it("has a route file for every landing and nothing orphaned", () => {
    for (const landing of TOPIC_LANDINGS) {
      const file = join(APP, "[lang]", `sopa-de-letras-ruso-${landing.slug}`, "page.tsx");
      const src = readFileSync(file, "utf8");
      expect(src).toContain(`getTopicLanding("${landing.slug}")`);
    }
    expect(getTopicLanding("no-such-theme")).toBeUndefined();
    expect(landingPath(TOPIC_LANDINGS[0])).toBe(`/sopa-de-letras-ruso-${TOPIC_LANDINGS[0].slug}`);
  });
});
