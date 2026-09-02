// Какой дефект у перегруженного рунга — и потому в какую работу он идёт.
//
// Зачем разделять. «Двадцать худших по тяжести» смешивает два разных
// дефекта в один список, а лечатся они по-разному:
//
//  · ЗАНЯТОСТЬ выше медианы банка — рунгу тесно: слова занимают почти
//    все клетки, заполнителей мало, прятать слова негде. Лечится
//    разгрузкой: те же слова раскладываются по большему числу сеток.
//
//  · ПЕРЕКРЫТИЕ ≥ 3 при занятости НЕ выше медианы — рунгу не тесно, у
//    него локальный узел: укладчик свалил три-четыре слова на одну
//    клетку, хотя места в сетке было полно. Разгрузка здесь лечит не то
//    место — она разнесёт по сеткам слова, которым и в одной не тесно, а
//    узел соберётся заново при следующей укладке. Это класс РАЗМЕЩЕНИЯ:
//    потолок слов на клетку в tryPlaceWord, отдельная работа.
//
// Поэтому: рунг класса размещения в разгрузку не берётся, вместо него
// берётся следующий по тяжести. Медиана считается по всему банку, а не
// по уровню: порог занятости в density.ts тоже общий, и рунг, который
// плотнее половины всего банка, тесен независимо от того, на каком он
// уровне.
import { worstFirst, severity } from "./density";
import type { PuzzleAudit } from "./word-search-audit";

export type RungClass =
  /** Тесно: занятость выше медианы банка. Идёт в разгрузку. */
  | "разгрузка"
  /** Узел: ≥3 слов на клетке при занятости не выше медианы. Потолок в
   * tryPlaceWord, в разгрузку НЕ берётся. */
  | "размещение"
  /** Ни то, ни другое. */
  | "здоров";

export function medianOccupancy(audits: Pick<PuzzleAudit, "occupancy">[]): number {
  if (audits.length === 0) return 0;
  const sorted = audits.map((a) => a.occupancy).sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function classifyRung(
  a: Pick<PuzzleAudit, "occupancy" | "maxOverlap">,
  median: number,
): RungClass {
  if (a.occupancy > median) return "разгрузка";
  if (a.maxOverlap >= 3) return "размещение";
  return "здоров";
}

export interface ClassifiedRung {
  audit: PuzzleAudit;
  rank: number;
  severity: number;
  klass: RungClass;
}

export interface SplitSelection {
  median: number;
  /** Ровно `count` рунгов класса «разгрузка», худшие первыми. */
  chosen: ClassifiedRung[];
  /** Рунги, которых тяжесть подняла в верх списка, но класс отправил в
   * другую работу — их места заняли следующие по тяжести. */
  skipped: ClassifiedRung[];
}

/**
 * Двадцать (или сколько попросят) худших ПО ТЯЖЕСТИ, из которых взяты
 * только те, чей класс — разгрузка. Пропущенные не теряются: они
 * возвращаются отдельным списком, потому что «его вытеснили» — это
 * решение, а не побочный эффект сортировки.
 */
export function selectSplits(audits: PuzzleAudit[], count: number): SplitSelection {
  const median = medianOccupancy(audits);
  const chosen: ClassifiedRung[] = [];
  const skipped: ClassifiedRung[] = [];
  worstFirst(audits).forEach((audit, i) => {
    if (chosen.length >= count) return;
    const entry: ClassifiedRung = {
      audit,
      rank: i + 1,
      severity: severity(audit),
      klass: classifyRung(audit, median),
    };
    if (entry.klass === "разгрузка") chosen.push(entry);
    else skipped.push(entry);
  });
  return { median, chosen, skipped };
}
