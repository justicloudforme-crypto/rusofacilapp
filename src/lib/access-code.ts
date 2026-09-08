import "server-only";
import { db } from "./db";
import { extendOrGrantSubscription } from "./subscription";
import { getEntitlementTierFor } from "./entitlement";
import { normalizeAccessCode } from "./access-code-format";

/**
 * Коды доступа для первых учеников (PROGRESS.md 7.146).
 *
 * ГЛАВНОЕ СВОЙСТВО ЭТОГО ФАЙЛА, и оно же — единственная причина читать его
 * целиком: **код не выдаёт доступ сам**. Он вызывает
 * `extendOrGrantSubscription` — ту же функцию, которой пользуются вебхук
 * Stripe, ручная выдача администратора и реферальные дни, — и та кладёт
 * обычную строку `Subscription`. Дальше человек виден единой точке решения
 * `tierOfAccount` (src/lib/entitlement.ts) ровно потому, что у него есть
 * живая строка, а не потому, что где-то стоит флаг.
 *
 * Второго пути к доступу здесь нет и быть не должно: 7.145 свёл десять мест
 * принятия решения к одному, и «флаг `hasAccessCode` на `User`» или «маршрут,
 * который смотрит в AccessCode вместо Subscription» вернули бы ровно ту
 * болезнь. Держится это тремя вещами:
 *
 *   1. `AccessCode` не участвует в решении о доступе — ни здесь, ни где-либо
 *      ещё; правило доступа в эту таблицу не смотрит вовсе;
 *   2. выдача идёт единственным вызовом `extendOrGrantSubscription`;
 *   3. сторож `npm run check:access-code-path` падает, если это перестанет
 *      быть правдой.
 */

/** Уровни, которые код умеет выдавать. Ровно один, и это не заготовка на
 * будущее: Premium стоит 2 299 MXN и через код не раздаётся. Строка с любым
 * другим значением `tier` не выдаёт НИЧЕГО (см. redeemAccessCode) — вместо
 * того чтобы угадывать, что имел в виду тот, кто её положил. */
export const ACCESS_CODE_TIERS = ["standard"] as const;
export type AccessCodeTier = (typeof ACCESS_CODE_TIERS)[number];

/** Какой `Subscription.plan` пишется за каждый уровень.
 *
 * "manual" — та же строка, которой помечает свою выдачу администратор
 * (`/api/admin/subscriptions/grant`), и это осознанно: источник ручной, срок
 * свой, к Stripe отношения не имеет, а `tierOfStoredSubscription` читает её
 * как `standard`, потому что `isPremiumPlan("manual")` — ложь. Premium в этой
 * таблице отсутствует, поэтому выдать его кодом нельзя даже опечаткой. */
export const ACCESS_CODE_PLAN: Record<AccessCodeTier, string> = { standard: "manual" };

export function isAccessCodeTier(value: string): value is AccessCodeTier {
  return (ACCESS_CODE_TIERS as readonly string[]).includes(value);
}

/** Срок доступа по умолчанию — совпадает с `@default(90)` в схеме. Написан
 * здесь ещё раз затем, что скрипт выпуска партии печатает его человеку до
 * того, как что-либо запишет. */
export const DEFAULT_ACCESS_CODE_DAYS = 90;

/** Форма кода — алфавит и нормализация — живёт в `access-code-format.ts`,
 * не помеченном `server-only`, потому что ту же нормализацию обязан
 * применять скрипт выпуска партии под `tsx`. Здесь она только
 * перевыставлена, чтобы у читателя этого файла всё было под рукой. */
export { ACCESS_CODE_ALPHABET, normalizeAccessCode } from "./access-code-format";

/** Почему погашение не состоялось. Ровно пять причин, у каждой свой текст на
 * экране: человеку, у которого код не сработал, «ошибка» не говорит ничего. */
export type AccessCodeRefusal =
  | "unknown"
  | "already_redeemed"
  | "expired"
  | "revoked"
  | "already_has_access";

export type RedeemResult =
  | { ok: true; days: number; tier: AccessCodeTier }
  | { ok: false; reason: AccessCodeRefusal };

/**
 * Сообщает отказ в Sentry с тегом.
 *
 * Отказы — не исключения, и падать на них нельзя: «код уже погашен» это
 * нормальная жизнь. Но их частота — единственное, по чему видно, что партия
 * разошлась не так, как задумано (коды утекли, срок годности выставлен
 * короче, чем шла рассылка), поэтому они помечаются тегом и считаются.
 *
 * Никогда не бросает: отчёт о проблеме не должен становиться второй
 * проблемой.
 */
async function reportRefusal(reason: AccessCodeRefusal, context: { userId: string; code: string }) {
  try {
    const error = new Error(`Access code refused: ${reason}`);
    error.name = "AccessCodeRefused";
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, {
      level: "info",
      tags: { area: "access-code", refusal: reason },
      // Сам код — не секрет уровня пароля, но это платёжный по сути
      // предмет; в отчёт уходит только его длина и партия, если строка
      // нашлась, а не значение.
      extra: { userId: context.userId, codeLength: context.code.length },
    });
  } catch {
    // Молча: см. выше.
  }
}

