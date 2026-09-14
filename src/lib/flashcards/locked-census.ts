/**
 * СКОЛЬКО МАТЕРИАЛА ЗАКРЫТО — ОДНО ВЫЧИТАНИЕ НА ВЕСЬ СЛОВАРЬ.
 *
 * ПОЧЕМУ МОДУЛЬ ПОЯВИЛСЯ (заход 7.195, находка владельца 14.09.2026).
 *
 * Плашка внутри приложения писала «В этой версии приложения закрыто 8 слов
 * уровня C1», и владелец прочитал это как «во всём банке уровня C1 закрыто
 * восемь слов» — при 988 строках C1 в боевой базе. Замер показал, что
 * арифметика была верна, а СКАЗАНО было не то: восемь — это пересечение
 * (тема «Еда» × уровень C1), в боевой базе ровно 8 строк, а слово «тема» в
 * предложении не звучало вовсе. Число, посчитанное по пересечению, было
 * напечатано как число уровня.
 *
 * Отсюда устройство: вычитание живёт здесь одно, у него есть имя, и у
 * каждого числа, которое уезжает на экран, есть ровно один разрез. Разрез
 * называет вызывающий, и текст на экране обязан назвать тот же разрез
 * словами (`src/lib/native-access-copy.ts`, поле `closedAtLevelInTopic`).
 *
 * ПОЧЕМУ ЗДЕСЬ НЕТ `server-only` И НЕТ `canAccessLevel`. Правило доступа
 * приходит вызывающим как функция: так модуль остаётся проверяемым без
 * базы и без Next, ровно по тем же соображениям, по каким из
 * `entitlement.ts` в своё время выделили `free-trial-limits.ts`.
 *
 * НИ ОДНОГО ЛИТЕРАЛА-ЧИСЛА ПРО СОДЕРЖИМОЕ ЗДЕСЬ НЕТ И БЫТЬ НЕ МОЖЕТ: всё,
 * что возвращается, — разность между банком и отданным.
 */
import { FREE_TRIAL_LIMITS } from "../free-trial-limits";

/** Минимум, который нужен переписи от строки банка. */
export interface CensusCard {
  id: string;
  category: string;
  level: string;
}

export interface LockedCensus {
  lockedTotal: number;
  lockedByLevel: Record<string, number>;
}

/**
 * Сколько строк ПОД ЭТИМ ЖЕ фильтром лежит в банке и не ушло в ответ.
 *
 * Считается для любой роли: у подписчика разность честно равна нулю, и
 * отдельной ветки «а тут не считаем» здесь нет намеренно — ветка была бы
 * вторым местом, где живёт правило доступа.
 */
export function lockedCensus(
  bank: readonly CensusCard[],
  shown: readonly CensusCard[],
  filter: { category: string | null; level: string | null },
): LockedCensus {
  const shownIds = new Set(shown.map((card) => card.id));
  const lockedByLevel: Record<string, number> = {};
  let lockedTotal = 0;
  for (const card of bank) {
    if (filter.category && card.category !== filter.category) continue;
    if (filter.level && card.level !== filter.level) continue;
    if (shownIds.has(card.id)) continue;
    lockedByLevel[card.level] = (lockedByLevel[card.level] ?? 0) + 1;
    lockedTotal += 1;
  }
  return { lockedTotal, lockedByLevel };
}

/**
 * Какие карточки этот посетитель может открыть ВООБЩЕ — по всему банку.
 *
 * Повторяет ровно то, что делает `GET /api/flashcards` на своих запросах, и
 * повторяет намеренно: сетка тем спрашивает про весь банк сразу, а список
 * карточек — про одну тему, но правило выдачи у них обязано быть одно.
 * Бесплатная проба берётся ПО ТЕМЕ (`FREE_TRIAL_LIMITS.flashcards` штук на
 * тему), потому что человек и открывает её по теме; глобальная «первая
 * десятка банка» дала бы число, которого на экране не увидит никто.
 */
export function openCardIds(
  bank: readonly CensusCard[],
  options: { entitled: boolean; canAccessLevel: (level: string) => boolean },
): Set<string> {
  const open = new Set<string>();
  const byCategory = new Map<string, CensusCard[]>();
  for (const card of bank) {
    if (!options.canAccessLevel(card.level)) continue;
    const list = byCategory.get(card.category);
    if (list) list.push(card);
    else byCategory.set(card.category, [card]);
  }
  for (const list of byCategory.values()) {
    const take = options.entitled ? list : list.slice(0, FREE_TRIAL_LIMITS.flashcards);
    for (const card of take) open.add(card.id);
  }
  return open;
}

export interface CensusRow {
  /** Сколько строк лежит в банке под этим разрезом. */
  bank: number;
  /** Сколько из них этот посетитель может открыть. */
  open: number;
  /** Разность. Именно она печатается человеку. */
  locked: number;
}

export interface SiteCensus {
  /** По уровням — весь банк, без фильтра темы. */
  byLevel: Record<string, CensusRow>;
  /** По темам — под ТЕМ уровнем, о котором спросили (`null` — все уровни). */
  byCategory: Record<string, CensusRow>;
  /** Итог по всему банку. */
  total: CensusRow;
}

/**
 * Перепись всего банка сразу: по уровням и по темам.
 *
 * `level` сужает только разрез по темам — разрез по уровням обязан
 * оставаться полным, иначе плашка на выбранном уровне не смогла бы назвать
 * число этого уровня, не сделав второго запроса.
 */
export function siteCensus(
  bank: readonly CensusCard[],
  options: { entitled: boolean; canAccessLevel: (level: string) => boolean; level: string | null },
): SiteCensus {
  const open = openCardIds(bank, options);
  const byLevel: Record<string, CensusRow> = {};
  const byCategory: Record<string, CensusRow> = {};
  const total: CensusRow = { bank: 0, open: 0, locked: 0 };

  const bump = (row: CensusRow, isOpen: boolean) => {
    row.bank += 1;
    if (isOpen) row.open += 1;
    else row.locked += 1;
  };

  for (const card of bank) {
    const isOpen = open.has(card.id);
    bump((byLevel[card.level] ??= { bank: 0, open: 0, locked: 0 }), isOpen);
    bump(total, isOpen);
    if (options.level && card.level !== options.level) continue;
    bump((byCategory[card.category] ??= { bank: 0, open: 0, locked: 0 }), isOpen);
  }
  return { byLevel, byCategory, total };
}
