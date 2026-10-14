/**
 * ДИАГНОСТИКА ПОКУПКИ ВНУТРИ ПРИЛОЖЕНИЯ — ЗАХОД 7.264.
 *
 * Зачем. Первую настоящую покупку (13.10.2026) разбирали по видео с
 * чужого телефона: журнала устройства нет, секунды считались по кадрам, а
 * время вебхука — по боевой базе. Каждый следующий вопрос «почему замки
 * висели» требовал бы новой покупки и нового видео. Теперь каждая покупка
 * сама сообщает в Sentry, сколько заняли её отрезки.
 *
 * ТРИ СОБЫТИЯ, НЕ БОЛЬШЕ ТРЁХ НА ПОКУПКУ (имена — как их искать в Sentry):
 *
 *   * `NativePurchaseTiming` (info) — одно на покупку, итог:
 *     `outcome` = success | error | timeout, у ошибки — `code`
 *     («RC-BUY-…»). В `extra` — миллисекунды:
 *       - `ms_tap_to_store`    — нажатие тарифа → магазин ответил «куплено»;
 *       - `ms_store_to_server` — «куплено» → сервер назвал новый уровень
 *         (меньше нуля — сервер узнал раньше, чем магазин ответил);
 *       - `ms_server_to_hidden`    — сервер назвал → замков на экране не видно;
 *       - `ms_server_to_refreshed` — сервер назвал → страница перерисована
 *         без замков (их нет в разметке, а не только не видно).
 *   * `NativePurchaseAccessLate` (warning) — магазин сказал «куплено», а
 *     сервер не открыл доступ за 15 с.
 *   * `NativeStoreAlreadyOwned` (info, заход 7.265) — магазин ответил
 *     «уже куплено» (RC-BUY-6); метка `resolution` — чем кончилось:
 *     already-open | moved | other-account | not-found | error. Это не
 *     сбой, поэтому НЕ `NativeStorePurchaseFailed` (NEXTJS-1A, warning).
 *   * `NativePurchaseStateConflict` (warning) — на экране дольше 500 мс
 *     держались противоречащие состояния: шапка подписки «Activa» или
 *     «Activando…», а верхняя строка «Accesos y pagos» — «Expirada»
 *     (долг 359), или видимые замки после того, как сервер открыл доступ.
 *
 * ЛИЧНЫХ ДАННЫХ НЕТ. Ни почты, ни имени: учётку событие несёт так же, как
 * любое другое событие сайта, — внутренним идентификатором из
 * `SentryUser` (`Sentry.setUser({ id })`). Здесь добавляются только
 * платформа и версия оболочки из её же метки в User-Agent.
 *
 * Отправка — через `send`: в примерах подменяется, в приложении это
 * `Sentry.captureMessage`. Локально и в e2e Sentry выключен
 * (`mayReportToProductionSentry`), поэтому настоящая отправка проверяется
 * отдельной сборкой с включённым SDK и перехватом туннеля `/monitoring`.
 */
import * as Sentry from "@sentry/nextjs";
import { NATIVE_SHELL_UA_TOKEN } from "@/lib/shell-tag";

export const ACCESS_LATE_MS = 15_000;
export const CONFLICT_MS = 500;
/** Сколько после ответа сервера ждать, пока замки уйдут с экрана. */
export const UNLOCK_WATCH_MS = 15_000;
const CHECK_EVERY_MS = 100;
/** Пока окно Google открыто, следить есть за чем: шапка и история. */
const PURCHASE_TICK_MS = 5 * 60_000;

export type PurchaseOutcome = "success" | "error" | "timeout" | "already_owned";

export interface TelemetrySend {
  (name: string, level: "info" | "warning", tags: Record<string, string>, extra: Record<string, number | string | boolean>): void;
}

const sentrySend: TelemetrySend = (name, level, tags, extra) => {
  Sentry.captureMessage(name, {
    level,
    tags: { area: "native-purchase", ...tags },
    extra,
    fingerprint: [name],
  });
};

export interface TelemetryDeps {
  send: TelemetrySend;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  /** Замки на экране: сколько в разметке и сколько из них видно. */
  readLocks: (tier: string) => { present: number; visible: number };
  /** Шапка подписки и верхняя строка истории — для правила 359. */
  readProfile: () => { badge: string | null; topRow: string | null; updating: boolean };
  platform: () => string;
  shellVersion: () => string;
}