/**
 * Погашение кода вошедшим пользователем.
 *
 * ПОРЯДОК ШАГОВ ЗДЕСЬ — ЧАСТЬ ПОВЕДЕНИЯ, а не деталь реализации.
 *
 * 1. Сначала спрашиваем единую точку решения, есть ли у человека доступ
 *    СЕЙЧАС. Если есть — отказ до того, как код израсходован: сжечь
 *    одноразовый код за доступ, который у человека и так был, значит
 *    потерять его насовсем. (Персонал по правилу 7.145 всегда `premium`,
 *    поэтому и ему код не погасится — то же следствие, что у долга 87.)
 *
 * 2. Потом — ОДИН условный UPDATE, который и есть одноразовость.
 *    `updateMany` с условием «не погашен, не отозван, не просрочен» и
 *    проверкой числа затронутых строк: база сама решает, кто из двух
 *    одновременных запросов победил, и проигравший видит `count === 0`.
 *    Прочитать строку, убедиться, что она свободна, и потом записать —
 *    значит оставить окно между чтением и записью ровно того размера, в
 *    которое пролезает второй запрос; сценарий
 *    `scripts/scenarios/access-code.scenario.ts` бьёт по этому месту двумя
 *    одновременными погашениями и требует ровно одного успешного.
 *
 * 3. И только после того, как строка кода стала нашей, выдаём доступ —
 *    единственным вызовом `extendOrGrantSubscription`.
 *
 * Разбор причины отказа делается ЧТЕНИЕМ ПОСЛЕ неудавшегося UPDATE. Это
 * чтение ничего не решает: решение уже принято числом затронутых строк, а
 * чтение лишь объясняет человеку, что произошло.
 */
export async function redeemAccessCode(
  user: { id: string; role: string },
  rawCode: string
): Promise<RedeemResult> {
  const code = normalizeAccessCode(rawCode);
  if (code.length === 0) {
    await reportRefusal("unknown", { userId: user.id, code });
    return { ok: false, reason: "unknown" };
  }

  // Шаг 1. Тот же ответ, который читают страницы уроков.
  const tier = await getEntitlementTierFor(user);
  if (tier !== "free") {
    await reportRefusal("already_has_access", { userId: user.id, code });
    return { ok: false, reason: "already_has_access" };
  }

  // Шаг 2. Одноразовость.
  const now = new Date();
  const { count } = await db.accessCode.updateMany({
    where: {
      code,
      redeemedAt: null,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    data: { redeemedAt: now, redeemedById: user.id },
  });

  if (count === 0) return { ok: false, reason: await diagnoseFailedRedemption(code, now, user.id) };

  const row = await db.accessCode.findUnique({ where: { code } });
  // Строка только что стала нашей — исчезнуть она не может. Но читать её
  // как «точно есть» всё равно нельзя: тип честнее кода.
  if (!row || !isAccessCodeTier(row.tier)) {
    await reportUnknownTier(code, row?.tier ?? null, user.id);
    return { ok: false, reason: "unknown" };
  }

  // Шаг 3. Выдача — тем же путём, что и всё остальное в этом приложении.
  await extendOrGrantSubscription(user.id, row.durationDays, ACCESS_CODE_PLAN[row.tier]);
  return { ok: true, days: row.durationDays, tier: row.tier };
}

/** Почему условный UPDATE не задел ни строки. Чистое объяснение постфактум —
 * см. комментарий у redeemAccessCode. */
async function diagnoseFailedRedemption(
  code: string,
  now: Date,
  userId: string
): Promise<AccessCodeRefusal> {
  const row = await db.accessCode.findUnique({ where: { code } });
  const reason: AccessCodeRefusal = !row
    ? "unknown"
    : row.revokedAt !== null
      ? "revoked"
      : row.redeemedAt !== null
        ? "already_redeemed"
        : row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime()
          ? "expired"
          : // Ни одно из условий не объясняет отказ. Такого быть не может, и
            // именно поэтому это не «просрочен» и не «уже погашен», а
            // «неизвестен»: врать человеку о причине хуже, чем сказать общее.
            "unknown";
  await reportRefusal(reason, { userId, code });
  return reason;
}

async function reportUnknownTier(code: string, tier: string | null, userId: string) {
  try {
    const error = new Error(`Access code carries an unknown tier: ${tier ?? "no row"}`);
    error.name = "AccessCodeUnknownTier";
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, {
      level: "error",
      tags: { area: "access-code", refusal: "unknown-tier" },
      extra: { userId, tier, codeLength: code.length },
    });
  } catch {
    // Молча.
  }
}

/**
 * Отзыв кода ДО погашения.
 *
 * Тот же условный UPDATE, и по той же причине: «прочитать, убедиться, что не
 * погашен, потом записать» проигрывает гонке с погашением, а проигрыш здесь
 * означает отозванный код, за который человеку уже выдан доступ.
 *
 * Погашенный код отозвать нельзя, и это не техническое ограничение, а
 * продуктовое правило: отзыв кода — это «бумажка не сработает», а доступ,
 * который уже выдан, отзывается своим способом
 * (`/api/admin/subscriptions/revoke`), потому что у него другая цена.
 */
export async function revokeAccessCode(
  rawCode: string,
  actorId: string | null
): Promise<{ ok: true } | { ok: false; reason: "unknown" | "already_redeemed" | "already_revoked" }> {
  const code = normalizeAccessCode(rawCode);
  const { count } = await db.accessCode.updateMany({
    where: { code, redeemedAt: null, revokedAt: null },
    data: { revokedAt: new Date(), revokedById: actorId },
  });
  if (count > 0) return { ok: true };

  const row = await db.accessCode.findUnique({ where: { code } });
  if (!row) return { ok: false, reason: "unknown" };
  if (row.redeemedAt !== null) return { ok: false, reason: "already_redeemed" };
  return { ok: false, reason: "already_revoked" };
}
