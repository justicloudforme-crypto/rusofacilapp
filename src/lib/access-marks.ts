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

/**
 * ====================================================================
 * ОДИН ЗНАК НА ВСЁ ПРИЛОЖЕНИЕ — 7.196, часть 1.
 * ====================================================================
 *
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ 14.09.2026 с живого телефона. Корона доехала до
 * словаря и до вкладки «Литературные», а до рассказов, игр и плиток тем —
 * нет: в каталоге рассказов на C1 короны не было, карточки рассказов C1
 * несли 🔒, на пазлах C1 замок стоял на каждой плитке и короны не было
 * нигде. По переписи 7.195 коронованных строк на проде 2255, а на экранах
 * корону видно у одной семьи из четырёх.
 *
 * ПОЧЕМУ ТАК ВЫХОДИЛО, СТРОКОЙ. Все эти поверхности звали `accessMarkFor`
 * выше, а он отвечает на ДРУГОЙ вопрос: «что мешает ЭТОМУ посетителю
 * открыть ЭТО». Ответ у него один на два разных знака, и оба следствия
 * были видны на экране:
 *
 *   * подписчику плана Premium он отдаёт `null` — то есть граница
 *     премиального материала человеку, который за неё и платит, не
 *     показывалась вовсе;
 *   * материалу, который требует ИМЕННО плана Premium, он отдаёт
 *     `"premium-tier"` только если посетителю не хватает плана, а
 *     `"subscription"` — никогда; но поверхность, спрашивавшая его про
 *     ДРУГОЙ признак (рассказ C1 → `storyRequirement` → `premium-tier`),
 *     всё равно печатала замок, потому что решала сама.
 *
 * ПРАВИЛО ВЛАДЕЛЬЦА, записанное здесь один раз и целиком:
 *
 *   👑 — СОРТ материала: «это премиум», то есть открыть его может только
 *        план Premium. Метка сорта, а не состояния: она стоит независимо
 *        от того, кто смотрит, потому что человек, который переплачивает
 *        за Premium, обязан по всему приложению одинаково видеть, за что
 *        именно он платит.
 *   🔒 — СОСТОЯНИЕ доступа: «в этой версии приложения не открыть», и
 *        премиальным сортом материал при этом не является.
 *   Сорт и закрытость вместе — побеждает корона.
 *   Ни того, ни другого — знака нет.
 *
 * Подписей ровно две пары, и обе приходят из словаря сайта:
 * `dict.access.premiumTierBadge` («Только Premium» / «Solo Premium») и
 * `dict.access.subscriptionBadge` («По подписке» / «Con suscripción»).
 * Текста здесь нет ни одного — он локаль-зависим; здесь только КЛЮЧ.
 *
 * В ВЕБЕ НЕ МЕНЯЕТСЯ НИЧЕГО. `nativeShell: false` возвращает ровно то,
 * что до этой правки возвращал `accessMarkFor`, знак в знак, и это
 * отдельное утверждение в `src/lib/access-marks.test.ts` и в стороже
 * `scripts/check-access-signs.mjs`.
 */
export interface AccessSign {
  /** Какой знак печатать. */
  mark: Exclude<AccessRequirement, "free">;
  /** Ключ подписи в `dict.access`. Строку берёт вызывающий. */
  labelKey: "premiumTierBadge" | "subscriptionBadge";
  /**
   * СОРТ НАЗВАН, А СОСТОЯНИЕ — ЕЩЁ НЕТ (долг 251, решение владельца
   * 18.09.2026).
   *
   * Правило владельца из шапки выше говорит «сорт и закрытость вместе —
   * побеждает корона», и до 18.09.2026 это означало, что второй знак не
   * печатается вовсе. Владелец снял с живого телефона, чем это было на
   * экране: аккаунт с доступом по коду (разряд `standard`) смотрит
   * филворды A1, на пазлах 166 и дальше стоит корона на тонированном
   * фоне — и ни одного знака того, что пазл ему не откроется. По боевой
   * базе 17.09.2026 таких пазлов **580 из 2015**.
   *
   * Решение владельца: знака два, и каждый отвечает за своё — 👑 говорит
   * ЧТО это за материал, 🔒 говорит, ОТКРЫТ ли он смотрящему. Поэтому
   * `mark` остаётся сортом (его читают все прежние поверхности, знак в
   * знак), а закрытость приезжает отдельным полем: поверхность, которая
   * про него не знает, ведёт себя ровно как раньше.
   *
   * `true` бывает ТОЛЬКО внутри оболочки и только у премиального сорта,
   * который этому посетителю закрыт: у Premium его нет никогда, в вебе —
   * тоже (там правило прежнее, `accessMarkFor`).
   */
  locked?: boolean;
}