function lockSelector(tier: string): string {
  // Подписка (standard) снимает только «🔒 Con suscripción»; Premium —
  // и её, и «👑».
  return tier === "premium" ? "[data-access-mark]" : '[data-access-mark="subscription"]';
}

const realDeps: TelemetryDeps = {
  send: sentrySend,
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  readLocks: (tier) => {
    if (typeof document === "undefined") return { present: 0, visible: 0 };
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(lockSelector(tier)));
    return { present: nodes.length, visible: nodes.filter((n) => n.getClientRects().length > 0).length };
  },
  readProfile: () => {
    if (typeof document === "undefined") return { badge: null, topRow: null, updating: false };
    const badge = document.querySelector("[data-rf-sub-badge]")?.getAttribute("data-rf-sub-badge") ?? null;
    const topRow = document.querySelector("[data-rf-sub-row]")?.getAttribute("data-rf-sub-row") ?? null;
    const updating = document.querySelector("[data-testid=payment-history-updating]") !== null;
    return { badge, topRow, updating };
  },
  platform: () => {
    const cap = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    return cap?.getPlatform?.() ?? "web";
  },
  shellVersion: () => {
    // Без регулярки из константы (правило `data-into-parser.test.ts`):
    // токен ищется строкой, номер — цифрами сразу после «/».
    const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
    const at = ua.indexOf(`${NATIVE_SHELL_UA_TOKEN}/`);
    if (at === -1) return "unknown";
    const digits = /^\d+/.exec(ua.slice(at + NATIVE_SHELL_UA_TOKEN.length + 1));
    return digits ? digits[0] : "unknown";
  },
};

let deps: TelemetryDeps = realDeps;

interface Flight {
  tapAt: number;
  storeAt: number | null;
  serverAt: number | null;
  tier: string | null;
  hiddenAt: number | null;
  refreshedAt: number | null;
  locksAtServer: number | null;
  lateTimer: unknown;
  finished: boolean;
  lateSent: boolean;
}

let flight: Flight | null = null;
let conflictSent = false;
let conflictSince: number | null = null;
let conflictKind = "";
let ticker: unknown = null;
let tickUntil = 0;

function baseTags(): Record<string, string> {
  return { platform: deps.platform(), shell_version: deps.shellVersion() };
}

function ms(a: number | null, b: number | null): number | string {
  return a === null || b === null ? "n/a" : Math.round(b - a);
}

function finish(outcome: PurchaseOutcome, code?: string): void {
  const f = flight;
  if (!f || f.finished) return;
  f.finished = true;
  if (f.lateTimer !== null) deps.clearTimer(f.lateTimer);
  const tags: Record<string, string> = { ...baseTags(), outcome };
  if (code) tags.code = code;
  deps.send("NativePurchaseTiming", "info", tags, {
    ms_tap_to_store: ms(f.tapAt, f.storeAt),
    ms_store_to_server: ms(f.storeAt, f.serverAt),
    ms_server_to_hidden: ms(f.serverAt, f.hiddenAt),
    ms_server_to_refreshed: ms(f.serverAt, f.refreshedAt),
    locks_at_server: f.locksAtServer ?? "n/a",
  });
}

