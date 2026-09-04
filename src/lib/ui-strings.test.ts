import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { UI_STRINGS } from "./ui-strings";

/**
 * Debt 16 was 25 Spanish values left inside `ru.json`. This is the same
 * class one level down: interface strings that never reached a dictionary
 * at all, hard-coded in the component that renders them, and therefore
 * shown in Spanish to a student reading the Russian interface — the
 * "Tu grabación" next to "Ошибка" the owner reported.
 *
 * The distinction that makes this checkable is the same one dictionary-
 * parity.test.ts had to make, and it is not symmetric:
 *
 *   - Russian words inside a Spanish lesson title are CONTENT. This site
 *     teaches Russian to Spanish speakers; "Caso dativo: la edad (мне...
 *     лет)" is correct.
 *   - Spanish prose on a page that exists only in /es is CONTENT too. The
 *     grammar guides, the puzzle landings and the 23 vocabulary category
 *     pages are Spanish-only by design and 404 on /ru — they are articles
 *     written in Spanish, not an interface that failed to translate.
 *   - A Spanish (or English, or Russian) LABEL inside a component that
 *     renders in both locales is the defect.
 *
 * So the rule is about interface labels in shared components, and the
 * exceptions below each carry the reason they are not that.
 */

const LABEL_ATTRIBUTES = new Set(["aria-label", "placeholder", "title", "alt", "label"]);

/** Two words, or one word of four letters or more — enough to be prose
 * rather than a symbol, a level code or a unit. */
function looksLikeSentence(text: string): boolean {
  const words = text.match(/[\p{L}][\p{L}'’-]*/gu) ?? [];
  return words.length >= 2 || (words[0]?.length ?? 0) >= 4;
}

/**
 * A stricter test, for literals sitting inside an expression rather than in
 * text or a label attribute. There they share space with class lists, ARIA
 * roles, HTTP methods and paths, and none of those are interface text.
 * Prose here has to have a capital or a space, at least one lowercase
 * letter (so POST and A1 are out), no slash (paths), and must not read as
 * a list of lowercase utility tokens.
 *
 * The cost is honest and worth naming: a lowercase one-word Spanish label
 * inside an expression would slip through. In JSX text — where such a
 * label almost always lives — looksLikeSentence still catches it.
 */
function looksLikeProse(text: string): boolean {
  if (!/\p{L}/u.test(text)) return false;
  if (text.includes("/")) return false;
  // "{known}", "{total}" — the placeholder half of a dictionary template's
  // .replace(), not text of its own.
  if (/^\{[a-zA-Z]+\}$/.test(text)) return false;
  // camelCase identifiers: a mode name, a key, a field.
  if (!text.includes(" ") && /^[a-z]+[A-Z]/.test(text)) return false;
  if (!/\p{Ll}/u.test(text)) return false;
  const tokens = text.split(/\s+/);
  const allLowercaseTokens = tokens.every((token) => /^[\p{Ll}0-9:[\]().!#%_-]+$/u.test(token));
  if (allLowercaseTokens) return false;
  return looksLikeSentence(text);
}

export interface Hit {
  file: string;
  line: number;
  kind: string;
  text: string;
}

/**
 * Every user-visible string literal in one .tsx file: JSX text, the
 * label-ish attributes, and literals inside JSX expression children —
 * that last one matters, because `{passed ? "Aprobado" : "No aprobado"}`
 * is exactly the shape the first version of this scanner walked straight
 * past. Attribute expressions are deliberately not searched: `className`
 * and friends are full of literals that are not text.
 */
export function findHardcodedStrings(file: string, source: string): Hit[] {
  const src = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const at = (node: ts.Node) => src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
  const hits: Hit[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text && looksLikeSentence(text)) hits.push({ file, line: at(node), kind: "text", text });
    }

    if (ts.isJsxAttribute(node) && node.name && LABEL_ATTRIBUTES.has(node.name.getText(src))) {
      const init = node.initializer;
      let value: string | null = null;
      if (init && ts.isStringLiteral(init)) value = init.text;
      else if (init && ts.isJsxExpression(init) && init.expression) {
        if (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression)) {
          value = init.expression.text;
        }
      }
      if (value && looksLikeSentence(value)) {
        hits.push({ file, line: at(node), kind: node.name.getText(src), text: value });
      }
    }

    // A JSX expression used as a child, not as an attribute value.
    if (ts.isJsxExpression(node) && node.parent && !ts.isJsxAttribute(node.parent) && node.expression) {
      const literals: ts.Node[] = [];
      const collect = (n: ts.Node) => {
        // Stop at nested JSX: its own attributes are className and friends,
        // and the main walk visits it anyway. Descending into it is what
        // made the first version of this scanner report 2378 "offenders",
        // nearly all of them Tailwind class lists.
        if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return;
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) literals.push(n);
        ts.forEachChild(n, collect);
      };
      collect(node.expression);
      for (const literal of literals) {
        const text = (literal as ts.StringLiteral).text.trim();
        if (text && looksLikeProse(text)) hits.push({ file, line: at(literal), kind: "expression", text });
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(src);
  return hits;
}

function tsxFilesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".tsx") && !full.endsWith(".test.tsx")) out.push(path.relative(process.cwd(), full));
    }
  };
  walk(path.join(process.cwd(), dir));
  return out.sort();
}

