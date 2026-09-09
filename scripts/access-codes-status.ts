/**
 * Состояние партии кодов доступа одной командой (PROGRESS.md 7.151).
 *
 *     npm run access-codes:status -- --batch=AMIGO-2026-09-08
 *     npm run access-codes:status -- --batch=AMIGO-2026-09-08 --codes
 *     npm run access-codes:status                       # список всех партий
 *
 * ЭТОТ СКРИПТ НЕ ПИШЕТ В БАЗУ НИ ПРИ КАКОМ ФЛАГЕ, и это не обещание в
 * комментарии, а свойство, которое проверяется чтением его исходника:
 * `npm run check:access-code-path` разбирает ЭТОТ файл и падает, если в нём
 * появится хоть один вызов записи (`create`, `update`, `updateMany`,
 * `upsert`, `delete`, `deleteMany`, `createMany`, `$executeRaw`,
 * `$transaction`). Контроль к правилу — подсадка такого вызова, которая
 * обязана быть поймана (`check:access-code-path --plant`).
 *
 * Флагов, меняющих поведение записи, здесь нет вовсе — ни `--commit`, ни
 * `--force`, ни `--dry-run`. Отсутствие `--commit` тут не забывчивость: в
 * скриптах выпуска и отзыва он есть ровно потому, что те пишут, и если бы у
 * этого была своя ветка записи, флаг стоял бы и здесь.
 *
 * ЧТО СЧИТАЕТСЯ. Пять чисел, и границы между ними не перекрываются — каждая
 * строка попадает ровно в одну корзину, а сумма пяти обязана сойтись с числом
 * строк (скрипт это утверждает сам и ругается, если не сошлась):
 *
 *   выдано    — сколько строк в партии всего;
 *   погашено  — redeemedAt не пуст;
 *   отозвано  — redeemedAt пуст, revokedAt не пуст (погашенный код отозвать
 *               нельзя — PROGRESS.md 7.146, часть 6, — поэтому «погашено» и
 *               «отозвано» не пересекаются по построению);
 *   просрочено— не погашен, не отозван, но expiresAt в прошлом;
 *   свободно  — не погашен, не отозван, срок годности жив (или его нет).
 *
 * `--codes` печатает сами коды свободных строк — по одному в строку, в том
 * же виде, в каком их читает человек. По умолчанию НЕ печатает: выпущенный
 * код это доступ на предъявителя, и высыпать пачку таких в терминал (а
 * значит в историю оболочки и в лог сессии) стоит делать намеренно.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import { formatAccessCode } from "../src/lib/access-code-format";

function flag(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (hit === undefined) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "";
}

function fail(message: string): never {
  console.error(`ОТКАЗ: ${message}`);
  process.exit(1);
}

/** Тот же выбор базы, что делает приложение (src/lib/db.ts). */
function makeClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });
}

type Row = {
  code: string;
  batch: string | null;
  expiresAt: Date | null;
  redeemedAt: Date | null;
  revokedAt: Date | null;
};

/** Раскладка строк по пяти непересекающимся корзинам. Вынесена отдельно,
 * потому что её проверяет тест без базы. */
export function bucketAccessCodes(rows: Row[], now: Date) {
  const redeemed = rows.filter((r) => r.redeemedAt !== null);
  const rest = rows.filter((r) => r.redeemedAt === null);
  const revoked = rest.filter((r) => r.revokedAt !== null);
  const live = rest.filter((r) => r.revokedAt === null);
  const expired = live.filter((r) => r.expiresAt !== null && r.expiresAt.getTime() <= now.getTime());
  const free = live.filter((r) => r.expiresAt === null || r.expiresAt.getTime() > now.getTime());
  return { issued: rows.length, redeemed, revoked, expired, free };
}

