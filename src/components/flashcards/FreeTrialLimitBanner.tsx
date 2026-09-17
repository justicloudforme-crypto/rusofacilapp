"use client";

import { usePaywall, type PaywallReason } from "@/contexts/PaywallContext";
import { useIsNativeShell } from "@/lib/native-shell-client";
import { nativeAccessCopy } from "@/lib/native-access-copy";
import { plural } from "@/lib/plural";
import type { Locale } from "@/i18n/config";
// Глиф платности берётся у ПРИЗНАКА, а не пишется здесь: на этом сайте
// он объявлен ровно в одном месте, и за этим следит `check:access-marks`.
import { ACCESS_MARK_ICON, accessSignFor, type AccessRequirement } from "@/lib/access-marks";

/**
 * ЕДИНСТВЕННАЯ ТОЧКА, ГДЕ СЛОВАРЬ И ИДИОМЫ ГОВОРЯТ ПРО ЗАКРЫТОЕ.
 *
 * ЧТО ЗДЕСЬ БЫЛО И ПОЧЕМУ ЭТО НЕ УВИДЕЛ НИ ОДИН ЗАМЕР (долг 191).
 *
 * Владелец нашёл на живом телефоне, под ГОСТЁМ, внутри оболочки кнопку
 * «Оформить подписку» — в словаре и в идиомах. Заход 7.193 за день до
 * этого отчитался «0 форм, 0 цен, 0 ссылок» по 66 ответам, и ветка на
 * оболочку была тут ни при чём: её здесь не было вовсе.
 *
 * Сторож промахнулся не адресом. `/ru/vocabulary` и `/es/vocabulary` в
 * его списке СТОЯЛИ (строки 557-558 прежней редакции). Промахнулся он
 * тремя вещами сразу, и каждая мерится числом:
 *
 *   1. КНОПКА БЕЗ АДРЕСА. Здесь стоял `<button onClick={openPaywall}>` —
 *      ни `href`, ни формы. Счётчик ссылок на страницу цен видел 0, и
 *      видел правильно: ссылки нет.
 *   2. ПОДПИСЬ НЕ В СПИСКЕ. Подписи платных кнопок сторож брал из
 *      рукописного списка на 15 ключей словаря; `vocabulary.freeTrialLimitCta`
 *      и `vocabulary.idioms.freeTrialLimitCta` в него не входили — 0 из 2.
 *   3. И ГЛАВНОЕ: ЭТОЙ КНОПКИ НЕТ В ОТВЕТЕ СЕРВЕРА. Замер: в сыром HTML
 *      `/ru/vocabulary` строка «Оформить подписку» встречается 4 раза
 *      (внутри flight-разметки, потому что словарь уезжает целиком), а в
 *      ВИДИМОМ документе, по которому судил сторож, — 0 раз. Кнопку
 *      рисует клиент, и только после того, как `/api/flashcards` ответит
 *      `limited: true`, то есть после ОДНОГО нажатия на плитку темы.
 *      Замер браузером: на открытии страницы платных органов 0, после
 *      нажатия — 1.
 *
 * Отсюда устройство правки: ветка живёт не у пяти вызывающих, а ЗДЕСЬ,
 * в одном компоненте, через который проходят все пять (четыре режима
 * словаря и список идиом). Одно место — одно правило.
 *
 * ЧТО ИЗ ЭТОГО ОСТАЛОСЬ ВЕТКОЙ ОБОЛОЧКИ, А ЧТО СТАЛО ОБЩИМ (долг 259,
 * 18.09.2026). Веткой оболочки остался ПРИЗЫВ: покупок внутри приложения
 * нет, и `FreeTrialLimitBanner` ниже по-прежнему подменяет кнопку
 * «Оформить подписку» честной плашкой замка — за этим стоит
 * `check:native-payments`. А `LockedOrEmpty`, у которого никакого призыва
 * нет и не было, теперь показывает честную причину и в браузере: «карточки
 * есть, и они закрыты» — правда одинаковая в обоих местах.
 */

/** Единица счёта закрытого: слова словаря или выражения идиом. */
export type LockedUnit = "words" | "expressions";

/**
 * ДВА ЗНАКА, И КАЖДЫЙ НА СВОЁМ МЕСТЕ — 7.195, часть 4.
 *
 * 👑 — сорт материала: «нужен план Premium». Метка, а не орган управления:
 * ничего не предлагает купить, никуда не ведёт, нажатием не является.
 * 🔒 — состояние доступа: «сейчас не открыть».
 *
 * Признак берётся у `src/lib/access-marks.ts`, а не решается здесь: там же
 * его спрашивают каталоги рассказов, филвордов, медиа и поиск. До правки
 * плашка печатала 🔒 всегда — и на уровне C1, который на всех остальных
 * экранах носит корону. Один и тот же материал носил два разных знака.
 */