/** Каждые 100 мс, пока идёт покупка и 15 с после ответа сервера. */
function tick(): void {
  ticker = null;
  const t = deps.now();
  const f = flight;

  if (f && f.serverAt !== null && f.tier && !f.finished) {
    const locks = deps.readLocks(f.tier);
    if (f.locksAtServer === null) f.locksAtServer = locks.present;
    if (f.hiddenAt === null && locks.visible === 0) f.hiddenAt = t;
    if (f.refreshedAt === null && locks.present === 0) f.refreshedAt = t;
    if (f.hiddenAt !== null && f.refreshedAt !== null) finish("success");
    else if (t - f.serverAt >= UNLOCK_WATCH_MS) finish("success");
  }

  // Противоречие на экране — правило одно на два случая.
  let kind = "";
  const profile = deps.readProfile();
  if (
    (profile.badge === "active" || profile.badge === "activating") &&
    profile.topRow === "expired" &&
    !profile.updating
  ) {
    kind = `badge-${profile.badge}+history-expired`;
  } else if (f && f.serverAt !== null && f.tier && deps.readLocks(f.tier).visible > 0 && t - f.serverAt > CONFLICT_MS) {
    kind = "granted+locks-visible";
  }
  if (kind) {
    if (conflictSince === null || conflictKind !== kind) {
      conflictSince = t;
      conflictKind = kind;
    } else if (!conflictSent && t - conflictSince >= CONFLICT_MS) {
      conflictSent = true;
      deps.send("NativePurchaseStateConflict", "warning", { ...baseTags(), conflict: kind }, {
        ms_held: Math.round(t - conflictSince),
      });
    }
  } else {
    conflictSince = null;
    conflictKind = "";
  }

  if (t < tickUntil) ticker = deps.setTimer(tick, CHECK_EVERY_MS);
}

function keepTicking(forMs: number): void {
  tickUntil = Math.max(tickUntil, deps.now() + forMs);
  if (ticker === null) ticker = deps.setTimer(tick, CHECK_EVERY_MS);
}

/** Нажат тариф. Новая покупка начинает новый отсчёт. */
export function purchaseTapped(): void {
  flight = {
    tapAt: deps.now(),
    storeAt: null,
    serverAt: null,
    tier: null,
    hiddenAt: null,
    refreshedAt: null,
    locksAtServer: null,
    lateTimer: null,
    finished: false,
    lateSent: false,
  };
  conflictSent = false;
  conflictSince = null;
  keepTicking(PURCHASE_TICK_MS);
}

/** Магазин ответил «куплено». С этого мига идут 15 с до «доступ опоздал». */
export function storeConfirmed(): void {
  const f = flight;
  if (!f || f.finished) return;
  f.storeAt = deps.now();
  if (f.serverAt !== null) return;
  f.lateTimer = deps.setTimer(() => {
    if (!f.finished && f.serverAt === null && !f.lateSent) {
      f.lateSent = true;
      deps.send("NativePurchaseAccessLate", "warning", baseTags(), {
        ms_waited: Math.round(deps.now() - (f.storeAt ?? f.tapAt)),
      });
    }
  }, ACCESS_LATE_MS);
}

/** Сервер назвал новый уровень доступа. */
export function serverConfirmed(tier: string): void {
  const f = flight;
  if (!f || f.finished || f.serverAt !== null) return;
  f.serverAt = deps.now();
  f.tier = tier;
  if (f.lateTimer !== null) deps.clearTimer(f.lateTimer);
  keepTicking(UNLOCK_WATCH_MS + 1_000);
}

/** Магазин отказал с кодом. Отмена человеком — не событие. */
export function purchaseFailed(code: string): void {
  finish("error", code);
}

/** Магазин ответил «уже куплено» (RC-BUY-6) — итог покупки, не ошибка. */
export function purchaseAlreadyOwned(): void {
  finish("already_owned", "RC-BUY-6");
}

export type AlreadyOwnedResolution = "already-open" | "moved" | "other-account" | "not-found" | "error";

/** Чем кончился разговор «уже куплено» — одно событие уровня info. */
export function alreadyOwnedResolved(resolution: AlreadyOwnedResolution): void {
  deps.send("NativeStoreAlreadyOwned", "info", { ...baseTags(), code: "RC-BUY-6", resolution }, {});
}

/** 30 с ожидания доступа истекли без ответа сервера. */
export function accessTimedOut(): void {
  finish("timeout");
}

/** Человек сам закрыл лист Google — отсчёт снимается без события. */
export function purchaseCancelled(): void {
  const f = flight;
  if (f && f.lateTimer !== null) deps.clearTimer(f.lateTimer);
  flight = null;
  tickUntil = deps.now();
}

/** Только для примеров. */
export function setTelemetryDepsForTests(next: Partial<TelemetryDeps> | null): void {
  deps = next ? { ...realDeps, ...next } : realDeps;
  flight = null;
  conflictSent = false;
  conflictSince = null;
  conflictKind = "";
  if (ticker !== null) realDeps.clearTimer(ticker);
  ticker = null;
  tickUntil = 0;
}