/**
 * Each entry says WHY the prose inside it is not an untranslated interface
 * label. `match` is a path prefix or a regular expression over the
 * repo-relative path.
 *
 * Every entry is itself checked below: if it stops matching any hit, it is
 * stale and has to go, or the list quietly grows into a way of never
 * failing — the same self-check the 17 legitimate exceptions in
 * dictionary-parity.test.ts carry.
 */
const ALLOWED: { match: RegExp; reason: string }[] = [
  {
    match: /^src\/(components\/admin|app\/\[lang\]\/admin)\//,
    reason:
      "the admin surface: one operator (the owner), disallowed in robots.txt, never shown to a student. Its language is the owner's, not the product's.",
  },
  {
    match: /^src\/(components\/styleguide|app\/\[lang\]\/styleguide)\//,
    reason: "the internal design-system page: disallowed in robots.txt AND noindex (PROGRESS 7.29), a tool, not a screen.",
  },
  {
    match: /^src\/app\/\[lang\]\/(gramatica|crucigramas-ruso-principiantes|juegos-para-aprender-ruso|sopa-de-letras)/,
    reason:
      "Spanish-only routes by design — they explain Russian THROUGH Spanish and return 404 on /ru (PROGRESS section 0). Their prose is the article, not an interface label.",
  },
  {
    match: /^src\/app\/\[lang\]\/vocabulary\/(\[categoria\]\/page|page)\.tsx$/,
    reason:
      "the 23 category pages are /es-only (23 in the sitemap for /es, 0 for /ru), and the index block that names them is rendered only when lang === 'es' (showCategoryIndex).",
  },
  {
    match: /^src\/components\/word-games\/(TopicLandingPage|GameLandingLinks|WhyLearnRussianBlurb|SpanishGamesHubLink)\.tsx$/,
    reason:
      "rendered only by the Spanish-only puzzle landings above, or (SpanishGamesHubLink) only when lang === 'es' on the bilingual catalogue; same reasoning, one level down.",
  },
  {
    match: /(^|\/)(error|global-error)\.tsx$/,
    reason:
      "the error boundaries are deliberately bilingual: Next passes no `lang` to error.tsx, and global-error.tsx runs when the locale layout itself is what failed, so there is no dictionary to reach for (PROGRESS 2.1).",
  },
  {
    match: /^src\/components\/(Footer|Navbar|lesson\/BrandMark)\.tsx$/,
    reason: "the brand name RusoFácilapp(.com) — a name, the same in both locales, not a translatable string.",
  },
];

