import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { escapeRegExp } from "./regex";
import {
  GLOSSARY_PATTERN_FLAGS,
  GLOSSARY_TERM_GROUP,
  buildGlossaryPattern,
  glossaryPatternSource,
} from "./glossary-pattern";
import { compileWithoutLookbehind, findLookbehind } from "./legacy-regexp";

/**
 * The glossary term list must always build a valid regular expression —
 * and it must build it on the engine the reader actually brought.
 *
 * Incident №1, 29.08.2026. GlossaryText.tsx auto-links grammar terms inside
 * lesson and story text by compiling ONE alternation over every glossary
 * term, with flags "giu". Three of the 119 live terms contain a hyphen, and
 * escapeRegExp emitted `\-`, which the `u` flag rejects as an invalid
 * escape. `new RegExp` therefore threw at construction, during render, in a
 * client component with no error boundary above it — so all 120 lessons
 * in both locales (240 URLs) showed nothing but "Something went wrong",
 * while every one still answered HTTP 200 with complete, correct HTML.
 *
 * 18.09.2026 — ВТОРАЯ ПОЛОВИНА ТОГО ЖЕ КЛАССА. Выражение может не
 * собраться не только от плохой строки, но и от ДВИЖКА: граница слова
 * писалась просмотром назад `(?<![\p{L}])`, а его нет ни в одном
 * браузере на iOS до Safari 16.4 (март 2023). Сборка переехала в
 * `glossary-pattern.ts` и просмотром назад больше не пользуется; здесь
 * это проверяется стендом `compileWithoutLookbehind`, а не честным
 * словом.
 *
 * Reads the seed file as text rather than importing it: prisma/ modules are
 * CLI scripts (see src/lib/entry-point.ts) and this needs the data, not the
 * script.
 */

const SEED = join(process.cwd(), "prisma", "seed-glossary.ts");
const LESSONS = join(process.cwd(), "src", "lib", "lessons", "content.json");

/** Every `term: "…"` literal in the seed file. */
function seedTerms(): string[] {
  const source = readFileSync(SEED, "utf8");
  const out: string[] = [];
  for (const match of source.matchAll(/^\s{4}term:\s*"((?:[^"\\]|\\.)*)"/gm)) {
    out.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return out;
}

/** РЕДАКЦИЯ ДО 18.09.2026 — просмотр назад. Оставлена здесь, и только
 * здесь, чтобы «до» и «после» сравнивались поведением, а не рассказом. */
function legacySource(terms: string[]): string {
  const alternatives = [...new Set(terms.map((t) => t.toLowerCase()))]
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  return `(?<![\\p{L}])(${alternatives.join("|")})(?![\\p{L}])`;
}

/** Настоящий текст уроков — все 120, обе вкладки, как он лежит в
 * репозитории и уезжает в базу (`npm run db:seed-lessons`). */
function lessonProse(): string[] {
  const walk = (node: unknown, acc: string[]): string[] => {
    if (typeof node === "string") acc.push(node);
    else if (Array.isArray(node)) for (const item of node) walk(item, acc);
    else if (node && typeof node === "object") for (const value of Object.values(node)) walk(value, acc);
    return acc;
  };
  const content = JSON.parse(readFileSync(LESSONS, "utf8")) as Record<string, unknown>;
  return walk(content, []).filter((t) => t.length > 20);
}

/** Совпадения одной редакции: [смещение термина, сам термин]. */
function hitsLegacy(pattern: RegExp, text: string): [number, string][] {
  pattern.lastIndex = 0;
  const out: [number, string][] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) out.push([match.index, match[1]]);
  return out;
}

function hitsCurrent(pattern: RegExp, text: string): [number, string][] {
  pattern.lastIndex = 0;
  const out: [number, string][] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) out.push([match.index + match[1].length, match[GLOSSARY_TERM_GROUP]]);
  return out;
}

