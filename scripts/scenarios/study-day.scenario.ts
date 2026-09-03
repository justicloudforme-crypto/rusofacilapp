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
let getUserActivityDaySources: (userId: string, timeZone?: string) => Promise<Record<string, string[]>>;
let getLevelProgress: (userId: string) => Promise<Record<string, { completed: number; total: number }>>;
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

// Every planted row carries a `markedAt` that really falls inside its own
// `dateKey` for the learner's zone, because that is the invariant production
// writes (src/lib/study-day.ts) and because the reader derives the day from
// the instant (src/lib/study-day-key.ts). A fixture with the two disagreeing
// describes a row the product cannot produce — except for the one case that
// is exactly the point of the last describe() in this file.
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
  ({ getUserActivityDateKeys, getUserActivityDaySources, getUserStreakStats } = await import("@/lib/streaks"));
  ({ getLevelProgress } = await import("@/lib/progress"));
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
        args: [`ro-${day}`, user, day, Date.parse(`${day}T18:00:00.000Z`)],
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
      args: [user, Date.parse("2026-09-09T18:00:00.000Z")],
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
        args: [`st-${day}`, user, day, Date.parse(`${day}T18:00:00.000Z`)],
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

describe("плитки «Обзора» считают ровно то, что написано на них", () => {
  // The owner's complaint of 31.08.2026, as a fixture: nine days with a
  // flame on the calendar, and beside them "0 palabras aprendidas",
  // "0 lecciones", "— / aún no empezado". Every one of those numbers is
  // correct; what was wrong was two captions. This case pins the meaning of
  // all four against a real database so a future edit cannot quietly change
  // what a caption counts.
  it("девять дней занятий и ни одной сданной строки прогресса — все четыре числа нули, и это верно", async () => {
    const user = await newUser("tiles-nine-days");
    const days = ["2026-08-03","2026-08-04","2026-08-05","2026-08-10","2026-08-11",
                  "2026-08-12","2026-08-20","2026-08-30","2026-08-31"];
    for (const [i, day] of days.entries()) {
      await raw.execute({
        sql: `INSERT INTO "StudyDay" (id, userId, dateKey, source, markedAt) VALUES (?, ?, ?, 'lesson', ?)`,
        args: [`tile-${i}`, user, day, Date.parse(`${day}T18:00:00.000Z`)],
      });
    }

    // Tile 1 — "palabras aprendidas": cards the learner marked as known.
    const known = await raw.execute({
      sql: `SELECT COUNT(*) AS n FROM "FlashcardProgress" WHERE userId = ? AND known = 1`,
      args: [user],
    });
    expect(Number(known.rows[0].n)).toBe(0);

    // Tile 2 — "lecciones aprobadas": distinct lessons with a PASSING
    // attempt. Not "lessons opened", which is what the calendar counts, and
    // the caption used to say "completadas".
    const progress = await getLevelProgress(user);
    const lessons = Object.values(progress).reduce((sum, level) => sum + level.completed, 0);
    expect(lessons).toBe(0);

    // Tile 4 — the level: the highest level with a passed lesson, hence "—".
    const currentLevel = Object.entries(progress).find(([, p]) => p.completed > 0)?.[0] ?? null;
    expect(currentLevel).toBeNull();

    // Tile 3 — the streak, and the calendar beside it.
    const keys = await getUserActivityDateKeys(user, TIJUANA);
    expect(keys.sort()).toEqual(days);
    const stats = await getUserStreakStats(user, TIJUANA, {
      streakFreezesLeft: null,
      streakFreezesSince: "2026-08-01",
    });
    console.log(
      `    девять дней на календаре -> palabras ${known.rows[0].n}, lecciones ${lessons}, ` +
        `nivel ${currentLevel ?? "—"}, racha ${stats.currentStreak}`,
    );

    // POSITIVE CONTROL: a passed lesson moves tiles 2 and 4 and nothing
    // else, which is what makes the four zeros above a real measurement of
    // those two queries rather than of an empty account.
    await raw.execute({
      sql: `INSERT INTO "LessonProgress" (id, userId, level, lessonSlug, score, passed, mistakes, answers, completedAt)
            VALUES ('tile-lesson', ?, 'a1', '1', 90, 1, '[]', '{}', ?)`,
      args: [user, Date.now()],
    });
    const after = await getLevelProgress(user);
    const lessonsAfter = Object.values(after).reduce((sum, level) => sum + level.completed, 0);
    expect(lessonsAfter).toBe(1);
    expect(Object.entries(after).find(([, p]) => p.completed > 0)?.[0]).toBe("a1");
    console.log(`    контроль: сданный урок -> lecciones ${lessonsAfter}, nivel a1`);

    // ...and a FAILED attempt does not, which is precisely the gap between
    // the old caption ("completadas") and the number under it.
    await raw.execute({
      sql: `INSERT INTO "LessonProgress" (id, userId, level, lessonSlug, score, passed, mistakes, answers, completedAt)
            VALUES ('tile-failed', ?, 'a2', '1', 40, 0, '[]', '{}', ?)`,
      args: [user, Date.now()],
    });
    const withFail = await getLevelProgress(user);
    expect(Object.values(withFail).reduce((sum, level) => sum + level.completed, 0)).toBe(1);
    console.log("    контроль: НЕсданный урок -> lecciones по-прежнему 1");
  });

  it("источники дня: несколько в один день, и все возвращаются", async () => {
    const user = await newUser("tiles-sources");
    await raw.execute({
      sql: `INSERT INTO "StudyDay" (id, userId, dateKey, source, markedAt) VALUES ('src-1', ?, '2026-08-10', 'media', ?)`,
      args: [user, Date.parse("2026-08-10T18:00:00.000Z")],
    });
    // The mark keeps ONE row per day, so the extra sources have to come
    // from the progress tables — which is exactly how the day disclosure
    // can honestly list more than one thing.
    await raw.execute({
      sql: `INSERT INTO "LessonProgress" (id, userId, level, lessonSlug, score, passed, mistakes, answers, completedAt)
            VALUES ('src-lesson', ?, 'a1', '2', 90, 1, '[]', '{}', ?)`,
      args: [user, Date.parse("2026-08-10T18:00:00.000Z")],
    });
    await raw.execute({
      sql: `INSERT INTO "ExamAttempt" (id, userId, level, examSlug, earned, total, percentage, passed, breakdown, completedAt)
            VALUES ('src-exam', ?, 'a1', 'a1-exam-1', 9, 10, 90, 1, '{}', ?)`,
      args: [user, Date.parse("2026-08-10T19:00:00.000Z")],
    });

    const sources = await getUserActivityDaySources(user, TIJUANA);
    console.log(`    один день, три источника -> ${JSON.stringify(sources["2026-08-10"])}`);
    expect([...sources["2026-08-10"]].sort()).toEqual(["exam", "lesson", "media"]);
    // Sorted into the product's own order, not the order the queries
    // happened to return.
    expect(sources["2026-08-10"]).toEqual(["lesson", "exam", "media"]);
    // And a day nobody touched is simply absent, never an empty list.
    expect(sources["2026-08-09"]).toBeUndefined();
  });
});

