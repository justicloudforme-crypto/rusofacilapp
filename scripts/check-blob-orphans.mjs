/**
 * «Объектов записи голоса, переживших своих владельцев, — ноль» — сторож
 * долга 167 (заход 7.187).
 *
 * ЧТО БЫЛО, И ПОЧЕМУ ЭТО ДОКАЗАНО ЧИСЛОМ, А НЕ РАССУЖДЕНИЕМ. Путей
 * удаления учётной записи два, и дырявы были оба. Первый —
 * `src/app/api/auth/confirm-account-deletion/route.ts` — звал уборку через
 * `.catch(() => {})`: строка `User` удалялась следующей командой в любом
 * случае, поэтому сбой уборки не откатывал удаление, не писался в журнал
 * и не уходил в Sentry, а вместе со строкой исчезал id, по которому объект
 * можно было бы найти. Второй — `prisma/delete-test-accounts.ts` — про
 * объекты не знал вовсе (вхождений `voice` и `blob` — 0). Каким из двух
 * ушли три объекта долга 24, различить нечем: оба объясняют результат
 * одинаково, и это само по себе следствие болезни.
 *
 * ДВЕ ПОЛОВИНЫ, И ВТОРАЯ — ГЛАВНАЯ.
 *
 *  1. СТАТИЧЕСКАЯ, гоняется всегда и в CI: оба пути зовут ОДНУ уборку,
 *     в первом она не завёрнута в молчаливый `catch`, во втором отказ
 *     уборки отменяет удаление строки. Без этого первые две правки
 *     остались бы обещанием.
 *  2. ЖИВАЯ, гоняется там, где есть ключи: читается САМО ХРАНИЛИЩЕ и
 *     сама база — «объектов под `submissions/`, чей `userId` не находится
 *     в `User`». Обе дыры этого класса видны только со стороны
 *     хранилища, а не со стороны кода, и потому статической половины
 *     СОВЕРШЕННО НЕДОСТАТОЧНО: она стережёт код, а сироты живут не в коде.
 *
 * ЧЕСТНАЯ ГРАНИЦА. В CI боевых ключей нет и быть не должно, поэтому там
 * гоняется первая половина, а вторая молча пропускается — но НЕ молча:
 * она печатает, что пропущена, и почему. Правило правил проекта («0 без
 * позитивного контроля не считается результатом») закрыто тем, что
 * отбор сирот — чистая функция `orphansAmong` из
 * src/lib/voice-blob-cleanup.ts, и подсадка гоняет именно её.
 *
 *   node scripts/check-blob-orphans.mjs          # статическая половина (+ живая, если есть ключи)
 *   node scripts/check-blob-orphans.mjs --live   # живая обязана состояться, иначе отказ
 *   node scripts/check-blob-orphans.mjs --plant  # позитивный и отрицательный контроль
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { orphansAmong, userIdFromSubmissionPath } from "../src/lib/voice-blob-cleanup.ts";

const ARGS = process.argv.slice(2);
const PLANT = ARGS.includes("--plant");
const REQUIRE_LIVE = ARGS.includes("--live");

const ROUTE = "src/app/api/auth/confirm-account-deletion/route.ts";
const SCRIPT = "prisma/delete-test-accounts.ts";
const CLEANUP = "src/lib/voice-blob-cleanup.ts";

/** Статическое правило — вынесено, чтобы подсадка меряла ту же функцию. */
export function structureViolations(route, script, cleanup) {
  const bad = [];

  if (!/deleteAllVoiceSubmissionsForUser/.test(route)) {
    bad.push(`${ROUTE}: путь живого человека не зовёт уборку объектов вовсе`);
  }
  if (/deleteAllVoiceSubmissionsForUser\([^)]*\)\s*\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/.test(route)) {
    bad.push(`${ROUTE}: уборка снова завёрнута в МОЛЧАЛИВЫЙ catch — отказ не оставит следа (долг 167)`);
  }
  if (!/Sentry\.captureException/.test(route)) {
    bad.push(`${ROUTE}: отказ уборки не уходит в Sentry — узнать о нём будет неоткуда`);
  }

  if (!/deleteAllVoiceSubmissionsForUser/.test(script)) {
    bad.push(`${SCRIPT}: второй путь удаления снова не знает про объекты хранилища (долг 167)`);
  } else {
    // Порядок: уборка обязана стоять ДО удаления строки. Сравниваются
    // позиции в тексте — грубо, но ровно этот порядок и есть правило.
    const cleanupAt = script.indexOf("deleteAllVoiceSubmissionsForUser(c.id)");
    const deleteAt = script.indexOf("db.user.delete(");
    if (cleanupAt === -1 || deleteAt === -1 || cleanupAt > deleteAt) {
      bad.push(`${SCRIPT}: строка удаляется раньше объектов — сироту потом не найти`);
    }
  }

  if (/import\s+["']server-only["']/.test(cleanup)) {
    bad.push(`${CLEANUP}: помечен server-only — из скрипта его не импортировать, и пути снова разойдутся`);
  }
  return bad;
}

