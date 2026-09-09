/**
 * Чего требует единица содержимого — одним признаком на весь сайт.
 *
 * Зачем. 07.09.2026 человек показал скриншот: на карточке рассказа стоит
 * «⭐ Premium» у рассказа, который входит в ОБЫЧНУЮ подписку. Значок не
 * врал случайно — он печатался по колонке `Story.isPremium`, а та
 * означает «не бесплатный», а вовсе не «нужен план Premium». Числом по
 * боевой базе на 07.09.2026: `isPremium` истинно у 323 строк из 325, и
 * только у 98 из них содержимое действительно требует плана Premium
 * (`premiumOnly` или уровень C1). То есть **225 рассказов из 323**
 * носили слово Premium ни за что, а 98 носили ДВА значка сразу — «⭐
 * Premium» и «👑 Solo Premium».
 *
 * Рядом та же болезнь с другой стороны: на плитках филвордов корона
 * стоит только у `premiumOnly` и НЕ стоит у `curved` — а `curved` тоже
 * открывается только плану Premium (`canAccessCurvedPuzzle`). На проде
 * `curved` без `premiumOnly` сегодня 0 из 479, то есть корона не
 * пропадала — но это свойство ДАННЫХ, а не кода, и одна запись
 * генератора отменяет его молча (ровно тот довод, что записан в
 * `word-games/free-tier.ts` про `isPubliclyOpenableWordGamePuzzle`).
 *
 * Лечится тем же приёмом, каким в 7.110 вылечили бесплатность игровых
 * рунгов: платно ИМЕНЕМ ПРИЗНАКА, а не пересказом правила в четырёх
 * местах. Здесь признак — `AccessRequirement`, три значения, и каждая
 * поверхность спрашивает его, а не колонку.
 *
 * Модуль намеренно БЕЗ `server-only`: его зовут и клиентские компоненты
 * (`StoriesCatalog`, `WordGamesPicker`), и серверные страницы. Ровно по
 * той причине, по какой из `entitlement.ts` в своё время выделили
 * `free-tier.ts` и `free-trial-limits.ts`.
 */
import { isFreeWordGamePuzzle } from "./word-games/free-tier";
import { isFreeTrialLesson } from "./courses";

/** Что нужно, чтобы открыть эту единицу содержимого. */
export type AccessRequirement =
  /** Открыто всем, включая аноним и краулер. */
  | "free"
  /** Любая активная подписка (месячная, годовая или Premium). */
  | "subscription"
  /** Именно план Premium — «standard» сюда не проходит. */
  | "premium-tier";

/** Уровень тарифа посетителя — то же множество, что у `EntitlementTier`. */
export type ViewerTier = "free" | "standard" | "premium";

/**
 * Рассказ. Единственное место, где читаются обе колонки сразу.
 *
 * `premiumOnly` ИЛИ уровень C1 — план Premium (это правило уже живёт в
 * `getStoryAccess`/`canAccessLevel`, здесь оно не переписано, а
 * повторено ровно в той же форме и покрыто тестом на согласие с ним).
 */
export function storyRequirement(story: {
  level: string;
  isPremium: boolean;
  premiumOnly: boolean;
}): AccessRequirement {
  if (story.premiumOnly || story.level === "C1") return "premium-tier";
  return story.isPremium ? "subscription" : "free";
}

/**
 * Пазл. `curved` проверяется РЯДОМ с `premiumOnly`, а не вместо него:
 * страница пазла делает именно так (`row.curved || row.premiumOnly`), и
 * значок обязан говорить то же, что решает страница.
 */
export function wordGameRequirement(puzzle: {
  type: string;
  level: string;
  sequence: number;
  curved?: boolean | null;
  premiumOnly?: boolean | null;
}): AccessRequirement {
  if (puzzle.curved || puzzle.premiumOnly) return "premium-tier";
  return isFreeWordGamePuzzle(puzzle) ? "free" : "subscription";
}