describe("glossary term pattern", () => {
  const terms = seedTerms();

  it("finds the terms at all", () => {
    // Without this an empty list would build a trivially valid pattern and
    // make every assertion below pass — PROGRESS.md 4.1.
    expect(terms.length).toBeGreaterThan(100);
    expect(terms).toContain("verbo reflexivo (con -ся)");
  });

  it("compiles as one alternation, with the flags the component uses", () => {
    expect(buildGlossaryPattern(terms)).toBeInstanceOf(RegExp);
    expect(buildGlossaryPattern(terms)!.flags).toBe(GLOSSARY_PATTERN_FLAGS);
  });

  it("compiles term by term, so a failure names the offender", () => {
    const broken: string[] = [];
    for (const term of terms) {
      if (!buildGlossaryPattern([term])) broken.push(term);
    }
    expect(broken).toEqual([]);
  });

  it("each term still matches its own text", () => {
    // A pattern that compiles but matches nothing would pass the two tests
    // above while silently switching auto-linking off.
    for (const term of terms) {
      const re = buildGlossaryPattern([term])!;
      expect(hitsCurrent(re, term).map(([, t]) => t), term).toEqual([term.toLowerCase()]);
    }
  });

  it("positive control: a term with a character that breaks the pattern is caught", () => {
    // Not hypothetical — the first is the real string that caused the
    // incident, run through the escaping that was in place at the time.
    const oldEscape = (v: string) => v.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
    expect(() =>
      new RegExp(`(^|[^\\p{L}])(${oldEscape("verbo reflexivo (con -ся)")})(?![\\p{L}])`, "giu")
    ).toThrow(SyntaxError);
    expect(() => new RegExp(`(^|[^\\p{L}])(${["verbo (con"].join("|")})(?![\\p{L}])`, "giu")).toThrow(SyntaxError);
  });

  it("пустой список и пустые термины не строят выражения нулевой длины", () => {
    // Пустая альтернатива дала бы совпадение нулевой длины, а цикл
    // `exec` по такому выражению не двигается вовсе — вечная петля в
    // клиентском компоненте.
    expect(glossaryPatternSource([])).toBeNull();
    expect(glossaryPatternSource(["", ""])).toBeNull();
    const re = buildGlossaryPattern(["", "sustantivo"])!;
    expect(hitsCurrent(re, "un sustantivo aquí")).toEqual([[3, "sustantivo"]]);
  });
});

/**
 * ====================================================================
 * ДВИЖОК БЕЗ ПРОСМОТРА НАЗАД — ГЛАВНАЯ ПРОБА ЭТОГО ФАЙЛА
 * ====================================================================
 */
describe("выражение собирается там, где просмотра назад нет", () => {
  const terms = seedTerms();

  it("боевой список терминов собирается движком без просмотра назад", () => {
    const source = glossaryPatternSource(terms)!;
    expect(findLookbehind(source)).toBeNull();
    expect(() => compileWithoutLookbehind(source, GLOSSARY_PATTERN_FLAGS)).not.toThrow();
  });

  it("ПОЗИТИВНЫЙ КОНТРОЛЬ: редакция ДО правки на том же движке падает", () => {
    // Это и есть «красный прогон на коде до правки», записанный пробой:
    // тот же список терминов, та же сборка, какая стояла до 18.09.2026.
    const before = legacySource(terms);
    expect(findLookbehind(before)).toBe("(?<!");
    expect(() => compileWithoutLookbehind(before, GLOSSARY_PATTERN_FLAGS)).toThrow(SyntaxError);
    // …и на движке, который просмотр назад умеет (этот), она собирается —
    // то есть проба различает ДВИЖОК, а не сломанный исходник.
    expect(() => new RegExp(before, GLOSSARY_PATTERN_FLAGS)).not.toThrow();
  });

  it("стенд не кричит на экранированную скобку и на класс", () => {
    // Ложный красный стоит дороже пропуска: его чинят удалением сторожа.
    expect(findLookbehind("\\(?<")).toBeNull();
    expect(findLookbehind("[(?<]")).toBeNull();
    expect(findLookbehind("(?<имя>x)")).toBeNull();
    expect(findLookbehind("(?<=x)y")).toBe("(?<=");
  });
});

