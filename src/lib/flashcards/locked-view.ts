/**
 * ЧТО ИМЕННО ПОКАЗЫВАЕТ ПЛАШКА ЗАКРЫТОГО — ОДНО ПРАВИЛО НА ЧЕТЫРЕ РЕЖИМА.
 *
 * Режимов словаря четыре (карточки, припоминание, пропуски, сопоставление),
 * и до 7.195 каждый собирал разрез плашки у себя: три строки, повторённые
 * четыре раза. Ровно из-за этого разрез числа и разрез предложения
 * разошлись — число считалось по пересечению «уровень × тема», а
 * предложение называло только уровень.
 *
 * Здесь оба разреза собираются вместе и вместе же уезжают в плашку.
 */
import { flashcardRequirement, type AccessRequirement } from "../access-marks";

export interface LockedView {
  /** Сколько закрыто ПОД ТЕКУЩИМ фильтром. Число из ответа сервера. */
  lockedHere: number;
  /** Уровень, если он выбран. */
  level: string | null;
  /** Название темы человеку, если тема выбрана. */
  topic: string | null;
  /** Какой знак ставить: 👑 (план Premium) или 🔒 (подписка). */
  requirement: AccessRequirement;
}

export function lockedView({
  levelFilter,
  categoryLabel,
  lockedTotal,
  lockedByLevel,
}: {
  levelFilter: string;
  /** Уже переведённое название темы или `null`, если тема не выбрана. */
  categoryLabel: string | null;
  lockedTotal: number;
  lockedByLevel: Record<string, number>;
}): LockedView {
  const level = levelFilter === "all" ? null : levelFilter;
  return {
    lockedHere: level === null ? lockedTotal : (lockedByLevel[level] ?? 0),
    level,
    topic: categoryLabel,
    // При «ВСЕ» в выборке лежат и C1, и остальные уровни, то есть сорт
    // материала не один; тогда знак — состояние доступа, 🔒. Как только
    // уровень назван, сорт известен и его называет признак.
    requirement: level === null ? "subscription" : flashcardRequirement({ level }),
  };
}
