/**
 * Стенд для браузерных проверок кода доступа (PROGRESS.md 7.147, долг 90).
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ СКРИПТ, А НЕ МАРШРУТ В ПРИЛОЖЕНИИ. Правило 7.146 гласит:
 * таблица `AccessCode` читается и пишется ТОЛЬКО из `src/lib/access-code.ts`,
 * и сторож `check:access-code-path` это держит. Тестовый маршрут вида
 * `/api/test/access-code` был бы вторым местом, которое смотрит в таблицу, —
 * ровно тем, что сторож заведён ловить, и его пришлось бы ослабить
 * исключением. Скрипт живёт в `scripts/`, куда сторож не ходит и ходить не
 * должен: заведение и отзыв строк — это administración базы, а не выдача
 * доступа человеку в запросе.
 *
 * ПОЧЕМУ `better-sqlite3`, А НЕ PRISMA, И ПОЧЕМУ ЭТО ИЗМЕРЕНО. Первая версия
 * ходила через Prisma и на полном прогоне набора упала четырьмя тестами из
 * 24 с `db.accessCode.create(): Operation has timed out` — база у прогона
 * одна, и пока `next start` держит запись, второй процесс ждёт замок и
 * сдаётся. `better-sqlite3` умеет `PRAGMA busy_timeout`, то есть ЖДАТЬ
 * замок, а не падать, и вдобавок стартует без загрузки клиента Prisma —
 * окно, в которое можно попасть, само по себе становится короче.
 *
 * Цена этого выбора названа вслух: запись идёт сырым SQL, а значит формат
 * даты — на нашей совести. Он берётся из общего `storedDateTime`
 * (`scripts/stored-datetime.mjs`), того самого, чьё совпадение с форматом
 * Prisma доказано случаем [A11] в `access-code.scenario.ts`. Сторож
 * `npm run check:raw-datetime` за этим следит.
 *
 * Спека зовёт стенд через `execFileSync` и передаёт СВОЙ код на каждый
 * случай: файл идёт в двух проектах Playwright параллельно, и общий код был
 * бы погашен первым прогоном.
 *
 *   tsx scripts/e2e-access-code.ts create --code=AMIGOXXXXXXXX [--days=90]
 *                                         [--expired] [--revoked]
 *   tsx scripts/e2e-access-code.ts show   --code=AMIGOXXXXXXXX
 */
import "dotenv/config";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { isEntryPoint } from "../src/lib/entry-point";
import { normalizeAccessCode } from "../src/lib/access-code-format";
import { storedDateTime } from "./stored-datetime.mjs";

function flag(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (hit === undefined) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "";
}

function fail(message: string): never {
  console.error(`ОТКАЗ: ${message}`);
  process.exit(1);
}

/** Та же база, что у сайта, — и два запрета вокруг неё. */
function openDatabase() {
  // Первый запрет: боевая база. Стенд пишет строки; попасть этим в Turso
  // значит испортить настоящую партию.
  if (process.env.TURSO_DATABASE_URL) {
    fail("TURSO_DATABASE_URL задан. Этот стенд пишет в базу и к боевой не подпускается вовсе.");
  }
  // Второй: он существует только для прогона Playwright, который сам ставит
  // этот признак (playwright.config.ts — тот же признак у
  // /api/test/grant-subscription).
  if (process.env.E2E_TEST_SEED !== "1") {
    fail("E2E_TEST_SEED != 1. Стенд заводится только прогоном e2e.");
  }
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) fail(`DATABASE_URL не локальный файл: ${url.slice(0, 24)}…`);
  const file = path.resolve(process.cwd(), url.slice("file:".length));
  const db = new Database(file);
  // Ждать замок, а не падать: сервер прогона пишет в тот же файл.
  db.pragma("busy_timeout = 20000");
  return db;
}

const DAY = 24 * 60 * 60 * 1000;

function main() {
  const command = process.argv[2];
  if (command !== "create" && command !== "show") {
    fail(`первым аргументом нужен create или show, получено "${command ?? ""}".`);
  }

  const raw = flag("code");
  if (raw === undefined || raw === "") fail("--code обязателен.");
  const code = normalizeAccessCode(raw);

  const db = openDatabase();
  try {
    if (command === "show") {
      const row = db
        .prepare(
          `SELECT tier, durationDays, expiresAt, redeemedAt, redeemedById, revokedAt, revokedById
             FROM AccessCode WHERE code = ?`
        )
        .get(code) as Record<string, unknown> | undefined;
      // JSON, а не проза: читает это спека, а не человек.
      console.log(JSON.stringify(row === undefined ? { found: false } : { found: true, ...row }));
      return;
    }

    const expired = flag("expired") !== undefined;
    const revoked = flag("revoked") !== undefined;
    const days = Number(flag("days") ?? 90);
    if (!Number.isInteger(days) || days < 1) fail(`--days должен быть целым ≥ 1, получено "${flag("days")}".`);

    const now = Date.now();
    db.prepare(
      `INSERT INTO AccessCode (id, code, tier, durationDays, expiresAt, batch, revokedAt, createdAt)
       VALUES (?, ?, 'standard', ?, ?, 'E2E', ?, ?)`
    ).run(
      `e2e_${randomUUID()}`,
      code,
      days,
      // Просроченный — вчерашним сроком годности. Скрипт выпуска такую
      // партию выдать отказывается («мертва в момент выпуска»), и это верно
      // для выпуска; стенду нужна ровно она.
      storedDateTime(new Date(expired ? now - DAY : now + 30 * DAY)),
      revoked ? storedDateTime(new Date(now - 60_000)) : null,
      storedDateTime(new Date())
    );
    console.log(JSON.stringify({ created: code, expired, revoked, days }));
  } finally {
    db.close();
  }
}

if (isEntryPoint(import.meta.url)) main();