/**
 * Карточка словаря. Уровень C1 — план Premium (то же правило, что у
 * `canAccessLevel`); всё остальное — подписка.
 *
 * «Подписка», а не «открыто»: бесплатный образец у карточек — это
 * `FREE_TRIAL_LIMITS.flashcards` штук на тему, то есть 230 карточек из
 * 5771 на 09.09.2026, и какие именно, решает ПОРЯДОК выдачи, а не
 * свойство строки. Значит про отдельную карточку «открыта всем» сказать
 * нельзя, и поле `free` у неё было бы враньём — ровно тем, из-за
 * которого поиск печатал 4783 карточки как открытые, когда открыто 230.
 * Кто попал в образец, знает только тот, кто режет список; здесь
 * известно лишь требование строки.
 */
export function flashcardRequirement(card: { level: string }): AccessRequirement {
  return card.level === "C1" ? "premium-tier" : "subscription";
}

/**
 * Идиома. `literary` закрыта сверх маленькой пробы даже подписчику
 * `standard` (`LITERARY_IDIOM_LIMITS`), то есть требует плана Premium;
 * остальные — подписки. Уровень C1 у идиом сегодня не встречается ни
 * разу (все 771 строки помечены A2, см. схему), но правило записано
 * рядом с остальными, а не «по данным».
 */
export function idiomRequirement(idiom: { level?: string | null; category?: string | null }): AccessRequirement {
  if (idiom.level === "C1" || idiom.category === "literary") return "premium-tier";
  return "subscription";
}

/**
 * Урок курса. Первый урок каждого уровня открыт целиком
 * (`isFreeTrialLesson`); у остальных грамматика видна всем, а словарь,
 * упражнения и слайды — по подписке. Слоя Premium у уроков нет.
 *
 * Признак зовёт `isFreeTrialLesson`, а не повторяет «lesson === "1"»:
 * это ровно тот приём, каким `wordGameRequirement` зовёт
 * `isFreeWordGamePuzzle`.
 */
export function lessonRequirement(lesson: { level: string; slug: string }): AccessRequirement {
  return isFreeTrialLesson(lesson.level, lesson.slug) ? "free" : "subscription";
}

/** Экзамен уровня. Открыт любому подписчику и никому больше
 * (`hasAnyAccess` на странице экзамена), слоя Premium нет. */
export function examRequirement(): AccessRequirement {
  return "subscription";
}

/** Медиа: бесплатная витрина против всего остального. Отдельного слоя Premium у медиа нет. */
export function mediaRequirement(item: { free?: boolean | null }): AccessRequirement {
  return item.free ? "free" : "subscription";
}

/** Хватает ли тарифа посетителя на это требование. */
export function meetsRequirement(requirement: AccessRequirement, tier: ViewerTier): boolean {
  if (requirement === "free") return true;
  if (requirement === "subscription") return tier !== "free";
  return tier === "premium";
}

/**
 * Что рисовать посетителю — и рисовать ли вообще.
 *
 * Правило одно на весь сайт и взято у каталога медиа, где оно уже стояло
 * и было верным: значок платности показывается тому, кто НЕ МОЖЕТ это
 * открыть. Подписчику, у которого доступ есть, значок сообщает ровно
 * ничего, а на карточке рассказа он вдобавок врал.
 */
export function accessMarkFor(requirement: AccessRequirement, tier: ViewerTier): Exclude<AccessRequirement, "free"> | null {
  if (meetsRequirement(requirement, tier)) return null;
  return requirement === "premium-tier" ? "premium-tier" : "subscription";
}

/**
 * Глиф значка. Один на признак, и написан здесь один раз.
 *
 * 🔒 — «нужна подписка» (тот же глиф, что уже стоял в каталоге медиа).
 * 👑 — «нужен план Premium» (тот же, что на плитках филвордов и на
 * карточке цены). ⭐ из этой роли выведена совсем: она обозначала
 * «Premium» там, где Premium не требовался.
 */
export const ACCESS_MARK_ICON: Record<Exclude<AccessRequirement, "free">, string> = {
  subscription: "🔒",
  "premium-tier": "👑",
};
