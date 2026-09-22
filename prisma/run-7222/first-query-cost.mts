/**
 * КУДА УХОДЯТ 1,586 с ИЗ СТРОКИ ДОЛГА 286 — ОПЫТ, А НЕ ВЕРСИЯ.
 *
 * Панель Sentry (`JAVASCRIPT-NEXTJS-T`, Slow DB Query по `Story`,
 * `GET /[lang]/stories/[id]`): `db-SELECT` **1,60 с** при http-вызове в
 * Turso **14,23 мс** — то есть 99,1 % времени запроса потрачено НЕ на сеть
 * и НЕ на удалённую базу. Строка долга называет три версии: сериализация
 * Prisma, холодный старт функции, размер самой строки `Story`.
 *
 * ТРЕТЬЯ УБИТА ОТДЕЛЬНЫМ ЗАМЕРОМ (7.222, только SELECT против прода):
 * у `Story` 325 строк, `text` не длиннее 3771 знака при среднем 1160,
 * `translationEs` не длиннее 4370 при среднем 1336; ВСЯ таблица — 811 504
 * байта текста. Полторы секунды на такую строку потратить не на что.
 *
 * Здесь меряются первая и вторая, и порядок опытов важен:
 *
 *   ОПЫТ А — СВЕЖИЙ процесс: засекается самый первый запрос Prisma и пять
 *   следующих за ним на том же клиенте. Это и есть «холодный экземпляр».
 *
 *   ОПЫТ Б — тот же процесс, уже прогретый: сперва сырой драйвер
 *   `@libsql/client` (его первый запрос платит установку соединения и
 *   TLS), потом НОВЫЙ клиент Prisma поверх того же адреса. Разница между
 *   первым запросом Prisma в прогретом процессе и его же установившимся
 *   временем — это цена САМОЙ Prisma, отдельно от всего прочего.
 *
 * Цена прогона: 16 прочитанных строк, ни одной записи.
 *
 *   npx tsx prisma/run-7222/first-query-cost.mts            # dev.db
 *   npx tsx prisma/run-7222/first-query-cost.mts --prod     # боевая, SELECT
 */
import { createClient } from "@libsql/client";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const useProd = process.argv.includes("--prod");
const url = useProd ? process.env.TURSO_DATABASE_URL : `file:${process.cwd()}/dev.db`;
const authToken = useProd ? process.env.TURSO_AUTH_TOKEN : undefined;
if (!url) throw new Error("нет адреса базы: для --prod нужен TURSO_DATABASE_URL");

const ms = (from: number) => Date.now() - from;
const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

// ОПЫТ А — свежий процесс.
let t = Date.now();
const cold = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken }) });
const constructed = ms(t);
t = Date.now();
const first = await cold.story.findFirst({ select: { id: true } });
const coldFirst = ms(t);
if (!first) throw new Error("в базе нет ни одного рассказа — мерить нечего");
const coldRest: number[] = [];
for (let i = 0; i < 5; i++) {
  t = Date.now();
  await cold.story.findUnique({ where: { id: first.id } });
  coldRest.push(ms(t));
}

// ОПЫТ Б — тот же процесс, уже прогретый.
const raw = createClient({ url, authToken });
t = Date.now();
await raw.execute("SELECT id FROM Story LIMIT 1");
const rawFirst = ms(t);
const rawRest: number[] = [];
for (let i = 0; i < 4; i++) {
  t = Date.now();
  await raw.execute("SELECT id FROM Story LIMIT 1");
  rawRest.push(ms(t));
}
const warm = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken }) });
t = Date.now();
await warm.story.findFirst({ select: { id: true } });
const warmFirst = ms(t);
const warmRest: number[] = [];
for (let i = 0; i < 4; i++) {
  t = Date.now();
  await warm.story.findFirst({ select: { id: true } });
  warmRest.push(ms(t));
}

console.log(`база: ${useProd ? "БОЕВАЯ (только SELECT)" : "локальный файл dev.db"}`);
console.log("");
console.log("ОПЫТ А — свежий процесс");
console.log(`  конструктор клиента:            ${constructed} мс`);
console.log(`  ПЕРВЫЙ запрос:                  ${coldFirst} мс`);
console.log(`  следующие пять:                 ${coldRest.join(", ")} мс`);
console.log("");
console.log("ОПЫТ Б — тот же процесс, уже прогретый");
console.log(`  сырой драйвер, первый:          ${rawFirst} мс, дальше ${rawRest.join(", ")} мс`);
console.log(`  Prisma новым клиентом, первый:  ${warmFirst} мс, дальше ${warmRest.join(", ")} мс`);
console.log("");
console.log(`РАЗБОР ПЕРВОГО ЗАПРОСА (${coldFirst} мс):`);
console.log(`  установившееся время запроса:   ${avg(warmRest)} мс`);
console.log(`  надбавка Prisma в прогретом:    ${warmFirst - avg(warmRest)} мс`);
console.log(`  ОСТАТОК — холодный старт:       ${coldFirst - warmFirst} мс`);
console.log("");
console.log("прочитано строк за прогон: 16, записей 0");
await cold.$disconnect();
await warm.$disconnect();
