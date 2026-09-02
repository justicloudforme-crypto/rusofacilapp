// Отпечаток банка филвордов: чем один банк отличается от другого.
//
// Зачем он вообще. Снимок `docs/word-search-baseline-*.json` — сторож
// «пазл не имеет права стать хуже, чем он есть». Сторож сравнивает
// пазлы по ключу `WORD_SEARCH/<уровень>/<рунг>`, и до этого модуля он
// молча предполагал, что под одним ключом в снимке и в базе лежит ОДИН
// И ТОТ ЖЕ пазл. Предположение оказалось неверным: снимок был снят с
// локальной копии, а прогон шёл против прода, где под теми же номерами
// лежат другие пазлы. Сторож не сказал «это другой банк» — он сказал
// «918 пазлов стали хуже», то есть выдал 918 ложных регрессий и
// спрятал настоящий факт за отчётом о деградации.
//
// Отсюда правило: снимок несёт отпечаток банка, по которому он снят, и
// сравнение с базой начинается с отпечатка. Не совпал — прогон падает
// со словами «сравнение с другим банком» и НЕ печатает ни одной строки
// про «стало хуже»: сравнивать пазл с чужим тёзкой бессмысленно.
//
// Что входит в отпечаток. Хэш отсортированных id строк — этого одного
// достаточно (id это cuid, он уникален для каждой записи и не
// повторяется между двумя независимыми прогонами генератора), но
// одного хэша мало для ЧТЕНИЯ ошибки: «хэш не сошёлся» не говорит, что
// именно разошлось. Поэтому рядом лежат число строк и разбивка по
// уровням — по ним видно, банк ли это другой формы или той же формы,
// но из других строк.
import { createHash } from "node:crypto";

export interface BankFingerprint {
  /** Сколько строк WORD_SEARCH было в банке на момент снимка. */
  puzzles: number;
  /** Строк на уровень — форма банка, читаемая глазом. */
  byLevel: Record<string, number>;
  /** sha256 отсортированных id, через \n. Главный признак. */
  idsSha256: string;
}

export function bankFingerprint(rows: { id: string; level: string }[]): BankFingerprint {
  const byLevel: Record<string, number> = {};
  for (const r of rows) byLevel[r.level] = (byLevel[r.level] ?? 0) + 1;
  const ids = rows.map((r) => r.id).sort();
  return {
    puzzles: rows.length,
    byLevel: Object.fromEntries(Object.keys(byLevel).sort().map((k) => [k, byLevel[k]])),
    idsSha256: createHash("sha256").update(ids.join("\n")).digest("hex"),
  };
}

/**
 * Пусто — банк тот же. Иначе список читаемых расхождений, первое из
 * которых достаточно, чтобы остановить прогон.
 *
 * Порядок намеренный: сначала форма (число строк, уровни), потом хэш.
 * Форма объясняет «что», хэш доказывает «точно не тот же».
 */
export function fingerprintMismatch(snapshot: BankFingerprint, actual: BankFingerprint): string[] {
  const out: string[] = [];
  if (snapshot.puzzles !== actual.puzzles) {
    out.push(`строк WORD_SEARCH: в снимке ${snapshot.puzzles}, в базе ${actual.puzzles}`);
  }
  const levels = [...new Set([...Object.keys(snapshot.byLevel), ...Object.keys(actual.byLevel)])].sort();
  for (const level of levels) {
    const was = snapshot.byLevel[level] ?? 0;
    const now = actual.byLevel[level] ?? 0;
    if (was !== now) out.push(`${level}: в снимке ${was}, в базе ${now}`);
  }
  if (snapshot.idsSha256 !== actual.idsSha256) {
    out.push(
      `хэш отсортированных id: снимок ${snapshot.idsSha256.slice(0, 12)}…, база ${actual.idsSha256.slice(0, 12)}… ` +
        `— под одинаковыми номерами лежат другие строки`,
    );
  }
  return out;
}

/** Снимок целиком: отпечаток банка плюс замер каждого пазла. */
export interface BaselineFile<Entry> {
  /** Откуда снят — «prod»/хост Turso или «file:./dev.db». Только для
   * чтения человеком: сторож решает по отпечатку, а не по этой строке. */
  source: string;
  takenAt: string;
  bank: BankFingerprint;
  puzzles: Record<string, Entry>;
}

/** Снимок старого формата — плоская карта «ключ → замер», без
 * отпечатка. Такой снимок и дал 918 ложных «хуже»: он физически не
 * может отличить свой банк от чужого. Читается только для того, чтобы
 * сказать об этом внятно. */
export function isLegacyBaseline(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;
  return obj.bank === undefined || obj.puzzles === undefined;
}