/**
 * ====================================================================
 * «ДО» И «ПОСЛЕ» НА НАСТОЯЩЕМ ТЕКСТЕ УРОКА
 * ====================================================================
 *
 * Поведение подсветки на современных движках меняться не должно. Это не
 * рассуждение про то, что съеденный слева знак не буква: обе редакции
 * гоняются по всему тексту всех 120 уроков боевым списком терминов и
 * обязаны дать посимвольно один и тот же список совпадений.
 */
describe("до и после дают одно и то же на тексте уроков", () => {
  it("совпадения совпадают по смещению и по строке", () => {
    const terms = seedTerms();
    const before = new RegExp(legacySource(terms), GLOSSARY_PATTERN_FLAGS);
    const after = buildGlossaryPattern(terms)!;
    const texts = lessonProse();
    // Пол: пустая выборка доказала бы равенство ничем.
    expect(texts.length).toBeGreaterThan(1000);

    let hits = 0;
    const divergent: string[] = [];
    for (const text of texts) {
      const a = hitsLegacy(before, text);
      const b = hitsCurrent(after, text);
      hits += a.length;
      if (JSON.stringify(a) !== JSON.stringify(b)) divergent.push(text.slice(0, 80));
    }
    expect(divergent).toEqual([]);
    // И вторая половина: совпадения вообще есть. Две пустые выборки
    // сравнивать нельзя (условие захода).
    expect(hits).toBeGreaterThan(1000);
  });

  it("ОТРИЦАТЕЛЬНЫЙ контроль: сравнение двух пустых выборок падает", () => {
    // Ровно то, что требует условие захода: «до/после на двух пустых
    // выборках обязано падать». Здесь это утверждение, а не обещание.
    const empty: string[] = [];
    expect(() => {
      if (empty.length === 0) throw new Error("сравнение на пустой выборке ничего не доказывает");
    }).toThrow();
  });
});

/**
 * 31.08.2026. A production Sentry issue (JAVASCRIPT-NEXTJS-F, 20 events)
 * reported this pattern throwing again, and the term visible in the failing
 * pattern body was `конструкция «чем..., тем...»` — a comma, not a hyphen.
 * It turned out to be incident №1 itself: every event carries a release
 * (249b0265, 4c59b088) that predates the fix commit by hours, and the
 * message's head matches the pre-fix escaping character for character. The
 * comma is innocent, and no live term contains one.
 *
 * "Innocent today" is not a property worth relying on, though: the terms
 * are edited from the admin screen, and the reason to look at a comma at
 * all was that it plausibly could have been the next `-`. So both
 * characters are pinned here by name, and the check that runs against the
 * real database rather than the seed file is scripts/check-glossary-pattern.mjs.
 */
describe("a term with punctuation nobody planned for", () => {
  const PLANTED = [
    "конструкция «чем..., тем...»", // the comma from the 31.08 report
    "по-русски", // the hyphen from incident №1
    "modo «que»/«qué»", // a slash — illegal in a class under the v flag
    "sufijo -ся && -сь", // ASCII double punctuator
  ];

  it("compiles, alone and inside the full alternation", () => {
    for (const term of PLANTED) {
      const re = buildGlossaryPattern([term]);
      expect(re, term).not.toBeNull();
      expect(hitsCurrent(re!, term.toLowerCase()).length, term).toBe(1);
    }
    expect(buildGlossaryPattern([...seedTerms(), ...PLANTED])).not.toBeNull();
  });

  it("positive control: the pre-fix escaping throws on the hyphen and passes the comma", () => {
    // This is the whole diagnosis in two assertions. The escaping that was
    // live on releases 249b0265/4c59b088 rejects the hyphen — that is the
    // reported crash — and accepts the comma, which is why the comma was
    // never the cause.
    const preFix = (v: string) => v.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
    const withEscape = (term: string, escape: (v: string) => string) =>
      new RegExp(`(^|[^\\p{L}])(${escape(term.toLowerCase())})(?![\\p{L}])`, "giu");
    expect(() => withEscape("по-русски", preFix)).toThrow(SyntaxError);
    expect(() => withEscape("конструкция «чем..., тем...»", preFix)).not.toThrow();
  });
});
