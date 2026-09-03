import Link from "next/link";
import type { FlashcardLevel } from "@/lib/flashcards";
import type { WordGameType } from "@/lib/word-games/types";
import { freeLadders } from "@/lib/word-games/free-index";

export interface FreePuzzleIndexDict {
  freeSampleTitle: string;
  freeSampleIntro: string;
  typeWordSearch: string;
  typeCrossword: string;
  puzzleLabel: string;
}

/**
 * A server-rendered list of every free puzzle, grouped by (type, level).
 *
 * Deliberately NOT part of WordGamesPicker: the picker is a client
 * component whose grid follows React state, so the server only ever emits
 * the links of its initial tab. Measured on production 02.09.2026, that
 * left 78 of the 160 free puzzle URLs with no inbound link from any
 * crawlable page — in the sitemap, allowed by robots.txt, serving a real
 * board to an anonymous visitor, and reachable by no link at all. See
 * src/lib/word-games/free-index.ts for the full measurement.
 *
 * It is also the honest thing on the page itself: the free sample is the
 * one part of the catalogue a visitor without an account can actually
 * play, and until now finding it meant guessing which tab hid it.
 */
export default function FreePuzzleIndex({
  lang,
  dict,
  available,
}: {
  lang: string;
  dict: FreePuzzleIndexDict;
  /** The free sequence numbers the bank really holds, per (type, level) —
   * see getFreeSequences in word-games/data.ts. */
  available: (type: WordGameType, level: FlashcardLevel) => Iterable<number> | undefined;
}) {
  const ladders = freeLadders(lang, available);
  if (ladders.length === 0) return null;

  return (
    <section className="mt-12 border-t border-black/10 pt-8 dark:border-white/30">
      <h2 className="text-xl font-semibold tracking-tight">{dict.freeSampleTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground/70">{dict.freeSampleIntro}</p>

      <div className="mt-6 flex flex-col gap-6">
        {ladders.map((ladder) => (
          <div key={`${ladder.type}:${ladder.level}`}>
            <h3 className="text-sm font-semibold text-foreground/70">
              {(ladder.type === "CROSSWORD" ? dict.typeCrossword : dict.typeWordSearch)} · {ladder.level}
            </h3>
            {/* A grid with declared tracks, not `flex flex-wrap`. The fill
                rule (scripts/layout-fill.mjs, PROGRESS.md 7.73/7.74)
                measures a wrapped row against the container and a last row
                holding one chip covered 10.7% of 720px — a real hole, and
                check:rendered caught it. Declared tracks make every full
                row cover the width, and a short ladder's partial row is
                skipped by the same rule instead of reading as a defect. */}
            <ul className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {ladder.rungs.map((rung) => (
                <li key={rung.sequence}>
                  <Link
                    href={rung.href}
                    aria-label={dict.puzzleLabel.replace("{n}", String(rung.sequence))}
                    className="tap flex min-h-11 w-full items-center justify-center rounded-xl border border-black/10 text-sm font-medium transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
                  >
                    {rung.sequence}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