async function live() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const dbUrl = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!token || !dbUrl) {
    return { ran: false, why: `нет ${!token ? "BLOB_READ_WRITE_TOKEN" : "адреса базы"} — живая половина пропущена` };
  }
  const { list } = await import("@vercel/blob");
  const pathnames = [];
  let cursor;
  do {
    const page = await list({ prefix: "submissions/", cursor, limit: 1000 });
    pathnames.push(...page.blobs.map((b) => b.pathname));
    cursor = page.cursor;
  } while (cursor);

  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const db = new PrismaClient({
    adapter: new PrismaLibSql({ url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN }),
  });
  try {
    const users = await db.user.findMany({ select: { id: true } });
    const orphans = orphansAmong(pathnames, users.map((u) => u.id));
    return { ran: true, objects: pathnames.length, users: users.length, orphans };
  } finally {
    await db.$disconnect();
  }
}

function plant() {
  const route = readFileSync(ROUTE, "utf8");
  const script = readFileSync(SCRIPT, "utf8");
  const cleanup = readFileSync(CLEANUP, "utf8");
  const cases = [];
  const say = (name, ok) => cases.push({ name, ok });

  say("отрицательный контроль: живой код сегодня чист", structureViolations(route, script, cleanup).length === 0);

  const planted = (mutatedRoute, mutatedScript, mutatedCleanup, name, expect) => {
    const found = structureViolations(mutatedRoute, mutatedScript, mutatedCleanup);
    say(name, found.some((f) => f.includes(expect)));
  };
  planted(
    "await deleteAllVoiceSubmissionsForUser(user.id).catch(() => {});\nSentry.captureException(e);",
    script, cleanup,
    "подсадка: НАСТОЯЩИЙ старый молчаливый catch — пойман",
    "МОЛЧАЛИВЫЙ catch",
  );
  planted(route.replace(/Sentry\.captureException/g, "ignore"), script, cleanup,
    "подсадка: отчёт в Sentry сняли — поймано", "не уходит в Sentry");
  planted(route, script.replaceAll("deleteAllVoiceSubmissionsForUser", "noop"), cleanup,
    "подсадка: второй путь снова не знает про объекты — поймано", "не знает про объекты");
  planted(
    route,
    "await db.user.delete({ where: { id: c.id } });\nawait deleteAllVoiceSubmissionsForUser(c.id);",
    cleanup,
    "подсадка: строка удаляется раньше объектов — поймано",
    "раньше объектов",
  );
  planted(route, script, 'import "server-only";\n' + cleanup,
    "подсадка: уборку пометили server-only — поймано", "server-only");

  // ЖИВОЕ ПРАВИЛО — на чистой функции, без хранилища и без базы.
  const paths = [
    "submissions/user-alive/0001.webm",
    "submissions/user-alive/0002.webm",
    "submissions/user-gone/0003.webm",
    "submissions/",
    "audio/stories/repka.mp3",
  ];
  const found = orphansAmong(paths, ["user-alive"]);
  say("подсадка: сирота среди объектов найдена, и ровно одна", found.length === 1 && found[0].userId === "user-gone");
  say("отрицательный контроль: когда все владельцы живы — 0", orphansAmong(paths, ["user-alive", "user-gone"]).length === 0);
  say("отрицательный контроль: чужой префикс сиротой не считается", userIdFromSubmissionPath("audio/stories/x.mp3") === null);
  say("отрицательный контроль: голый префикс без владельца пропускается", userIdFromSubmissionPath("submissions/") === null);

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:blob-orphans --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

async function main() {
  if (PLANT) return plant();
  const bad = structureViolations(
    readFileSync(ROUTE, "utf8"),
    readFileSync(SCRIPT, "utf8"),
    readFileSync(CLEANUP, "utf8"),
  );
  if (bad.length) {
    console.error("УБОРКА ХРАНИЛИЩА СНОВА МОЖЕТ НЕ СЛУЧИТЬСЯ МОЛЧА (долг 167):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("[check:blob-orphans] статическая половина: оба пути зовут одну уборку, молчаливого catch нет, порядок «объекты → строка» соблюдён.");

  const result = await live();
  if (!result.ran) {
    if (REQUIRE_LIVE) {
      console.error(`живая половина обязана была состояться: ${result.why}`);
      return 1;
    }
    console.log(`живая половина: ${result.why} (запускать с боевыми ключами: npm run check:blob-orphans:live)`);
    return 0;
  }
  console.log(`живая половина: объектов под submissions/ ${result.objects}, учётных записей ${result.users}, сирот ${result.orphans.length}`);
  if (result.orphans.length > 0) {
    console.error("\nОБЪЕКТЫ ПЕРЕЖИЛИ СВОИХ ВЛАДЕЛЬЦЕВ (долг 167):");
    for (const o of result.orphans) console.error(`  ${o.pathname} — владельца ${o.userId} в User нет`);
    return 1;
  }
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = await main();