function signOf(requirement: AccessRequirement) {
  // Плашка печатается только там, где материал ЗАКРЫТ (её и рисуют по
  // ненулевому числу закрытого), поэтому закрытость названа прямо, а не
  // выведена из тарифа: тарифа этот компонент не знает и знать не должен.
  return accessSignFor(requirement, "free", { nativeShell: true, closed: true })!;
}

/**
 * Честное «материал есть, и он закрыт» — знак, метка, число из базы.
 *
 * Ни цены, ни кнопки, ни ссылки. Число приходит из ответа сервера
 * (`lockedTotal` / `lockedByLevel`), то есть является разностью между тем,
 * что лежит в базе, и тем, что отдано; литералом его сюда вписать нельзя
 * по построению.
 *
 * РАЗРЕЗ ЧИСЛА ЗВУЧИТ СЛОВАМИ. Если число посчитано по пересечению
 * «уровень × тема», предложение называет и уровень, и тему: ровно из-за
 * молчания про тему «8 слов темы Еда» было прочитано как «8 слов уровня
 * C1» при 988 строках C1 в базе (7.195, часть 2).
 */
export function NativeLockedNotice({
  locale,
  lockedTotal,
  level = null,
  topic = null,
  unit,
  requirement = "subscription",
}: {
  locale: Locale;
  lockedTotal: number;
  level?: string | null;
  /** Название темы человеку — уже из словаря локали, здесь не собирается. */
  topic?: string | null;
  unit: LockedUnit;
  /** Что нужно, чтобы это открыть. Решает, какой знак стоит на плашке. */
  requirement?: AccessRequirement;
}) {
  const copy = nativeAccessCopy(locale).locked;
  const items = plural(locale, lockedTotal, unit === "words" ? copy.words : copy.expressions, {
    count: lockedTotal,
  });
  const template = topic
    ? level
      ? copy.closedAtLevelInTopic
      : copy.closedInTopic
    : level
      ? copy.closedAtLevel
      : copy.closed;
  const line = template
    .replace("{level}", level ?? "")
    .replace("{topic}", topic ?? "")
    .replace("{items}", items);
  const sign = signOf(requirement);
  const badge = sign.labelKey === "premiumTierBadge" ? copy.badgePremium : copy.badge;

  return (
    <div
      data-testid="native-locked-notice"
      className="mb-4 rounded-2xl border border-black/10 bg-foreground/[0.03] px-4 py-3 dark:border-white/30 dark:bg-white/[0.04]"
    >
      <div className="flex items-center gap-2">
        {/* Один регистр на весь сайт: `uppercase` здесь стоял и давал
            «ПО ПОДПИСКЕ» там, где `AccessMark` печатает «По подписке»
            (7.195, часть 4). Метка помечена `data-access-mark`, чтобы
            сторож отрисованных поверхностей считал её меткой, а не
            подписью органа управления. */}
        <span data-access-mark={sign.mark} className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2.5 py-1 text-xs font-medium text-foreground/70">
          <span aria-hidden>{ACCESS_MARK_ICON[sign.mark]}</span>
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-foreground/80">{line}</p>
      <p className="mt-1 text-sm leading-6 text-foreground/60">{copy.rest}</p>
    </div>
  );
}

/**
 * Пустой экран фильтра — но только когда он честно пуст.
 *
 * До правки словарь под гостем на уровнях B2 и C1 писал «Нет карточек для
 * этого фильтра», и это было неправдой: карточки есть. Механика промаха
 * измерена и она клиентская — сервер отдаёт первые 10 карточек темы (проба
 * без уровня), а уровень накладывает уже браузер (`FlashcardsApp`, `cards`
 * через `useMemo`), и в пробе из десяти карточек уровня B2 обычно нет ни
 * одной. То есть «пусто» на экране означало «пусто в пробе», а не «пусто в
 * банке».
 */
