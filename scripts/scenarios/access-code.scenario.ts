/**
 * SCENARIO: код доступа для первых учеников, в настоящей базе.
 *
 * Не юнит-тест функции. Здесь настоящая (временная, локальная) база,
 * настоящий Prisma, настоящая `extendOrGrantSubscription` и настоящая
 * `getEntitlementTier()` — та же функция, которую зовут страницы уроков и
 * заслонка в `proxy.ts`. Подменена ровно одна вещь: сессия (браузера здесь
 * нет).
 *
 * Ради чего это существует, а не хватает юнит-тестов:
 *
 *   1. ОДНОРАЗОВОСТЬ ПОД ГОНКОЙ. Подставной `updateMany` возвращает то, что
 *      ему велели вернуть; «двое одновременно вводят один код, доступ
 *      получает ровно один» — свойство настоящего UPDATE в настоящей базе, и
 *      измерить его можно только так. Позитивный контроль встроен сюда же:
 *      случай [A4] прогоняет по тому же коду наивную реализацию «прочитал,
 *      потом записал» и ТРЕБУЕТ, чтобы она погасила код дважды. Если бы она
 *      этого не сделала, зелёный у настоящей означал бы лишь то, что стенд
 *      не умеет ловить двойное погашение.
 *   2. ЧТО ОСТАЁТСЯ ПОСЛЕ ПОСЛЕДОВАТЕЛЬНОСТИ. «Погасил код, потом купил
 *      Premium, потом Premium вернули» — вопрос не к одному вызову.
 *      Разбирается он в `subscription-lifecycle.scenario.ts`, случай [11],
 *      рядом с настоящим вебхуком Stripe.
 *
 * База — свежий файл во временной папке, собранный из `prisma/schema.prisma`
 * на месте и удаляемый после прогона. Пять переменных, которыми этот код
 * можно направить в удалённую базу, перезаписываются ДО первого импорта из
 * `src/` (PROGRESS.md 7.32).
 *
 * Запуск: npm run test:scenarios
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
// Формат даты — общий для всех, кто ходит в базу мимо Prisma
// (scripts/stored-datetime.mjs). Раньше эта функция лежала копией в каждом
// сценарии; копия — это второй формат, ждущий своего часа
// (PROGRESS.md 7.147, долг 91; сторож — npm run check:raw-datetime).
import {
  storedDateTime,
  readStoredDateTime as readInstant,
  STORED_DATETIME_SHAPE,
} from "../stored-datetime.mjs";

const DAY = 24 * 60 * 60 * 1000;

let dbDir: string;
let dbFile: string;
let raw: Client;

type Tier = "free" | "standard" | "premium";
type Account = { id: string; role: string };

let redeemAccessCode: (user: Account, code: string) => Promise<
  { ok: true; days: number; tier: string } | { ok: false; reason: string }
>;
let revokeAccessCode: (
  code: string,
  actorId: string | null
) => Promise<{ ok: true } | { ok: false; reason: string }>;
let getEntitlementTier: () => Promise<Tier>;
let invalidateSubscriptionCache: (userId: string) => Promise<void>;
let extendOrGrantSubscription: (userId: string, days: number, plan: string) => Promise<void>;

/** Чью сессию отвечает getEntitlementTier(). Ставится перед каждым чтением. */
let currentUserId = "";

async function newUser(id: string): Promise<Account> {
  await raw.execute({
    sql: `INSERT INTO "User" (id, email, name, role, createdAt) VALUES (?, ?, ?, 'student', ?)`,
    args: [id, `${id}@scenario.invalid`, id, storedDateTime(new Date())],
  });
  currentUserId = id;
  return { id, role: "student" };
}

async function tierOf(user: Account): Promise<Tier> {
  currentUserId = user.id;
  await invalidateSubscriptionCache(user.id);
  return getEntitlementTier();
}