describe("interface strings live in a dictionary, not in components", () => {
  const files = [...tsxFilesUnder("src/components"), ...tsxFilesUnder("src/app")];

  const hits = files.flatMap((file) => findHardcodedStrings(file, readFileSync(file, "utf8")));

  it("scans a real, non-empty set of files", () => {
    // Guards against the whole check quietly passing because the walk
    // found nothing — a zero from an empty input is not a zero.
    expect(files.length).toBeGreaterThan(150);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("no shared component hard-codes a user-visible string", () => {
    const offenders = hits
      .filter((hit) => !ALLOWED.some((entry) => entry.match.test(hit.file)))
      .map((hit) => `${hit.file}:${hit.line} [${hit.kind}] ${hit.text.slice(0, 60)}`);
    expect(offenders).toEqual([]);
  });

  it("every exception still matches something, so the list cannot rot", () => {
    const stale = ALLOWED.filter((entry) => !hits.some((hit) => entry.match.test(hit.file))).map(
      (entry) => entry.reason
    );
    expect(stale).toEqual([]);
  });

  it("control: the scanner finds each shape it claims to find", () => {
    const planted = `
      export default function X() {
        return (
          <div title="Cerrar aviso">
            Las palabras subrayadas son interactivas
            <span aria-label="word search" className="flex items-center gap-4" />
            {passed ? "Aprobado" : "No aprobado"}
          </div>
        );
      }
    `;
    const found = findHardcodedStrings("planted.tsx", planted);
    expect(found.map((h) => h.text).sort()).toEqual(
      ["Aprobado", "Cerrar aviso", "Las palabras subrayadas son interactivas", "No aprobado", "word search"].sort()
    );
  });

  it("control: the scanner does NOT flag what is not interface text", () => {
    const innocent = `
      // Las palabras subrayadas son interactivas — a comment, not a label
      export default function X({ label }: { label: string }) {
        return (
          <div className="flex flex-wrap items-center gap-4 text-sm" aria-label={label}>
            {label} — {level} A1 · {n}%
          </div>
        );
      }
    `;
    expect(findHardcodedStrings("innocent.tsx", innocent)).toEqual([]);
  });
});

describe("UI_STRINGS follows the same parity rules as the dictionaries", () => {
  const flatten = (obj: object, prefix = ""): Record<string, string> =>
    Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === "string") acc[`${prefix}${key}`] = value;
      else Object.assign(acc, flatten(value as object, `${prefix}${key}.`));
      return acc;
    }, {});

  const es = flatten(UI_STRINGS.es);
  const ru = flatten(UI_STRINGS.ru);

  it("has the same keys in both locales", () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(es).sort());
    expect(Object.keys(es).length).toBeGreaterThan(10);
  });

  it("every Russian value is actually in Russian", () => {
    // Cyrillic required, not "no Spanish orthography": the brand name
    // carries an accent and can sit inside a correct Russian string. Same
    // rule as dictionary-parity.test.ts and check-rendered-surface.mjs.
    const notRussian = Object.entries(ru).filter(([, value]) => !/[а-яёА-ЯЁ]/.test(value));
    expect(notRussian).toEqual([]);
  });

  it("no Russian value is still a copy of the Spanish one", () => {
    const untranslated = Object.keys(es).filter((key) => ru[key] === es[key]);
    expect(untranslated).toEqual([]);
  });

  it("control: the parity checks fail on an untranslated value", () => {
    const broken: Record<string, string> = { ...ru, "glossary.appearsIn": es["glossary.appearsIn"] };
    expect(Object.keys(es).filter((key) => broken[key] === es[key])).toEqual(["glossary.appearsIn"]);
    expect(
      Object.entries(broken).filter(([, value]) => !/[а-яёА-ЯЁ]/.test(value))
    ).toHaveLength(1);
  });
});