export function LockedOrEmpty({
  locale,
  emptyMessage,
  lockedHere,
  level = null,
  topic = null,
  unit,
  requirement = "subscription",
  noticeAbove = false,
}: {
  locale: Locale;
  emptyMessage: string;
  /** Сколько строк ПОД ЭТИМ ЖЕ фильтром закрыто. 0 — фильтр пуст честно. */
  lockedHere: number;
  level?: string | null;
  topic?: string | null;
  unit: LockedUnit;
  requirement?: AccessRequirement;
  /**
   * ПЛАШКА НА ЭКРАНЕ ОДНА — 7.195, часть 1.
   *
   * Владелец снял с живого телефона две одинаковые плашки подряд в
   * словаре на уровне C1. Причина — не копия разметки, а два независимых
   * условия, которые на этом экране истинны ОБА:
   * `limited` (ответ сервера — проба, а не весь банк) рисует плашку
   * сверху, а `!card` (клиентский фильтр уровня выбросил все десять
   * карточек пробы) рисует её же здесь. По отдельности каждое условие
   * верно; вместе они печатали одно и то же дважды.
   *
   * Правило записано в одном месте — здесь: если плашка уже стоит выше,
   * второй нет, и пустого текста «Нет карточек для этого фильтра» тоже
   * нет (он противоречил бы плашке над ним).
   */
  noticeAbove?: boolean;
}) {
  /**
   * ЧЕСТНАЯ ПРИЧИНА ВИДНА И В БРАУЗЕРЕ — ДОЛГ 259, 18.09.2026.
   *
   * ЧТО БЫЛО. Ветка звучала `nativeShell && lockedHere > 0`, то есть
   * человек в браузере читал «Нет карточек для этого фильтра» / «No hay
   * tarjetas para este filtro» там, где карточки ЕСТЬ и закрыты. Замер
   * 18.09.2026 на прод-сборке, 32 экрана (две роли × оболочка/браузер ×
   * две локали × четыре режима словаря, уровень C1, вход в тему): текст,
   * прячущий причину, печатали 24 экрана из 32; честную плашку показывали
   * 8 — и все восемь внутри оболочки.
   *
   * Ветки оболочки у самой ПРИЧИНЫ здесь больше нет: правило одно на оба
   * места, как и у сетки тем (долг 257). Признак оболочки остался ровно у
   * одного — у `noticeAbove`, см. ниже.
   */
  const nativeShell = useIsNativeShell();
  if (lockedHere > 0) {
    /**
     * `noticeAbove` СПРАШИВАЕТ ПРО ОБОЛОЧКУ, И ТОЛЬКО ОН.
     *
     * Флаг означает «плашка замка УЖЕ стоит выше», и стоит она там только
     * внутри приложения: в браузере `FreeTrialLimitBanner` рисует на том
     * же месте призыв с кнопкой, а не плашку. Без этого уточнения правка
     * долга 259 в браузере не показала бы на пустом экране ВООБЩЕ ничего —
     * ни причины, ни прежнего текста.
     */
    if (noticeAbove && nativeShell) return null;
    return (
      <NativeLockedNotice
        locale={locale}
        lockedTotal={lockedHere}
        level={level}
        topic={topic}
        unit={unit}
        requirement={requirement}
      />
    );
  }
  return (
    <p className="rounded-2xl border border-black/10 p-10 text-center text-sm text-foreground/60 dark:border-white/30">
      {emptyMessage}
    </p>
  );
}

/** Shown wherever a flashcard/idiom fetch comes back `limited: true` — the
 * visitor is on the free trial sample (FREE_TRIAL_LIMITS in entitlement.ts)
 * rather than the full set. Also reused for the "literary" idiom
 * category's own tier cap (see getLiteraryIdiomLimit in entitlement.ts),
 * which can apply to an already-subscribed "standard" visitor — pass
 * `reason: "premium"` for that case so the paywall emphasizes the
 * lifetime plan specifically rather than "free" (any plan). */
export default function FreeTrialLimitBanner({
  message,
  cta,
  reason = "free",
  locale,
  lockedTotal,
  level = null,
  topic = null,
  unit,
  requirement = "subscription",
  noticeAbove = false,
}: {
  message: string;
  cta: string;
  reason?: PaywallReason;
  locale: Locale;
  /** Число закрытого из ответа сервера. Внутри оболочки печатается вместо
   *  призыва; в вебе не читается вовсе. */
  lockedTotal: number;
  level?: string | null;
  topic?: string | null;
  unit: LockedUnit;
  requirement?: AccessRequirement;
  /**
   * ПЛАШКА ОДНА — НО ТОЛЬКО ВНУТРИ ОБОЛОЧКИ (7.195, часть 1).
   *
   * В ВЕБЕ соседние предупреждения этого компонента говорят РАЗНОЕ: общий
   * предел пробы, ссылка на закрытое выражение, слой Premium у категории
   * `literary`. Их три, и все три законны — первая редакция правки свела
   * их в одну цепочку `? :` и тем убрала со страницы сообщение
   * «…se abre con la suscripción», на котором стоит
   * `e2e/search-deep-link.spec.ts` (поймано CI, не рассуждением).
   *
   * Внутри оболочки все три превращаются в ОДНУ и ту же плашку замка, и
   * вот её повтор и был находкой владельца. Поэтому признак проверяется
   * здесь, где уже известно, оболочка это или браузер: в вебе флаг не
   * читается вовсе.
   */
  noticeAbove?: boolean;
}) {
  // Оба хука зовутся безусловно и до любой ветки: порядок хуков не имеет
  // права зависеть от того, оболочка это или браузер.
  const { openPaywall } = usePaywall();
  const nativeShell = useIsNativeShell();

  if (nativeShell) {
    if (noticeAbove) return null;
    return (
      <NativeLockedNotice
        locale={locale}
        lockedTotal={lockedTotal}
        level={level}
        topic={topic}
        unit={unit}
        requirement={requirement}
      />
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 dark:border-primary-400/30 dark:bg-primary-400/10">
      <p className="text-sm text-foreground/80">{message}</p>
      <button
        type="button"
        onClick={() => openPaywall(reason, unit === "expressions" ? "idiom" : "flashcard")}
        className="tap shrink-0 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
      >
        {cta}
      </button>
    </div>
  );
}