/**
 * ТОЛЬКО СОРТ: 👑 у премиального материала, иначе ничего.
 *
 * Отдельная точка входа, а не второе правило: `accessSignFor` ниже
 * начинается ровно с этого вызова. Нужна там, где поверхность печатает
 * границу платного и В ВЕБЕ ТОЖЕ, независимо от роли, — сегодня это
 * полоса фильтра уровней словаря, которая так себя вела и до этой правки
 * (7.195, часть 4). Писать в ней `требование === "premium-tier"` руками
 * значило бы завести второе место, где живёт правило.
 */
export function sortSign(requirement: AccessRequirement): AccessSign | null {
  return requirement === "premium-tier" ? { mark: "premium-tier", labelKey: "premiumTierBadge" } : null;
}

export function accessSignFor(
  requirement: AccessRequirement,
  tier: ViewerTier,
  options: {
    /** Внутри приложения знак означает сорт; в вебе — прежнее поведение. */
    nativeShell: boolean;
    /**
     * Закрыт ли материал на самом деле, если поверхность знает это лучше
     * правила. Словарь знает: сверх требования уровня там режет ещё и
     * бесплатная проба (`FREE_TRIAL_LIMITS.flashcards` штук НА ТЕМУ), и
     * тема, в которой посетителю не отдано ни одной карточки, закрыта, хотя
     * `meetsRequirement` про неё говорит «хватает». Умолчание — само
     * правило.
     */
    closed?: boolean;
  },
): AccessSign | null {
  const closed = options.closed ?? !meetsRequirement(requirement, tier);
  if (!options.nativeShell) {
    const legacy = accessMarkFor(requirement, tier);
    if (!legacy) return null;
    return { mark: legacy, labelKey: legacy === "premium-tier" ? "premiumTierBadge" : "subscriptionBadge" };
  }
  // ДОЛГ 251. Сорт и состояние — два разных ответа, и оба обязаны
  // доехать: корона говорит «это премиум», замок — «вам не открыто».
  // Ветка «закрыто без сорта» осталась ровно прежней.
  const sort = sortSign(requirement);
  if (sort) return closed ? { ...sort, locked: true } : sort;
  return closed ? { mark: "subscription", labelKey: "subscriptionBadge" } : null;
}

/**
 * Требование ЦЕЛОГО УРОВНЯ для одной семьи материала — то, что печатает
 * полоса фильтра уровней (словарь, каталог рассказов, игры).
 *
 * Отдельная функция, а не `xxxRequirement({ level })` у вызывающего,
 * ровно потому, что семьи ОТЛИЧАЮТСЯ, и отличие это измерено, а не
 * предположено (замер 14.09.2026 по боевой базе):
 *
 *   карточки C1 — план Premium у всех 988 из 988 (`canAccessLevel`);
 *   рассказы C1 — план Premium у всех 65 из 65 (`getStoryAccess`);
 *   пазлы C1    — план Premium только у `curved`/`premiumOnly`: 138 из
 *                 482. Остальные **344 из 482 открывает обычная подписка
 *                 `standard`** (ворота страницы пазла смотрят
 *                 `row.curved || row.premiumOnly`, про уровень там нет ни
 *                 слова). Корона на полосе уровней игр была бы ровно тем
 *                 враньём, из-за которого в 7.137 сняли «⭐ Premium» с 225
 *                 рассказов: знак сорта у материала, который сорту не
 *                 принадлежит.
 *
 * Поэтому полоса уровня спрашивает семью по имени, а не «C1 значит
 * корона».
 */
export type LevelFamily = "flashcards" | "stories" | "wordGames";

export function levelRequirement(family: LevelFamily, level: string): AccessRequirement {
  if (family === "flashcards") return flashcardRequirement({ level });
  if (family === "stories") return level === "C1" ? "premium-tier" : "subscription";
  // Игры: уровень целиком премиальным не бывает — см. числа выше. Весь
  // уровень C1 при этом закрыт бесплатной пробе (`isFreeWordGamePuzzle`
  // исключает C1 целиком), и это состояние доступа, а не сорт.
  return "subscription";
}

/**
 * Открыт ли ХОТЬ ОДИН пазл этого уровня бесплатной пробе.
 *
 * Нужна полосе уровней игр: на C1 бесплатных рунгов нет ни одного
 * (`isFreeWordGamePuzzle` отвергает C1 до всякого номера), то есть для
 * гостя уровень закрыт ЦЕЛИКОМ — а на A1…B2 первые десять открыты, и
 * замка там быть не должно. Правило не пересказывается: оно просеивается
 * через ту же функцию, что решает на самой странице пазла.
 */
export function wordGameLevelHasFreePuzzle(type: string, level: string): boolean {
  for (let sequence = 1; sequence <= 10; sequence += 1) {
    if (isFreeWordGamePuzzle({ type, level, sequence })) return true;
  }
  return false;
}
