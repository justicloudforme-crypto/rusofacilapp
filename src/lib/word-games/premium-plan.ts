// Что сделал бы прогон `set-premium-only-word-games` — посчитанное
// отдельно от того, кто это пишет в базу.
//
// Зачем вынесено. Правило платности («верхние PREMIUM_SHARE лестницы по
// номеру рунга») договаривалось про лестницу, у которой хвост — самые
// трудные пазлы. Разгрузка филвордов (PROGRESS.md 7.78-7.83) дописывает
// в хвост НОВЫЕ строки — половинки разгруженных рунгов, — и лестница
// удлиняется снизу вверх по номеру, но не по трудности. Верхние 32%
// после этого — не те же строки, что были верхними до, и повторный
// прогон снял бы платность с живых пазлов, которые её уже отдают
// подписчикам.
//
// Отсюда правило, ради которого этот файл и существует: скрипт имеет
// право ДОБАВИТЬ платность, но не имеет права её СНЯТЬ. Снятие — это
// потеря доступа у людей, которые за него заплатили, и решение такого
// класса скрипт не принимает молча.
//
// Считается чистой функцией, чтобы позитивный контроль подсаживал
// ситуацию на входе, а не в боевой базе.

export interface PremiumPlanRow {
  id: string;
  sequence: number;
  premiumOnly: boolean;
}

export interface LadderPlan {
  type: string;
  level: string;
  /** Строки, которым прогон ПОСТАВИТ платность (false → true). */
  toPremium: PremiumPlanRow[];
  /** Строки, с которых прогон СНЯЛ БЫ платность (true → false). Именно
   * из-за них скрипт отказывается выполняться. */
  toFree: PremiumPlanRow[];
  /** Сколько строк в лестнице и сколько из них станут платными. */
  total: number;
  premiumCount: number;
}

/**
 * Доля лестницы, отдаваемая Premium. Значение договорное (PROGRESS.md,
 * раздел про три тарифа) и в этом заходе не менялось.
 */
export const PREMIUM_SHARE = 0.32;

/**
 * Что прогон сделал бы с одной лестницей (type, level).
 *
 * `rows` — все строки лестницы в любом порядке; сортировка по номеру
 * рунга делается здесь, чтобы вызывающий не мог её забыть.
 */
export function planLadder(
  type: string,
  level: string,
  rows: PremiumPlanRow[],
  share: number = PREMIUM_SHARE,
): LadderPlan {
  const sorted = [...rows].sort((a, b) => b.sequence - a.sequence);
  const premiumCount = Math.round(sorted.length * share);
  const premiumIds = new Set(sorted.slice(0, premiumCount).map((r) => r.id));

  const toPremium: PremiumPlanRow[] = [];
  const toFree: PremiumPlanRow[] = [];
  for (const row of sorted) {
    const shouldBePremium = premiumIds.has(row.id);
    if (row.premiumOnly === shouldBePremium) continue;
    (shouldBePremium ? toPremium : toFree).push(row);
  }
  return { type, level, toPremium, toFree, total: sorted.length, premiumCount: premiumIds.size };
}

/** Есть ли хоть одна строка, с которой прогон снял бы платность. */
export function wouldRemovePremium(plans: LadderPlan[]): boolean {
  return plans.some((p) => p.toFree.length > 0);
}
