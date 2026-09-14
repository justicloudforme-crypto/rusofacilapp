/**
 * РАЗОВАЯ МИГРАЦИЯ: строки, отменённые СТАРЫМ кодом, отдают человеку
 * оплаченный период обратно (долг 195, заход 7.194).
 *
 * ====================================================================
 * ЗАЧЕМ ОНА ВООБЩЕ НУЖНА
 * ====================================================================
 *
 * До 13.09.2026 отмена подписки звала `stripe.subscriptions.cancel()` и
 * тут же ставила строке `status: "canceled"`. Доступ закрывался В ТУ ЖЕ
 * СЕКУНДУ, хотя оплаченный период ещё шёл: `isSubscriptionActive`
 * отвергает `canceled` раньше, чем смотрит на дату. Заход 7.193 это
 * починил — теперь отмена идёт через `cancel_at_period_end`, строка
 * остаётся `active`, а факт отмены записывается в новую колонку
 * `canceledAt`.
 *
 * Правка верна и работает — но только для отмен, СДЕЛАННЫХ ПОСЛЕ НЕЁ.
 * Строки, отменённые до 13.09.2026, так и лежат со словом `canceled` в
 * колонке и пустым `canceledAt`, и человек по-прежнему не видит того, за
 * что заплатил. Кода это не лечит и вылечить не может: код правит
 * будущее, а не прошлое. Лечит ровно это — разовая запись.
 *
 * ЗАМЕР ПО БОЕВОЙ БАЗЕ (только чтение, 14.09.2026): строк `Subscription`
 * шесть, под правило подпадает ОДНА —
 * `cmszbb7fg000104lb96t5obn4`, план `monthly`, `status: canceled`,
 * `currentPeriodEnd: 2026-09-18T23:47:02Z` (в будущем), `canceledAt: NULL`,
 * `updatedAt: 2026-08-19T00:07:52Z`. Остальные пять — `active`.
 *
 * ====================================================================
 * ЧТО ИМЕННО ОНА ДЕЛАЕТ
 * ====================================================================
 *
 * Под правило попадает строка, у которой ВСЕ ТРИ условия сразу:
 *
 *   1. `status = "canceled"` — отменена;
 *   2. `currentPeriodEnd > now` — оплаченный период ЕЩЁ ИДЁТ;
 *   3. `canceledAt IS NULL` — отметки новой правки нет, значит слово в
 *      колонке поставил старый код.
 *
 * Ей ставится `status: "active"` и `canceledAt = updatedAt` — то есть
 * ровно то состояние, в котором её оставила бы сегодняшняя отмена. После
 * этого `getDisplayStatus` отвечает `canceling`, экран говорит «Активна
 * до <дата>, продление отключено», а доступ живёт до конца периода и
 * гаснет сам по дате.
 *
 * ТРЕТЬЕ УСЛОВИЕ — ЭТО ЗАЩИТА, А НЕ УКРАШЕНИЕ. Без него под правило
 * попала бы строка, СНЯТАЯ АДМИНИСТРАТОРОМ (`/api/admin/subscriptions/revoke`
 * ставит `canceled`, не трогая период) — и миграция вернула бы доступ,
 * который человек забрал намеренно. Возврат денег под правило не
 * попадает по построению: `revokeAccessForPayment` обрезает
 * `currentPeriodEnd` до «сейчас», то есть условие 2 у такой строки ложно.
 *
 * ====================================================================
 * КАК ЗАПУСКАТЬ
 * ====================================================================
 *
 *   # 1. сухой прогон — НИЧЕГО не пишет, печатает таблицу к записи
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… \
 *     npx tsx prisma/migrate-canceled-with-running-period.ts --dry-run
 *
 *   # 2. запись ПОИМЁННО, по одной строке, id из сухого прогона
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… \
 *     npx tsx prisma/migrate-canceled-with-running-period.ts --only=cmszbb7fg000104lb96t5obn4
 *
 * `--dry-run` — умолчание: запуск без флагов ничего не пишет. Записать
 * можно ТОЛЬКО поимённо: массового `--apply` у этого скрипта нет вовсе, и
 * `--force` он не понимает — попытка передать его кончается отказом.
 * Причина простая: строк под правило одна, «на всякий случай применить ко
 * всем» здесь не может быть правильным ответом никогда.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isEntryPoint } from "../src/lib/entry-point";

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length) : null;
const dryRun = !only;

const url = process.env.TURSO_DATABASE_URL ?? "";
const token = process.env.TURSO_AUTH_TOKEN ?? "";

function refuse(message: string): never {
  console.error(`ОТКАЗ: ${message}`);
  process.exit(1);
}

export async function main(): Promise<number> {
  if (args.includes("--force")) {
    refuse(
      "`--force` этот скрипт не понимает и понимать не будет. Строк под правило единицы, " +
        "и записывать их можно только поимённо через --only=<id>.",
    );
  }
  if (!url || !token) {
    refuse("не заданы TURSO_DATABASE_URL и TURSO_AUTH_TOKEN — читать нечего.");
  }

  const db = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: token }) });
  try {
    const all = await db.subscription.findMany({ orderBy: { createdAt: "asc" } });
    const now = Date.now();
    const targets = all.filter(
      (row) =>
        row.status === "canceled" &&
        row.currentPeriodEnd.getTime() > now &&
        row.canceledAt === null,
    );

    console.log(`Строк Subscription в базе: ${all.length}`);
    console.log(`Под правило (canceled + период ещё идёт + canceledAt пуст): ${targets.length}`);
    if (targets.length === 0) {
      console.log("Писать нечего.");
      return 0;
    }

    console.log("");
    console.log("id | plan | status | currentPeriodEnd | canceledAt | updatedAt | СТАНЕТ");
    for (const row of targets) {
      console.log(
        `${row.id} | ${row.plan} | ${row.status} | ${row.currentPeriodEnd.toISOString()} | ` +
          `${row.canceledAt?.toISOString() ?? "NULL"} | ${row.updatedAt.toISOString()} | ` +
          `status=active, canceledAt=${row.updatedAt.toISOString()}`,
      );
    }
    console.log("");

    if (dryRun) {
      console.log(
        "СУХОЙ ПРОГОН: не записано ни одной строки. Чтобы записать, повторите с --only=<id> " +
          "по одному id из таблицы выше.",
      );
      return 0;
    }

    const target = targets.find((row) => row.id === only);
    if (!target) {
      refuse(
        `строки ${only} среди подпадающих под правило нет. Сухой прогон выше называет все, ` +
          `которые есть; писать в строку, которой правило не касается, этот скрипт не станет.`,
      );
    }
    await db.subscription.update({
      where: { id: target.id },
      data: { status: "active", canceledAt: target.updatedAt },
    });
    const after = await db.subscription.findUnique({ where: { id: target.id } });
    console.log(
      `ЗАПИСАНО: ${target.id} → status=${after?.status}, canceledAt=${after?.canceledAt?.toISOString() ?? "NULL"}`,
    );
    return 0;
  } finally {
    await db.$disconnect();
  }
}

if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
