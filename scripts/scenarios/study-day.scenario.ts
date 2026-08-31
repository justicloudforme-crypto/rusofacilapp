/**
 * SCENARIO: the day mark against a real database.
 *
 * The question this file answers is not "does markStudyDay call upsert" — a
 * mock can be made to say yes to that. It is: after a learner opens study
 * pages over and over, what is ACTUALLY in the table, and does anything
 * that merely LOOKS at the calendar add to it?
 *
 * That needs the real unique index, so it belongs here and not in
 * `npm run test`, which is guaranteed to open no database connection at all
 * (`npm run check:no-db-in-tests`, PROGRESS.md 7.32).
 *
 * WHAT IS REAL HERE AND WHAT IS NOT
 *   real — markStudyDay, getStudyDayKeys, getUserStreakStats,
 *          getUserActivityDateKeys, the Prisma client, the schema built
 *          from prisma/schema.prisma, and the rows.
 *   fake — nothing else is needed: there is no session, no HTTP and no
 *          browser in this file, because the page-level half of the rule
 *          ("opening a lesson marks the day, opening /profile does not") is
 *          a routing fact and is checked in a real browser instead.
 *
 * Run: npm run test:scenarios
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";

let dbDir: string;
let dbFile: string;
let raw: Client;

let markStudyDay: (
  userId: string,
  timeZone: string,
  source: "lesson" | "story" | "flashcards" | "word-game" | "exam",
  at?: Date,
) => Promise<void>;
let getStudyDayKeys: (userId: string) => Promise<string[]>;
let getUserActivityDateKeys: (userId: string, timeZone?: string) => Promise<string[]>;
let getUserStreakStats: (
  userId: string,
  timeZone?: string,
  user?: { streakFreezesLeft?: number | null; streakFreezesSince?: string | null } | null,
) => Promise<{ currentStreak: number }>;

const TIJUANA = "America/Tijuana"; // UTC-7
const AUCKLAND = "Pacific/Auckland"; // UTC+12

async function newUser(id: string): Promise<string> {
  await raw.execute({
    sql: `INSERT INTO "User" (id, email, name, role, createdAt) VALUES (?, ?, ?, 'student', ?)`,
    args: [id, `${id}@scenario.invalid`, id, Date.now()],
  });
  return id;
}

async function dayRows(userId: string): Promise<Array<{ dateKey: string; source: string }>> {
  const result = await raw.execute({
    sql: `SELECT dateKey, source FROM "StudyDay" WHERE userId = ? ORDER BY dateKey`,
    args: [userId],
  });
  return result.rows.map((row) => ({ dateKey: String(row.dateKey), source: String(row.source) }));
}

beforeAll(async () => {
  dbDir = mkdtempSync(path.join(tmpdir(), "rusofacil-studyday-"));
  dbFile = path.join(dbDir, "scenario.db");

  // Before ANY import from src/ — same five variables as the subscription
  // scenario, same reason (PROGRESS.md 7.32).
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
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  raw = createClient({ url: `file:${dbFile}` });
  const statements = schemaSql
    .split(";\n")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
  if (statements.length < 20) throw new Error(`schema build produced ${statements.length} statements`);
  for (const statement of statements) await raw.execute(statement);

  // The table has to be in the schema the real migrator produced, not one
  // this file created for itself — otherwise the whole run would pass
  // against a table nobody deploys.
  const created = await raw.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='StudyDay'`);
  if (created.rows.length !== 1) throw new Error("StudyDay is not in the generated schema");

  ({ markStudyDay, getStudyDayKeys } = await import("@/lib/study-day"));
  ({ getUserActivityDateKeys, getUserStreakStats } = await import("@/lib/streaks"));
});

afterAll(() => {
  raw?.close();
  rmSync(dbDir, { recursive: true, force: true });
});

describe("одна отметка на календарный день", () => {
  it("две отметки в один день — одна запись, и первый источник сохраняется", async () => {
    const user = await newUser("sd-two-marks");
    const morning = new Date("2026-09-10T16:00:00.000Z"); // 09:00 in Tijuana
    const evening = new Date("2026-09-11T05:00:00.000Z"); // 22:00 the SAME day in Tijuana

    await markStudyDay(user, TIJUANA, "lesson", morning);
    await markStudyDay(user, TIJUANA, "story", evening);

    const rows = await dayRows(user);
    console.log(`    два захода 09:00 и 22:00 (Tijuana) -> ${rows.length} запись(и): ${JSON.stringify(rows)}`);
    expect(rows).toEqual([{ dateKey: "2026-09-10", source: "lesson" }]);

    // The control that the two instants really were different moments and
    // could have produced two rows: in UTC they are two different days.
    expect(morning.toISOString().slice(0, 10)).not.toBe(evening.toISOString().slice(0, 10));
  });

  it("десять отрисовок подряд — по-прежнему одна запись", async () => {
    const user = await newUser("sd-idempotent");
    const at = new Date("2026-09-10T18:00:00.000Z");

    for (let i = 0; i < 10; i++) await markStudyDay(user, TIJUANA, "lesson", at);

    const rows = await dayRows(user);
    console.log(`    10 отрисовок -> ${rows.length} запись(и)`);
    expect(rows).toHaveLength(1);

    // POSITIVE CONTROL, and the reason this file exists rather than a
    // comment saying "it's idempotent". The same ten renders, written the
    // obvious way — one row per visit — leave ten rows behind. If the
    // unique index were ever dropped, the assertion above would start
    // matching this number instead.
    await newUser("sd-naive-control");
    for (let i = 0; i < 10; i++) {
      await raw.execute({
        sql: `INSERT INTO "StudyDay" (id, userId, dateKey, source, markedAt) VALUES (?, ?, ?, 'lesson', ?)`,
        args: [`naive-${i}`, "sd-naive-control", `2026-09-10-visit-${i}`, Date.now()],
      });
    }
    const naive = await raw.execute({
      sql: `SELECT COUNT(*) AS n FROM "StudyDay" WHERE userId = 'sd-naive-control'`,
    });
    console.log(`    контроль «строка на каждый заход» -> ${naive.rows[0].n} записей`);
    expect(Number(naive.rows[0].n)).toBe(10);
  });

  it("следующий календарный день — вторая запись", async () => {
    const user = await newUser("sd-next-day");
    await markStudyDay(user, TIJUANA, "lesson", new Date("2026-09-10T18:00:00.000Z"));
    await markStudyDay(user, TIJUANA, "flashcards", new Date("2026-09-11T18:00:00.000Z"));

    const rows = await dayRows(user);
    console.log(`    два разных дня -> ${JSON.stringify(rows)}`);
    expect(rows).toEqual([
      { dateKey: "2026-09-10", source: "lesson" },
      { dateKey: "2026-09-11", source: "flashcards" },
    ]);
  });

  it("границу суток задаёт зона ученика, а не сервер", async () => {
    // ONE instant. In Tijuana it is the evening of the 10th; in Auckland it
    // is already the 11th. Two learners, same moment, different day.
    const instant = new Date("2026-09-11T05:00:00.000Z");
    const west = await newUser("sd-tz-west");
    const east = await newUser("sd-tz-east");

    await markStudyDay(west, TIJUANA, "lesson", instant);
    await markStudyDay(east, AUCKLAND, "lesson", instant);

    const [w] = await dayRows(west);
    const [e] = await dayRows(east);
    console.log(`    один миг: Tijuana -> ${w.dateKey}, Auckland -> ${e.dateKey}`);
    expect(w.dateKey).toBe("2026-09-10");
    expect(e.dateKey).toBe("2026-09-11");
    expect(w.dateKey).not.toBe(e.dateKey);
  });
});

describe("чтение календаря ничего не пишет", () => {
  it("двадцать чтений серии и списка дней не меняют ни одной строки", async () => {
    const user = await newUser("sd-read-only");
    for (const day of ["2026-09-01", "2026-09-02", "2026-09-04"]) {
      await raw.execute({
        sql: `INSERT INTO "StudyDay" (id, userId, dateKey, source, markedAt) VALUES (?, ?, ?, 'lesson', ?)`,
        args: [`ro-${day}`, user, day, Date.now()],
      });
    }

    const before = await raw.execute({
      sql: `SELECT id, dateKey, source FROM "StudyDay" WHERE userId = ? ORDER BY dateKey`,
      args: [user],
    });

    for (let i = 0; i < 20; i++) {
      await getUserActivityDateKeys(user, TIJUANA);
      await getUserStreakStats(user, TIJUANA, { streakFreezesLeft: null, streakFreezesSince: "2026-01-01" });
      await getStudyDayKeys(user);
    }

    const after = await raw.execute({
      sql: `SELECT id, dateKey, source FROM "StudyDay" WHERE userId = ? ORDER BY dateKey`,
      args: [user],
    });
    console.log(`    20 чтений -> было ${before.rows.length}, стало ${after.rows.length}`);
    expect(JSON.stringify(after.rows)).toBe(JSON.stringify(before.rows));

    // The control that this assertion is not vacuous: the same comparison
    // MUST notice a row that really did appear.
    await raw.execute({
      sql: `INSERT INTO "StudyDay" (id, userId, dateKey, source, markedAt) VALUES ('ro-control', ?, '2026-09-09', 'lesson', ?)`,
      args: [user, Date.now()],
    });
    const control = await raw.execute({
      sql: `SELECT id, dateKey, source FROM "StudyDay" WHERE userId = ? ORDER BY dateKey`,
      args: [user],
    });
    expect(JSON.stringify(control.rows)).not.toBe(JSON.stringify(before.rows));
  });
});

describe("отметка дня — полноценный источник серии", () => {
  it("день без единой строки прогресса всё равно засчитан", async () => {
    const user = await newUser("sd-streak");
    // Three consecutive days marked, and NOTHING in any progress table —
    // exactly the learner who opened lessons and finished nothing. Before
    // the day mark existed this account's streak was 0.
    for (const day of ["2026-09-08", "2026-09-09", "2026-09-10"]) {
      await raw.execute({
        sql: `INSERT INTO "StudyDay" (id, userId, dateKey, source, markedAt) VALUES (?, ?, ?, 'lesson', ?)`,
        args: [`st-${day}`, user, day, Date.now()],
      });
    }

    const keys = await getUserActivityDateKeys(user, TIJUANA);
    console.log(`    дни без строк прогресса -> ${JSON.stringify(keys.sort())}`);
    expect(keys.sort()).toEqual(["2026-09-08", "2026-09-09", "2026-09-10"]);

    // The control: no progress rows exist for this account at all, so every
    // one of those days comes from the mark and nowhere else.
    const progress = await raw.execute({
      sql: `SELECT
              (SELECT COUNT(*) FROM "LessonProgress" WHERE userId = ?1) +
              (SELECT COUNT(*) FROM "FlashcardProgress" WHERE userId = ?1) +
              (SELECT COUNT(*) FROM "StoryReadingProgress" WHERE userId = ?1) +
              (SELECT COUNT(*) FROM "WordGameProgress" WHERE userId = ?1) +
              (SELECT COUNT(*) FROM "ExamAttempt" WHERE userId = ?1) AS n`,
      args: [user],
    });
    expect(Number(progress.rows[0].n)).toBe(0);
  });
});