describe("отметка, поставленная до того, как браузер сообщил зону", () => {
  const MEXICO = "America/Mexico_City"; // UTC-6 круглый год

  it("день читается по мгновению, а не по штампу", async () => {
    const user = await newUser("sd-utc-stamped");
    const { dateKeyIn } = await import("@/lib/timezone");
    const evening = new Date(Date.parse(`${dateKeyIn(new Date(Date.now() - 2 * 86_400_000), MEXICO)}T01:00:00.000Z`));
    // The instant above is 19:00 Mexico City on the day BEFORE the key it is
    // built from; take the local day it really is and pin everything to it.
    const trueDay = dateKeyIn(evening, MEXICO);
    const utcStamp = dateKeyIn(evening, "UTC");
    expect(utcStamp).not.toBe(trueDay); // POSITIVE CONTROL: the stamp is a day off

    await raw.execute({
      sql: `INSERT INTO "StudyDay" (id, userId, dateKey, source, markedAt) VALUES ('utc-only', ?, ?, 'lesson', ?)`,
      args: [user, utcStamp, evening.getTime()],
    });

    const keys = await getUserActivityDateKeys(user, MEXICO);
    console.log(`    штамп ${utcStamp}, мгновение -> ${JSON.stringify(keys)}`);
    expect(keys).toEqual([trueDay]);
  });

  it("следующий заход чинит уехавшую строку и всё-таки отмечает сегодня", async () => {
    // The collision the wrong stamp causes: the mark for the 10th was
    // stamped 2026-09-11, so when the learner comes back on the 11th — this
    // time with a known zone — the unique index already has that key and the
    // old code wrote nothing at all. Two evenings, one row, one lost day.
    const user = await newUser("sd-utc-repair");
    const { dateKeyIn } = await import("@/lib/timezone");
    const firstEvening = new Date(Date.parse(`${dateKeyIn(new Date(Date.now() - 86_400_000), MEXICO)}T01:00:00.000Z`));
    const firstDay = dateKeyIn(firstEvening, MEXICO);
    const secondEvening = new Date(firstEvening.getTime() + 86_400_000);
    const secondDay = dateKeyIn(secondEvening, MEXICO);
    expect(dateKeyIn(firstEvening, "UTC")).toBe(secondDay); // the collision, stated

    await raw.execute({
      sql: `INSERT INTO "StudyDay" (id, userId, dateKey, source, markedAt) VALUES ('rep-1', ?, ?, 'lesson', ?)`,
      args: [user, secondDay, firstEvening.getTime()],
    });

    await markStudyDay(user, MEXICO, "flashcards", secondEvening);

    const rows = await dayRows(user);
    console.log(`    после починки -> ${JSON.stringify(rows)}`);
    expect(rows).toEqual([
      { dateKey: firstDay, source: "lesson" },
      { dateKey: secondDay, source: "flashcards" },
    ]);

    const keys = await getUserActivityDateKeys(user, MEXICO);
    expect(keys.sort()).toEqual([firstDay, secondDay]);
  });

  it("починка идемпотентна: повторный заход в тот же день ничего не меняет", async () => {
    const user = await newUser("sd-utc-repeat");
    const { dateKeyIn } = await import("@/lib/timezone");
    const evening = new Date(Date.parse(`${dateKeyIn(new Date(), MEXICO)}T01:00:00.000Z`));
    const day = dateKeyIn(evening, MEXICO);
    for (let i = 0; i < 5; i++) await markStudyDay(user, MEXICO, "lesson", evening);
    const rows = await dayRows(user);
    console.log(`    пять заходов -> ${rows.length} запись(и)`);
    expect(rows).toEqual([{ dateKey: day, source: "lesson" }]);
  });
});
