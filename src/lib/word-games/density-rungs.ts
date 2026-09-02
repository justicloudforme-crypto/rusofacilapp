// The twenty over-packed WORD_SEARCH rungs that prisma/redistribute-word-search.ts
// spreads across more grids, and the tail sequences the leftovers live in.
//
// ONE manifest, read by two scripts that must agree:
//
//  · prisma/redistribute-word-search.ts writes these rows (the data PR).
//  · prisma/generate-word-games.ts must NOT overwrite them on its next
//    full run, and must not delete the tail as "stale" either — its
//    cleanup pass deletes every sequence past the ladder's computed max,
//    and the tail is by construction past it.
//
// Why the rungs are pinned here rather than recomputed as "the worst ten"
// at run time: the redistribution runs against production, and a list
// that recomputes itself is a list nobody can review before it writes.
// The numbers below were measured on 2026-09-01 — see PROGRESS.md 7.77.
//
// Every entry is a PAID rung (sequence > 10) on purpose. The free rungs
// 1-10 are themed (topics.ts) and are the ones in sitemap.xml; splitting a
// themed rung would break the promise its title makes, and the tail rungs
// are all far past 10, so isFreeWordGamePuzzle stays exactly as it was and
// no new URL enters the sitemap.
import type { FlashcardLevel } from "@/lib/flashcards/types";

export interface DensitySplit {
  level: FlashcardLevel;
  /** The rung that is over-packed. Regenerated IN PLACE — same row id,
   * same URL, same WordGameProgress. */
  sequence: number;
  /** Total grids the words end up in, including the one above. */
  parts: number;
  /** Where the leftover parts go: `parts - 1` new rungs at the tail of
   * this level's WORD_SEARCH ladder. */
  tailSequences: number[];
}

/** Worst-first, by the severity in density.ts as measured on 2026-09-01.
 * Two rounds of ten; the second round's ordering caveat is at its head. */
export const DENSITY_SPLITS: readonly DensitySplit[] = [
  { level: "B2", sequence: 44, parts: 2, tailSequences: [328] },
  { level: "B2", sequence: 12, parts: 2, tailSequences: [329] },
  { level: "B2", sequence: 115, parts: 2, tailSequences: [330] },
  { level: "B1", sequence: 91, parts: 2, tailSequences: [563] },
  { level: "B2", sequence: 163, parts: 2, tailSequences: [331] },
  { level: "C1", sequence: 162, parts: 2, tailSequences: [241] },
  { level: "C1", sequence: 92, parts: 2, tailSequences: [242] },
  { level: "C1", sequence: 139, parts: 3, tailSequences: [243, 244] },
  { level: "B2", sequence: 65, parts: 2, tailSequences: [332] },
  { level: "B2", sequence: 164, parts: 2, tailSequences: [333] },

  // Второй десяток, замерено 02.09.2026 по тому же снимку — см.
  // PROGRESS.md 7.80 и docs/word-search-redistribute-round2-2026-09-01.md.
  //
  // Первым идёт B2/42, и это НЕ одиннадцатый по severity(): по тяжести он
  // 51-й, потому что severity складывает занятость с надбавкой за третье
  // и четвёртое слово на клетке, а B2/42 не кладёт на клетку больше двух.
  // Зато по чистой занятости он ПЕРВЫЙ во всём банке — 96,9%, восемь
  // клеток-заполнителей на всю сетку 16×16, плотнее любого из десяти уже
  // разгруженных. Ранжирование по тяжести отправило его вниз за девять
  // рунгов с перекрытием 3 и занятостью 92–94%; здесь он взят первым
  // сознательно, а вытеснённый им B2/137 (91,8%) ждёт следующего круга.
  { level: "B2", sequence: 42, parts: 3, tailSequences: [334, 335] },
  { level: "B2", sequence: 236, parts: 2, tailSequences: [336] },
  { level: "C1", sequence: 138, parts: 3, tailSequences: [245, 246] },
  { level: "B2", sequence: 237, parts: 2, tailSequences: [337] },
  { level: "C1", sequence: 165, parts: 2, tailSequences: [247] },
  { level: "C1", sequence: 161, parts: 2, tailSequences: [248] },
  { level: "B2", sequence: 43, parts: 3, tailSequences: [338, 339] },
  { level: "C1", sequence: 113, parts: 2, tailSequences: [249] },
  { level: "C1", sequence: 141, parts: 2, tailSequences: [250] },
  { level: "B2", sequence: 233, parts: 2, tailSequences: [340] },
];

/** How many sequences each level's WORD_SEARCH ladder gains beyond what
 * generate-word-games.ts itself writes. */
export function densityTailCount(level: string): number {
  return DENSITY_SPLITS.filter((s) => s.level === level).reduce((n, s) => n + s.tailSequences.length, 0);
}

/** True for a rung the redistribution owns — either a split source or one
 * of its tail rungs. generate-word-games.ts leaves both alone. */
export function isDensityOwnedRung(type: string, level: string, sequence: number): boolean {
  if (type !== "WORD_SEARCH") return false;
  return DENSITY_SPLITS.some(
    (s) => s.level === level && (s.sequence === sequence || s.tailSequences.includes(sequence)),
  );
}

export function findDensitySplit(level: string, sequence: number): DensitySplit | undefined {
  return DENSITY_SPLITS.find((s) => s.level === level && s.sequence === sequence);
}

/** Every tail sequence the manifest will create on one level, ascending. */
export function densityTails(level: string): number[] {
  return DENSITY_SPLITS.filter((s) => s.level === level)
    .flatMap((s) => s.tailSequences)
    .sort((a, b) => a - b);
}

/** Levels the manifest touches at all. */
export function densityLevels(): string[] {
  return [...new Set(DENSITY_SPLITS.map((s) => s.level))].sort();
}

/**
 * Why a gap in the ladder is a defect and not a cosmetic complaint.
 *
 * WordGamesPicker renders `Array.from({length: total}, (_, i) => i + 1)` —
 * it asks the database how MANY rows a (type, level) pair has and then
 * links sequences 1…count. It never asks WHICH sequences exist. So a
 * ladder of 333 rows numbered 1…332 plus 340 renders links 1…333: the
 * row at 340 is unreachable, and 333 is a link to a 404. Both halves of
 * that are silent — nothing throws, nothing logs.
 *
 * Every level's WORD_SEARCH ladder is contiguous 1…N today (verified over
 * all 1738 rows of the 2026-09-01 baseline), and the redistribution is
 * the first thing that ever appends rows by hand, so it is the first
 * thing that can break it. Hence this: given the sequences a level
 * already has plus the ones the manifest would add, the union must still
 * be exactly 1…N.
 */
export function ladderGaps(existing: number[], added: number[]): number[] {
  const all = new Set([...existing, ...added]);
  const max = Math.max(0, ...all);
  const gaps: number[] = [];
  for (let n = 1; n <= max; n++) if (!all.has(n)) gaps.push(n);
  return gaps;
}