async function main() {
  for (const forbidden of ["commit", "force", "dry-run", "apply"]) {
    if (flag(forbidden) !== undefined) {
      fail(
        `флаг --${forbidden} здесь не существует: этот скрипт только читает. ` +
          `Выпуск партии — access-codes:generate, отзыв — access-codes:revoke.`
      );
    }
  }

  const batch = flag("batch");
  const withCodes = flag("codes") !== undefined;

  const db = makeClient();
  try {
    console.log(
      `База:      ${process.env.TURSO_DATABASE_URL ? "TURSO (боевая, только чтение)" : process.env.DATABASE_URL ?? "file:./dev.db"}`
    );

    if (batch === undefined) {
      const all = await db.accessCode.findMany({
        select: { batch: true, redeemedAt: true, revokedAt: true, expiresAt: true, code: true },
      });
      if (all.length === 0) {
        console.log("Строк AccessCode в этой базе нет вовсе.");
        return;
      }
      const names = [...new Set(all.map((r) => r.batch ?? "(без метки)"))].sort();
      console.log(`Партий:    ${names.length}, строк всего: ${all.length}`);
      console.log("");
      console.log("| партия | выдано | погашено | отозвано | просрочено | свободно |");
      console.log("|---|---:|---:|---:|---:|---:|");
      const now = new Date();
      for (const name of names) {
        const rows = all.filter((r) => (r.batch ?? "(без метки)") === name);
        const b = bucketAccessCodes(rows, now);
        console.log(
          `| ${name} | ${b.issued} | ${b.redeemed.length} | ${b.revoked.length} | ${b.expired.length} | ${b.free.length} |`
        );
      }
      console.log("");
      console.log("Подробности по одной партии: --batch=<имя>.");
      return;
    }

    if (batch.trim() === "") fail("--batch задан пустым. Без имени партии считать нечего.");

    const rows = await db.accessCode.findMany({
      where: { batch },
      select: { code: true, batch: true, expiresAt: true, redeemedAt: true, revokedAt: true },
      orderBy: { code: "asc" },
    });
    if (rows.length === 0) {
      fail(
        `партии "${batch}" в этой базе нет ни одной строки. Проверьте имя: ` +
          `прогон без --batch печатает список всех партий.`
      );
    }

    const now = new Date();
    const b = bucketAccessCodes(rows, now);
    // Сумма обязана сойтись. Если корзины разъедутся, отчёт будет выглядеть
    // правдоподобно и врать — поэтому это утверждение, а не комментарий.
    const sum = b.redeemed.length + b.revoked.length + b.expired.length + b.free.length;
    if (sum !== b.issued) {
      fail(`корзины не сошлись: ${sum} против ${b.issued} строк. Это дефект СЧЁТА, а не данных.`);
    }

    console.log(`Партия:    ${batch}`);
    console.log(`Момент:    ${now.toISOString()}`);
    console.log("");
    console.log(`Выдано:     ${b.issued}`);
    console.log(`Погашено:   ${b.redeemed.length}`);
    console.log(`Отозвано:   ${b.revoked.length}`);
    console.log(`Просрочено: ${b.expired.length}`);
    console.log(`Свободно:   ${b.free.length}`);

    const prefix = commonPrefix(rows.map((r) => r.code));
    if (withCodes) {
      console.log("");
      console.log(`Свободные коды (${b.free.length}):`);
      for (const r of b.free) console.log(`  ${formatAccessCode(r.code, prefix)}`);
    } else if (b.free.length > 0) {
      console.log("");
      console.log("Сами коды не печатаются: это доступ на предъявителя. Повторить с --codes.");
    }
  } finally {
    await db.$disconnect();
  }
}

/** Приставка партии — общее начало всех её кодов. Нужна только для печати
 * группами по четыре; на счёт не влияет. */
function commonPrefix(codes: string[]): string {
  if (codes.length === 0) return "";
  let prefix = codes[0];
  for (const code of codes) {
    while (!code.startsWith(prefix) && prefix.length > 0) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