async function putCode(input: {
  code: string;
  days?: number;
  expiresAt?: Date | null;
  tier?: string;
  batch?: string;
}) {
  await raw.execute({
    sql: `INSERT INTO "AccessCode" (id, code, tier, durationDays, expiresAt, batch, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      `ac_${input.code}`,
      input.code,
      input.tier ?? "standard",
      input.days ?? 90,
      input.expiresAt ? storedDateTime(input.expiresAt) : null,
      input.batch ?? "SCENARIO",
      storedDateTime(new Date()),
    ],
  });
}

async function codeRow(code: string) {
  const result = await raw.execute({
    sql: `SELECT redeemedAt, redeemedById, revokedAt FROM "AccessCode" WHERE code = ?`,
    args: [code],
  });
  const row = result.rows[0];
  return row
    ? {
        redeemedAt: row.redeemedAt === null ? null : String(row.redeemedAt),
        redeemedById: row.redeemedById === null ? null : String(row.redeemedById),
        revokedAt: row.revokedAt === null ? null : String(row.revokedAt),
      }
    : null;
}

async function subscriptionRows(userId: string) {
  const result = await raw.execute({
    sql: `SELECT plan, status, currentPeriodEnd, stripeSubscriptionId, stripePaymentIntentId
          FROM "Subscription" WHERE userId = ? ORDER BY createdAt`,
    args: [userId],
  });
  return result.rows.map((row) => ({
    plan: String(row.plan),
    status: String(row.status),
    endsAt: readInstant(row.currentPeriodEnd),
    stripeSubscription: row.stripeSubscriptionId === null ? null : String(row.stripeSubscriptionId),
    stripePayment: row.stripePaymentIntentId === null ? null : String(row.stripePaymentIntentId),
  }));
}

/** Печатает уровень после каждого шага: утверждение говорит «standard», а
 * напечатанная последовательность — на каком шаге он таким стал. */
async function step(label: string, user: Account) {
  console.log(`    ${label.padEnd(52)} -> ${await tierOf(user)}`);
}

function scenario(title: string) {
  console.log(`\n  ${title}`);
}

beforeAll(async () => {
  dbDir = mkdtempSync(path.join(tmpdir(), "rusofacil-access-code-"));
  dbFile = path.join(dbDir, "scenario.db");

  // До ЛЮБОГО импорта из src/.
  process.env.DATABASE_URL = `file:${dbFile}`;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.PROD_TURSO_DATABASE_URL;
  delete process.env.PROD_TURSO_AUTH_TOKEN;
  delete process.env.VERCEL_ENV;
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;

  const schemaSql = execFileSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-empty", "--to-schema", "prisma/schema.prisma", "--script"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  writeFileSync(path.join(dbDir, "schema.sql"), schemaSql);
  raw = createClient({ url: `file:${dbFile}` });
  const statements = schemaSql
    .split(";\n")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
  if (statements.length < 20) throw new Error(`schema build produced ${statements.length} statements`);
  for (const statement of statements) await raw.execute(statement);

  // Таблица обязана существовать: без неё каждый случай ниже упал бы «нет
  // такой таблицы», то есть по неверной причине.
  const info = await raw.execute(`PRAGMA table_info("AccessCode")`);
  if (info.rows.length === 0) throw new Error("схема собралась без таблицы AccessCode");

  vi.doMock("@/lib/auth", () => ({
    getCurrentUser: async () => ({ id: currentUserId, role: "student", email: "x@scenario.invalid" }),
  }));

  ({ redeemAccessCode, revokeAccessCode } = await import("@/lib/access-code"));
  ({ getEntitlementTier } = await import("@/lib/entitlement"));
  ({ invalidateSubscriptionCache, extendOrGrantSubscription } = await import("@/lib/subscription"));
});

afterAll(() => {
  raw?.close();
  rmSync(dbDir, { recursive: true, force: true });
});

describe("код доступа открывает доступ тем же путём, что и оплата", () => {
  it("[A1] новичок вводит код и становится виден единой точке решения", async () => {
    const user = await newUser("ac-plain");
    scenario("[A1] новичок -> вводит код на 90 дней");
    await putCode({ code: "AMIGOPLAIN0001", days: 90 });
    await step("до кода", user);
    expect(await tierOf(user)).toBe("free");

    const result = await redeemAccessCode(user, "amigo-plain-0001");
    expect(result).toEqual({ ok: true, days: 90, tier: "standard" });
    await step("код погашен", user);
    expect(await tierOf(user)).toBe("standard");

    // Строка ТОЙ ЖЕ формы, что кладёт путь Stripe: обычный Subscription,
    // без ссылок на Stripe и без собственного понятия доступа.
    const rows = await subscriptionRows(user.id);
    expect(rows).toHaveLength(1);
    // "access_code", а не "manual" (7.151): подпись в кабинете у выдачи по
    // коду и у ручной выдачи администратора разная, потому что это разные
    // события. Уровень при этом один и тот же — `standard` выше.
    expect(rows[0].plan).toBe("access_code");
    expect(rows[0].status).toBe("active");
    expect(rows[0].stripeSubscription).toBeNull();
    expect(rows[0].stripePayment).toBeNull();
    // Срок — ровно те 90 дней, что записаны в коде (сутки допуска на прогон).
    expect(Math.round((rows[0].endsAt - Date.now()) / DAY)).toBe(90);

    // И в самой строке кода записано, кто и когда погасил.
    const stored = await codeRow("AMIGOPLAIN0001");
    expect(stored?.redeemedById).toBe(user.id);
    expect(stored?.redeemedAt).not.toBeNull();
  });

  it("[A2] тот же код второму человеку не даёт ничего", async () => {
    const second = await newUser("ac-second");
    scenario("[A2] второй человек вводит УЖЕ погашенный код");

    const result = await redeemAccessCode(second, "AMIGO-PLAIN-0001");
    expect(result).toEqual({ ok: false, reason: "already_redeemed" });
    await step("отказ", second);
    expect(await tierOf(second)).toBe("free");
    expect(await subscriptionRows(second.id)).toHaveLength(0);
  });

  it("[A3] у кого доступ уже есть, тот код не тратит", async () => {
    const user = await newUser("ac-has-access");
    scenario("[A3] уже есть доступ -> код НЕ расходуется");
    await putCode({ code: "AMIGOSPARE0001" });

    await extendOrGrantSubscription(user.id, 30, "manual");
    await step("30 дней уже выдано", user);
    expect(await tierOf(user)).toBe("standard");

    const result = await redeemAccessCode(user, "amigo-spare-0001");
    expect(result).toEqual({ ok: false, reason: "already_has_access" });

    // Главное утверждение: строка кода не тронута, бумажка ещё жива.
    const stored = await codeRow("AMIGOSPARE0001");
    expect(stored?.redeemedAt).toBeNull();
    expect(stored?.redeemedById).toBeNull();
  });
});

describe("одноразовость под гонкой", () => {
  it("[A4] двое одновременно вводят один код: успешный ровно один", async () => {
    scenario("[A4] ГОНКА: два одновременных погашения одного кода");
    const a = await newUser("ac-race-a");
    const b = await newUser("ac-race-b");
    await putCode({ code: "AMIGORACE0001", days: 90 });

    // Оба запроса пущены ОДНОВРЕМЕННО. Ни один не ждёт другого.
    const [first, second] = await Promise.all([
      redeemAccessCode(a, "amigo-race-0001"),
      redeemAccessCode(b, "AMIGO-RACE-0001"),
    ]);

    const winners = [first, second].filter((r) => r.ok);
    const losers = [first, second].filter((r) => !r.ok);
    console.log(`    успешных ${winners.length}, отказов ${losers.length}`);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect((losers[0] as { reason: string }).reason).toBe("already_redeemed");

    // И, что важнее ответа функции: доступ выдан РОВНО одному человеку.
    const rowsA = await subscriptionRows(a.id);
    const rowsB = await subscriptionRows(b.id);
    expect(rowsA.length + rowsB.length).toBe(1);

    const winnerId = rowsA.length === 1 ? a.id : b.id;
    const loserId = rowsA.length === 1 ? b.id : a.id;
    expect((await codeRow("AMIGORACE0001"))?.redeemedById).toBe(winnerId);
    console.log(`    доступ получил ${winnerId}, отказ получил ${loserId}`);

    expect(await tierOf({ id: winnerId, role: "student" })).toBe("standard");
    expect(await tierOf({ id: loserId, role: "student" })).toBe("free");
  });

  it("[A4-контроль] наивное «прочитал, потом записал» на том же стенде гасит код ДВАЖДЫ", async () => {
    scenario("[A4-контроль] позитивный контроль: реализация без условного UPDATE");
    const a = await newUser("ac-naive-a");
    const b = await newUser("ac-naive-b");
    await putCode({ code: "AMIGONAIVE0001", days: 90 });

    // Ровно тот способ, который промт 7.146 велел НЕ применять: сначала
    // прочитать, убедиться, что не погашен, потом записать. Между чтением и
    // записью — точка ожидания, и в неё пролезает второй запрос.
    //
    // Этот контроль обязателен: без него зелёный случай [A4] означал бы
    // только то, что стенд не умеет замечать двойное погашение.
    const naiveRedeem = async (userId: string): Promise<boolean> => {
      const read = await raw.execute({
        sql: `SELECT redeemedAt FROM "AccessCode" WHERE code = ?`,
        args: ["AMIGONAIVE0001"],
      });
      if (read.rows[0]?.redeemedAt !== null) return false;
      await new Promise((resolve) => setTimeout(resolve, 5));
      await raw.execute({
        sql: `UPDATE "AccessCode" SET redeemedAt = ?, redeemedById = ? WHERE code = ?`,
        args: [storedDateTime(new Date()), userId, "AMIGONAIVE0001"],
      });
      return true;
    };

    const outcomes = await Promise.all([naiveRedeem(a.id), naiveRedeem(b.id)]);
    const succeeded = outcomes.filter(Boolean).length;
    console.log(`    наивная реализация: успешных ${succeeded} (ожидалось 2)`);
    expect(succeeded).toBe(2);
  });
});

describe("срок годности кода и срок доступа — разные вещи", () => {
  it("[A5] просроченный код не погашается", async () => {
    scenario("[A5] код со вчерашним сроком годности");
    const user = await newUser("ac-expired");
    await putCode({ code: "AMIGOEXPIRED001", expiresAt: new Date(Date.now() - DAY) });

    expect(await redeemAccessCode(user, "AMIGO-EXPIRED-001")).toEqual({
      ok: false,
      reason: "expired",
    });
    await step("отказ", user);
    expect(await tierOf(user)).toBe("free");
  });

  it("[A6] код, годный ещё час, даёт ПОЛНЫЕ 90 дней доступа", async () => {
    scenario("[A6] код гасят в последний час его годности");
    const user = await newUser("ac-last-hour");
    await putCode({ code: "AMIGOLASTHOUR01", days: 90, expiresAt: new Date(Date.now() + 3600_000) });

    expect(await redeemAccessCode(user, "AMIGO-LASTHOUR-01")).toMatchObject({ ok: true, days: 90 });
    const rows = await subscriptionRows(user.id);
    expect(Math.round((rows[0].endsAt - Date.now()) / DAY)).toBe(90);
    await step("доступ открыт на 90 дней", user);
  });

  it("[A7] доступ кончается сам по currentPeriodEnd, без единого события", async () => {
    scenario("[A7] выданный кодом доступ доживает до конца срока и гаснет");
    const user = await newUser("ac-lapses");
    await putCode({ code: "AMIGOLAPSE00001", days: 7 });
    await redeemAccessCode(user, "AMIGO-LAPSE-00001");
    await step("код погашен, 7 дней", user);
    expect(await tierOf(user)).toBe("standard");

    // Граница ровно как в 7.145: строго в будущем — доступ есть.
    await raw.execute({
      sql: `UPDATE "Subscription" SET currentPeriodEnd = ? WHERE userId = ?`,
      args: [storedDateTime(new Date(Date.now() + 1000)), user.id],
    });
    await step("срок в одной секунде впереди", user);
    expect(await tierOf(user)).toBe("standard");

    // Ровно сейчас — доступа уже нет. Никакого события не приходило.
    await raw.execute({
      sql: `UPDATE "Subscription" SET currentPeriodEnd = ? WHERE userId = ?`,
      args: [storedDateTime(new Date()), user.id],
    });
    await step("срок ровно сейчас", user);
    expect(await tierOf(user)).toBe("free");
  });
});

describe("отзыв кода", () => {
  it("[A8] отозванный до погашения код при вводе даёт внятный отказ", async () => {
    scenario("[A8] код отозван -> его вводят");
    // Отзыв записывает, КТО отозвал, и внешний ключ на User настоящий:
    // выдуманный идентификатор здесь не пройдёт, и это правильно.
    const owner = await newUser("ac-owner");
    const user = await newUser("ac-revoked");
    await putCode({ code: "AMIGOREVOKED001" });

    expect(await revokeAccessCode("amigo-revoked-001", owner.id)).toEqual({ ok: true });
    expect((await codeRow("AMIGOREVOKED001"))?.revokedAt).not.toBeNull();

    expect(await redeemAccessCode(user, "AMIGO-REVOKED-001")).toEqual({
      ok: false,
      reason: "revoked",
    });
    await step("отказ", user);
    expect(await tierOf(user)).toBe("free");
    expect(await subscriptionRows(user.id)).toHaveLength(0);
  });

  it("[A9] погашенный код отозвать нельзя", async () => {
    scenario("[A9] код погашен -> его пробуют отозвать");
    const user = await newUser("ac-spent");
    await putCode({ code: "AMIGOSPENT00001", days: 30 });
    expect(await redeemAccessCode(user, "AMIGO-SPENT-00001")).toMatchObject({ ok: true });

    expect(await revokeAccessCode("AMIGO-SPENT-00001", "ac-owner")).toEqual({
      ok: false,
      reason: "already_redeemed",
    });

    // И доступ, разумеется, на месте: попытка отзыва кода его не трогает.
    await step("доступ на месте", user);
    expect(await tierOf(user)).toBe("standard");
    expect((await codeRow("AMIGOSPENT00001"))?.revokedAt).toBeNull();
  });

  it("[A10] отзыв кода, которого нет", async () => {
    expect(await revokeAccessCode("AMIGO-NOPE-00000", null)).toEqual({ ok: false, reason: "unknown" });
  });
});

/**
 * ФОРМАТ ДАТЫ — ПОСЫЛКА, НА КОТОРОЙ СТОИТ ВСЁ ОСТАЛЬНОЕ (долг 91, PROGRESS.md 7.147).
 *
 * Сторож `npm run check:raw-datetime` запрещает сырому SQL сравнивать
 * `DateTime` и требует, чтобы запись шла через `storedDateTime`. Оба правила
 * держатся на одном утверждении о мире: «Prisma хранит дату текстом вида
 * `2026-09-08T12:00:00.000+00:00`». Утверждение, которое никто не проверял, —
 * это не правило, а поверье, поэтому оно проверяется здесь, на настоящей
 * базе и на строке, которую написала САМА Prisma.
 */
describe("формат даты, в котором пишет Prisma", () => {
  it("[A11] строка, написанная Prisma, совпадает с общим форматтером знак в знак", async () => {
    scenario("[A11] Prisma пишет дату -> её текст читают сырым клиентом");
    const user = await newUser("ac-format");
    await putCode({ code: "AMIGOFORMAT0001", days: 90 });
    expect(await redeemAccessCode(user, "AMIGO-FORMAT-0001")).toMatchObject({ ok: true });

    // Строку `Subscription` написала Prisma (через extendOrGrantSubscription).
    // Читаем её ТЕКСТ, а не разобранную дату: разбор в JS одинаково прощает
    // и число, и текст, и потому о формате хранения не говорит ничего.
    const result = await raw.execute({
      sql: `SELECT currentPeriodEnd, createdAt FROM "Subscription" WHERE userId = ?`,
      args: [user.id],
    });
    const stored = String(result.rows[0].currentPeriodEnd);
    console.log(`    Prisma записала -> ${stored}`);
    expect(stored).toMatch(STORED_DATETIME_SHAPE);
    expect(String(result.rows[0].createdAt)).toMatch(STORED_DATETIME_SHAPE);
    // И главное: наш форматтер даёт РОВНО этот текст, а не «похожий».
    expect(storedDateTime(new Date(stored))).toBe(stored);
    // Позитивный контроль к самой сверке: `toISOString()` — почти то же
    // самое и всё-таки не то. Без этой строки совпадение выше проходило бы
    // и с форматтером, который ничего не меняет.
    expect(new Date(stored).toISOString()).not.toBe(stored);
  });

  it("[A12] код, положенный числом миллисекунд, живым не выглядит — замер, а не пожелание", async () => {
    scenario("[A12] тот же код двумя форматами срока годности");
    const hour = new Date(Date.now() + 60 * 60 * 1000);

    // Правильный формат: код годен ещё час и погашается.
    const good = await newUser("ac-format-good");
    await putCode({ code: "AMIGOFORMATOK01", expiresAt: hour });
    expect(await redeemAccessCode(good, "AMIGO-FORMAT-OK01")).toMatchObject({ ok: true });

    // Тот же срок, положенный ЧИСЛОМ. Сравнение `expiresAt > ?` идёт в SQL,
    // а SQLite ставит любое число ниже любой строки — живой код становится
    // неизвестным. Это ИЗМЕРЕНИЕ сегодняшнего поведения, а не требование к
    // нему: перенеси кто-нибудь сравнение в JS, этот случай покраснеет, и
    // покраснеет он правильно — поведение изменилось.
    const bad = await newUser("ac-format-bad");
    await raw.execute({
      sql: `INSERT INTO "AccessCode" (id, code, tier, durationDays, expiresAt, batch, createdAt)
            VALUES (?, ?, 'standard', 90, ?, 'SCENARIO', ?)`,
      // Подсадка ровно того формата, который сторож запрещает. Сторож молчит
      // на этом файле не по слепоте: он спрашивает у ФАЙЛА, есть ли в нём
      // общий форматтер, а здесь он есть — см. заголовок check-raw-datetime.mjs.
      args: ["ac_format_bad", "AMIGOFORMATBAD1", hour.getTime(), storedDateTime(new Date())],
    });
    expect(await redeemAccessCode(bad, "AMIGO-FORMAT-BAD1")).toEqual({ ok: false, reason: "unknown" });
    console.log("    число миллисекунд -> код выглядит неизвестным (та самая находка 7.146)");
    expect(await tierOf(bad)).toBe("free");
  });
});
