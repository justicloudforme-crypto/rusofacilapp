"use client";

import { useEffect, useState, type ElementType, type ReactNode } from "react";
import type { GlossaryTermData } from "./GlossaryApp";
import GlossaryTermPopover from "./GlossaryTermPopover";
import { getCachedGlossaryTerms, loadGlossaryTerms } from "@/lib/glossary-client";
import { escapeRegExp } from "@/lib/regex";

interface Matcher {
  pattern: RegExp;
  bySurface: Map<string, GlossaryTermData>;
}

let cachedMatcher: Matcher | null = null;
let cachedMatcherTerms: GlossaryTermData[] | null = null;

/** Builds one alternation regex from every term, longest surface form
 * first, so "adverbio de lugar" wins over the shorter "adverbio" when both
 * would otherwise match at the same position. Rebuilt only when the term
 * list identity changes (i.e. once, after the first successful fetch). */
function getMatcher(terms: GlossaryTermData[]): Matcher | null {
  if (terms.length === 0) return null;
  if (cachedMatcher && cachedMatcherTerms === terms) return cachedMatcher;

  const bySurface = new Map<string, GlossaryTermData>();
  for (const t of terms) bySurface.set(t.term.toLowerCase(), t);

  const alternatives = [...bySurface.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  if (alternatives.length === 0) return null;

  // \p{L} (Unicode letter) rather than \w, so the boundary check also
  // works right against accented Spanish letters (á, ñ...) at the edges.
  const pattern = new RegExp(`(?<![\\p{L}])(${alternatives.join("|")})(?![\\p{L}])`, "giu");
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
    const full = match[0];
    const start = match.index;
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

  return <Tag className={className}>{terms ? linkify(text, terms) : text}</Tag>;
}
