"use client";

import { usePaywall, type PaywallReason } from "@/contexts/PaywallContext";
import { useIsNativeShell } from "@/lib/native-shell-client";
import { nativeAccessCopy } from "@/lib/native-access-copy";
import { plural } from "@/lib/plural";
import type { Locale } from "@/i18n/config";
// Глиф платности берётся у ПРИЗНАКА, а не пишется здесь: на этом сайте
// он объявлен ровно в одном месте, и за этим следит `check:access-marks`.
import { ACCESS_MARK_ICON } from "@/lib/access-marks";

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
 * В ВЕБЕ НИЧЕГО НЕ МЕНЯЕТСЯ. `useIsNativeShell()` отвечает `false` и на
 * сервере, и на первом кадре, поэтому серверный HTML не меняется ни на
 * байт (доказано побайтовым сличением пяти страниц), а в браузере, где
 * ни куки, ни Capacitor нет, ветка не включается никогда.
 */

/** Единица счёта закрытого: слова словаря или выражения идиом. */
export type LockedUnit = "words" | "expressions";

/**
 * Честное «материал есть, и он закрыт» — замок, метка, число из базы.
 *
 * Ни цены, ни кнопки, ни ссылки. Число приходит из ответа сервера
 * (`lockedTotal` / `lockedByLevel`), то есть является разностью между тем,
 * что лежит в базе, и тем, что отдано; литералом его сюда вписать нельзя
 * по построению.
 */
export function NativeLockedNotice({
  locale,
  lockedTotal,
  level = null,
  unit,
}: {
  locale: Locale;
  lockedTotal: number;
  level?: string | null;
  unit: LockedUnit;
}) {
  const copy = nativeAccessCopy(locale).locked;
  const items = plural(locale, lockedTotal, unit === "words" ? copy.words : copy.expressions, {
    count: lockedTotal,
  });
  const line = (level ? copy.closedAtLevel.replace("{level}", level) : copy.closed).replace("{items}", items);

  return (
    <div className="mb-4 rounded-2xl border border-black/10 bg-foreground/[0.03] px-4 py-3 dark:border-white/30 dark:bg-white/[0.04]">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base leading-none">
          {ACCESS_MARK_ICON.subscription}
        </span>
        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-foreground/70">
          {copy.badge}
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
  unit,
}: {
  locale: Locale;
  emptyMessage: string;
  /** Сколько строк ПОД ЭТИМ ЖЕ фильтром закрыто. 0 — фильтр пуст честно. */
  lockedHere: number;
  level?: string | null;
  unit: LockedUnit;
}) {
  const nativeShell = useIsNativeShell();
  if (nativeShell && lockedHere > 0) {
    return <NativeLockedNotice locale={locale} lockedTotal={lockedHere} level={level} unit={unit} />;
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
  unit,
}: {
  message: string;
  cta: string;
  reason?: PaywallReason;
  locale: Locale;
  /** Число закрытого из ответа сервера. Внутри оболочки печатается вместо
   *  призыва; в вебе не читается вовсе. */
  lockedTotal: number;
  level?: string | null;
  unit: LockedUnit;
}) {
  // Оба хука зовутся безусловно и до любой ветки: порядок хуков не имеет
  // права зависеть от того, оболочка это или браузер.
  const { openPaywall } = usePaywall();
  const nativeShell = useIsNativeShell();

  if (nativeShell) {
    return <NativeLockedNotice locale={locale} lockedTotal={lockedTotal} level={level} unit={unit} />;
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 dark:border-primary-400/30 dark:bg-primary-400/10">
      <p className="text-sm text-foreground/80">{message}</p>
      <button
        type="button"
        onClick={() => openPaywall(reason)}
        className="tap shrink-0 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
      >
        {cta}
      </button>
    </div>
  );
}
