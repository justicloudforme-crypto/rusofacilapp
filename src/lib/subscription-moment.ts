/**
 * МОМЕНТ, ПОКАЗАННЫЙ ЧЕЛОВЕКУ, И МОМЕНТ РЕАЛЬНОГО ЗАКРЫТИЯ — ОДНО И ТО ЖЕ.
 *
 * ====================================================================
 * ТРИ ЧИСЛА, КОТОРЫЕ КАЗАЛИСЬ ПРОТИВОРЕЧИЕМ (замер 15.09.2026)
 * ====================================================================
 *
 * Владелец снял на телефоне «Vence el 19 de septiembre de 2026», в
 * отчёте 7.196 было записано «18 сентября», а подсадка даты показывала,
 * что 18.09 23:00 UTC доступ ещё есть, а 19.09 — уже нет.
 *
 * Противоречия нет. Это ОДИН момент, отрисованный в трёх часовых поясах:
 *
 *   строка боевой базы  `currentPeriodEnd = 2026-09-18T23:47:02.000Z`
 *   `User.timezone`     `Asia/Vladivostok` (UTC+10) — это телефон владельца
 *
 *   UTC              → 18 de septiembre de 2026, 23:47   (замер 7.196)
 *   Asia/Vladivostok → 19 de septiembre de 2026, 09:47   (экран владельца)
 *
 * История платежей подтверждает то же самое той же арифметикой:
 * `createdAt = 2026-08-18T23:47:10.300Z` — это «18 de agosto» в UTC и
 * «19 de agosto» во Владивостоке, а на экране стояло 19-е.
 *
 * ====================================================================
 * ЧТО ПРИ ЭТОМ БЫЛО ДЕФЕКТОМ — И ОНО ОДНО
 * ====================================================================
 *
 * Экран печатал ДЕНЬ, а доступ кончается в МОМЕНТ. «Vence el 19 de
 * septiembre» человек читает как «весь 19-е мой», а доступ закрывается
 * 19-го в 09:47. Между обещанным и настоящим — **14 ч 13 мин**, и это
 * ровно те часы, в которые человек открывает приложение, видит на
 * вкладке «Suscripción» дату сегодняшнего числа и закрытый материал.
 *
 * Плюс вторая половина, из-за которой три числа и разъехались по
 * отчётам: день считал БРАУЗЕР после гидратации
 * (`components/profile/LocalDate.tsx`), а сервер до неё печатал UTC.
 * То есть на одном и том же экране день сперва был 18-й, а через
 * мгновение 19-й — в зависимости от того, чей это был кадр.
 *
 * ====================================================================
 * ПРАВИЛО
 * ====================================================================
 *
 * Момент печатается ЦЕЛИКОМ — день, час и пояс, — и считается он на
 * сервере в поясе самого человека (`getRequestTimeZone`: колонка
 * `User.timezone`, потом кука, потом заголовок Vercel, потом UTC).
 * Тогда:
 *
 *   * показанный момент равен моменту закрытия с точностью до минуты;
 *   * сервер и браузер печатают одно и то же — мигания дня нет;
 *   * `/ru` и `/es` называют один день по построению: пояс и момент у
 *     них общие, разная только запись.
 *
 * Серверных импортов здесь нет намеренно: этот модуль читает сторож
 * `scripts/check-subscription-wording.ts`, который гоняется под `tsx`
 * вне разрешения модулей Next — ровно по той же причине, по которой из
 * `subscription.ts` вынесли `subscription-status.ts`.
 */
import { dateKeyIn, isValidTimeZone, DEFAULT_TIME_ZONE } from "./timezone";

export interface SubscriptionMoment {
  /** Календарный день момента В ПОЯСЕ ЧЕЛОВЕКА, «YYYY-MM-DD». Это то же
   *  число, что называет экран, и то же, в которое закрывается доступ. */
  dayKey: string;
  /** Час и минута того же момента в том же поясе, «ЧЧ:ММ». */
  timeOfDay: string;
  /** Пояс, в котором всё посчитано. */
  timeZone: string;
  /** Готовая строка для экрана: день, час и пояс. */
  text: string;
}

/** Час и минута момента в поясе — двумя цифрами, без локальных причуд
 *  вроде «a. m.»: это половина сличения «экран против закрытия», и она
 *  обязана быть сравнимой, а не красивой. */
function timeOfDayIn(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  // en-GB отдаёт «24» вместо «00» для полуночи на части движков — это
  // тот же момент, но сравнивать такие строки нельзя.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${hour}:${get("minute")}`;
}

export function subscriptionMoment(iso: string, locale: string, timeZone: string): SubscriptionMoment {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const at = new Date(iso);
  const text = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  }).format(at);
  return {
    dayKey: dateKeyIn(at, zone),
    timeOfDay: timeOfDayIn(at, zone),
    timeZone: zone,
    text,
  };
}

/** Короткая форма для тех мест, где нужна только строка. */
export function subscriptionMomentText(iso: string, locale: string, timeZone: string): string {
  return subscriptionMoment(iso, locale, timeZone).text;
}
