/**
 * Снимает ТОЧНЫЙ SQL, который Prisma отправляет для двух запросов,
 * упирающихся в `AudioAsset.text` (заход 7.173, долг 135).
 *
 * Ходит ТОЛЬКО по локальному снимку прода (`--db=file:…`), в боевую базу
 * не обращается ни одним запросом. Нужен, чтобы тот же SQL с теми же
 * параметрами можно было повторить на проде и взять цену из `rows_read`,
 * а не из модели.
 */
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url = process.argv.find((a) => a.startsWith("--db="))?.slice(5);
if (!url) throw new Error("нужен --db=file:/абсолютный/путь.db");

const client = new PrismaClient({
  adapter: new PrismaLibSql({ url }),
  log: [{ emit: "event", level: "query" }],
});
client.$on("query", (e) => console.log(JSON.stringify({ query: e.query, params: e.params })));

const WORDS = ["космонавт", "полёт", "космос", "ракета", "старт", "Земля"];

async function main() {
await client.audioAsset.findMany({
  where: { text: { in: WORDS }, NOT: { contentType: "story" } },
  select: { contentType: true, contentId: true, itemKey: true, text: true, audioUrl: true },
  orderBy: [{ contentType: "asc" }, { contentId: "asc" }, { itemKey: "asc" }],
});

await client.audioAsset.findMany({
  where: { voice: "onyx", NOT: { contentType: "story" }, OR: [{ text: "Москва" }, { text: "москва" }] },
  select: { contentType: true, contentId: true, itemKey: true, text: true, audioUrl: true },
  orderBy: [{ contentType: "asc" }, { contentId: "asc" }, { itemKey: "asc" }],
});

await client.$disconnect();
}
main();
