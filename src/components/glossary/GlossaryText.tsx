"use client";

import { useEffect, useState, type ElementType, type ReactNode } from "react";
import type { GlossaryTermData } from "./GlossaryApp";
import GlossaryTermPopover from "./GlossaryTermPopover";
import HighlightBoundary from "./HighlightBoundary";
import { getCachedGlossaryTerms, loadGlossaryTerms } from "@/lib/glossary-client";
import { GLOSSARY_TERM_GROUP, buildGlossaryPattern } from "@/lib/glossary-pattern";

interface Matcher {
  pattern: RegExp;
  bySurface: Map<string, GlossaryTermData>;
}

let cachedMatcher: Matcher | null = null;
let cachedMatcherTerms: GlossaryTermData[] | null = null;

/** Builds one alternation regex from every term, longest surface form
 * first, so "adverbio de lugar" wins over the shorter "adverbio" when both
 * would otherwise match at the same position. Rebuilt only when the term
 * list identity changes (i.e. once, after the first successful fetch).
 *
 * Сборка выражения живёт в `src/lib/glossary-pattern.ts` — там же
 * записано, почему граница слова слева пишется группой `(^|[^\p{L}])`, а
 * не просмотром назад `(?<![\p{L}])`, который не собирается ни в одном
 * браузере на iOS до 16.4. Возврат `null` при неудаче — прежний:
 * выражение собирается из 119 строк правимого из админки содержимого, и
 * одна плохая строка не должна стоить читателю страницу. */
function getMatcher(terms: GlossaryTermData[]): Matcher | null {
  if (terms.length === 0) return null;
  if (cachedMatcher && cachedMatcherTerms === terms) return cachedMatcher;

  const bySurface = new Map<string, GlossaryTermData>();
  for (const t of terms) bySurface.set(t.term.toLowerCase(), t);

  const pattern = buildGlossaryPattern([...bySurface.keys()]);
  if (!pattern) return null;

  cachedMatcher = { pattern, bySurface };
  cachedMatcherTerms = terms;
  return cachedMatcher;
}

/** Splits `text` into plain-string and <GlossaryTermPopover> fragments.
 * Only the FIRST occurrence of each term is linked — a paragraph that says
 * "sustantivo" five times doesn't need five identical clickable words,
 * that's just visual noise (same convention Wikipedia uses for inline
 * links). */
function linkify(text: string, terms: GlossaryTermData[]): ReactNode {
  const matcher = getMatcher(terms);
  if (!matcher) return text;

  const { pattern, bySurface } = matcher;
  pattern.lastIndex = 0;

  const seen = new Set<string>();
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    // Группа 1 — граница слева (начало строки или один не-буквенный
    // знак). Она съедена совпадением, но текстом остаётся: смещение
    // термина считается от неё, и сам знак уезжает в предыдущий кусок
    // обычного текста ниже.
    const full = match[GLOSSARY_TERM_GROUP];
    const start = match.index + match[1].length;
    const surface = full.toLowerCase();
    const data = bySurface.get(surface);

    if (!data || seen.has(surface)) {
      // Not a real match (shouldn't happen) or already linked once in this
      // text — leave this occurrence as plain text.
      continue;
    }
    seen.add(surface);

    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    parts.push(
      <GlossaryTermPopover key={`glossary-${key++}`} term={data}>
        {full}
      </GlossaryTermPopover>
    );
    lastIndex = start + full.length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/** Отдельный компонент, а не тело `GlossaryText`, ровно ради границы
 * ошибок: разбор и отрисовка ссылок обязаны падать ВНУТРИ
 * `HighlightBoundary`, иначе граница поймала бы только то, что случилось
 * у детей, а не саму подсветку. */
function Linkified({ text, terms }: { text: string; terms: GlossaryTermData[] }) {
  return <>{linkify(text, terms)}</>;
}

/** Drop-in replacement for rendering a plain string of lesson prose that
 * auto-detects and links any grammar term from the glossary (sustantivo,
 * adjetivo, adverbio de lugar...) — see src/lib/glossary-client.ts for the
 * shared term-list cache this relies on. Falls back to plain text before
 * the glossary has loaded and if it's empty/unreachable, so lesson prose
 * never waits on this to render. */
export default function GlossaryText({
  text,
  as = "p",
  className,
}: {
  text: string;
  as?: ElementType;
  className?: string;
}) {
  const [terms, setTerms] = useState<GlossaryTermData[] | null>(getCachedGlossaryTerms());
  const Tag = as;

  useEffect(() => {
    if (terms) return;
    let alive = true;
    loadGlossaryTerms().then((loaded) => {
      if (alive) setTerms(loaded);
    });
    return () => {
      alive = false;
    };
  }, [terms]);

  return (
    <Tag className={className}>
      {terms ? (
        <HighlightBoundary fallback={text}>
          <Linkified text={text} terms={terms} />
        </HighlightBoundary>
      ) : (
        text
      )}
    </Tag>
  );
}
