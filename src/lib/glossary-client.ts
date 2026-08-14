"use client";

import type { GlossaryTermData } from "@/components/glossary/GlossaryApp";

/**
 * Module-level cache for the full glossary term list, shared by every
 * GlossaryText instance on a page. A lesson page can render dozens of
 * paragraphs (grammar + slides), each of which needs the term list to know
 * what to auto-link — without this, that would be one fetch per paragraph
 * instead of one fetch per page.
 */
let cachedTerms: GlossaryTermData[] | null = null;
let cachedPromise: Promise<GlossaryTermData[]> | null = null;

export function loadGlossaryTerms(): Promise<GlossaryTermData[]> {
  if (cachedTerms) return Promise.resolve(cachedTerms);
  if (!cachedPromise) {
    cachedPromise = fetch("/api/glossary")
      .then((res) => (res.ok ? res.json() : { terms: [] }))
      .then((body: { terms?: GlossaryTermData[] }) => {
        cachedTerms = body.terms ?? [];
        return cachedTerms;
      })
      .catch(() => {
        cachedTerms = [];
        return cachedTerms;
      });
  }
  return cachedPromise;
}

export function getCachedGlossaryTerms(): GlossaryTermData[] | null {
  return cachedTerms;
}

/** Whether the student has already discovered that highlighted grammar
 * terms are clickable — either by dismissing GlossaryHint, or (a stronger
 * signal) by actually clicking a real term. Once true, GlossaryHint never
 * shows again on this device. Plain localStorage rather than a DB field:
 * this is a one-time onboarding nudge, not data worth syncing across
 * devices or surviving a cleared browser profile. */
export const GLOSSARY_DISCOVERED_KEY = "rusofasil:glossary-discovered";

export function markGlossaryDiscovered() {
  try {
    localStorage.setItem(GLOSSARY_DISCOVERED_KEY, "1");
  } catch {
    // Private browsing / storage disabled — the hint just shows again next
    // time, which is harmless.
  }
}

export function isGlossaryDiscovered(): boolean {
  try {
    return localStorage.getItem(GLOSSARY_DISCOVERED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Per-term progress tracking (distinct from GLOSSARY_DISCOVERED_KEY above,
 * which only tracks whether the *mechanism* has been discovered once).
 * Two tiers, deliberately kept as separate sets rather than one status enum
 * so "mastered" is always a subset check against "seen", not a migration:
 *  - "seen": the term's card has been opened at least once (lesson popover,
 *    lesson-terms chip list, or a quiz question) — the "12/29 vistos" count.
 *  - "mastered": a stronger signal — answered correctly in the quiz — the
 *    "5/29 dominados" count and what the /courses level badge checks. */
const GLOSSARY_SEEN_TERMS_KEY = "rusofasil:glossary-seen-terms";
const GLOSSARY_MASTERED_TERMS_KEY = "rusofasil:glossary-mastered-terms";
export const GLOSSARY_SEEN_CHANGE_EVENT = "rusofasil:glossary-seen-change";

function readSlugSet(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function addToSlugSet(key: string, slug: string) {
  try {
    const slugs = readSlugSet(key);
    if (slugs.includes(slug)) return;
    slugs.push(slug);
    localStorage.setItem(key, JSON.stringify(slugs));
    window.dispatchEvent(new Event(GLOSSARY_SEEN_CHANGE_EVENT));
  } catch {
    // Private browsing / storage disabled — progress just won't persist.
  }
}

export function markTermSeen(slug: string) {
  addToSlugSet(GLOSSARY_SEEN_TERMS_KEY, slug);
}

export function markTermMastered(slug: string) {
  // Mastering implies having seen it — keep both sets consistent so a
  // "mastered" term never fails a "seen" check.
  addToSlugSet(GLOSSARY_SEEN_TERMS_KEY, slug);
  addToSlugSet(GLOSSARY_MASTERED_TERMS_KEY, slug);
}

export function getSeenTermCount(): number {
  return readSlugSet(GLOSSARY_SEEN_TERMS_KEY).length;
}

export function getMasteredTermCount(): number {
  return readSlugSet(GLOSSARY_MASTERED_TERMS_KEY).length;
}

export function getMasteredTermSlugs(): string[] {
  return readSlugSet(GLOSSARY_MASTERED_TERMS_KEY);
}

/** Fired (with the opening popover's own id in `detail`) whenever a
 * GlossaryTermPopover/GlossaryTermTooltip opens, so every other instance on
 * the page can close itself. Without this, hovering/tapping across several
 * nearby terms (e.g. the lesson term-chip list, or a paragraph with
 * multiple linked words close together) leaves multiple ~320px-wide cards
 * open on screen at once, visually overlapping — which reads exactly like
 * "definitions from different terms are mixed together" even though each
 * card's own content is correct. Only one card may be open at a time. */
export const GLOSSARY_POPOVER_OPEN_EVENT = "rusofasil:glossary-popover-open";

export function broadcastPopoverOpen(id: string) {
  window.dispatchEvent(new CustomEvent(GLOSSARY_POPOVER_OPEN_EVENT, { detail: { id } }));
}
