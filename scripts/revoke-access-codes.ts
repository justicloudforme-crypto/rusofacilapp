/**
 * Отзыв кодов доступа ДО погашения (PROGRESS.md 7.146).
 *
 * Отзывается либо один код, либо партия целиком:
 *
 *     npm run access-codes:revoke -- --code=AMIGO-K7M2-QW9F --by=вы@почта --dry-run
 *     npm run access-codes:revoke -- --batch=AMIGO-2026-09-08 --by=вы@почта --commit
 *
 * `--by=` ОБЯЗАТЕЛЕН, и без него скрипт не работает вовсе (PROGRESS.md
 * 7.147, долг 89). До 08.09.2026 отзыв скриптом писал в `revokedById` `null`:
 * колонка в схеме есть, вопрос «кто отозвал» задан — и ответа на него не
 * было ни у одной строки, отозванной единственным существующим способом.
 * Это хуже, чем отсутствие колонки: отсутствие видно, а `null` выглядит как
 * ответ «никто». Признак принимается почтой или идентификатором аккаунта и
 * ПРОВЕРЯЕТСЯ по таблице `User` — выдуманное значение не пройдёт, потому что
 * на колонке настоящий внешний ключ, и запись упала бы уже в базе, посреди
 * партии.
 *
 * ПОГАШЕННЫЙ КОД ОТОЗВАТЬ НЕЛЬЗЯ, и это продуктовое правило, а не
 * техническое ограничение: отзыв кода означает «бумажка не сработает», а уже
 * выданный доступ отзывается своим способом (`/api/admin/subscriptions/revoke`),
 * потому что у него другая цена — человек им уже пользуется. Скрипт считает
 * погашенные строки и печатает их числом, а не молча пропускает.
 *
 * Условие `revokedAt: null, redeemedAt: null` стоит в самом UPDATE, а не в
 * предварительном чтении: между чтением и записью пролезает погашение, и
 * проигрыш этой гонки означал бы отозванный код, за который доступ уже выдан.
 *
 * `--force` отвергается явно — как и в скрипте выпуска.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";
import { normalizeAccessCode } from "../src/lib/access-code-format";

function flag(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (hit === undefined) return undefined;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : "";
}

function fail(message: string): never {
  console.error(`ОТКАЗ: ${message}`);
  process.exit(1);
}

function makeClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });
}

async function main() {
  if (flag("force") !== undefined) {
    fail("флаг --force здесь не поддерживается намеренно: погашенный код не отзывается ничем.");
  }

  const dryRun = flag("dry-run") !== undefined;
  const commit = flag("commit") !== undefined;
  if (dryRun === commit) fail("нужен ровно один из флагов --dry-run или --commit.");

  const codeRaw = flag("code");
  const batch = flag("batch");
  if ((codeRaw === undefined) === (batch === undefined)) {
    fail("нужен ровно один из --code=… или --batch=….");
  }

  const by = flag("by");
  if (by === undefined || by.trim() === "") {
    fail(
      "--by=<почта или id аккаунта> обязателен: отзыв обязан знать, кто его сделал. " +
        "Колонка revokedById для этого и заведена, а null в ней выглядит как ответ «никто» " +
        "и неотличим от отзыва, сделанного кем угодно."
    );
  }

  const where = codeRaw !== undefined ? { code: normalizeAccessCode(codeRaw) } : { batch: batch! };

  const db = makeClient();
  try {
    // Исполнитель проверяется ДО чтения кодов и до любой записи. На колонке
    // настоящий внешний ключ: выдуманный идентификатор уронил бы UPDATE уже
    // внутри базы — то есть посреди партии, отозвав часть её.
    const needle = by.trim();
    const actor =
      (await db.user.findUnique({ where: { email: needle.toLowerCase() }, select: { id: true, email: true, role: true } })) ??
      (await db.user.findUnique({ where: { id: needle }, select: { id: true, email: true, role: true } }));
    if (!actor) fail(`--by="${needle}": такого аккаунта нет ни по почте, ни по идентификатору.`);
    console.log(`Отзыв делает:       ${actor.email} (${actor.role}, ${actor.id})`);

    const rows = await db.accessCode.findMany({
      where,
      select: { code: true, batch: true, redeemedAt: true, revokedAt: true },
    });
    if (rows.length === 0) fail(`ничего не найдено по ${JSON.stringify(where)}.`);

    const redeemed = rows.filter((r) => r.redeemedAt !== null);
    const alreadyRevoked = rows.filter((r) => r.redeemedAt === null && r.revokedAt !== null);
    const revocable = rows.filter((r) => r.redeemedAt === null && r.revokedAt === null);

    console.log(`Найдено строк:      ${rows.length}`);
    console.log(`Уже погашено:       ${redeemed.length} (эти НЕ отзываются)`);
    console.log(`Уже отозвано:       ${alreadyRevoked.length}`);
    console.log(`Будет отозвано:     ${revocable.length}`);
    console.log(`База:               ${process.env.TURSO_DATABASE_URL ? "TURSO (боевая!)" : process.env.DATABASE_URL ?? "file:./dev.db"}`);

    if (dryRun) {
      console.log("");
      console.log("--dry-run: в базу НЕ записано ничего. Повторить с --commit.");
      return;
    }

    // Условие повторено в самом UPDATE: чтение выше — только для отчёта.
    const { count } = await db.accessCode.updateMany({
      where: { ...where, redeemedAt: null, revokedAt: null },
      data: { revokedAt: new Date(), revokedById: actor.id },
    });
    console.log("");
    console.log(`Отозвано строк: ${count}, отзыв записан за ${actor.email}.`);
  } finally {
    await db.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
