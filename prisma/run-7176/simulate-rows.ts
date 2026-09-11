/**
 * Заход 7.176: копия снимка прода с ТЕМИ ЖЕ семью строками, что запишет
 * `write-cuts.ts`. Нужна ровно для одного — доказать ДО записи, что
 * серверный HTML 330 замороженных URL от появления этих строк не
 * двигается (`frozen-html.mjs`).
 *
 * Ключ, текст, хэш текста, голос, модель и длительность берутся из плана
 * и считаются ТЕМ ЖЕ кодом, что у писателя (`blobPathFor`, `textHashFor`
 * импортируются, а не переписываются), — иначе «до» и «после» сравнивали
 * бы разные вещи.
 *
 *   npx tsx prisma/run-7176/simulate-rows.ts --plan=… --from=… --to=…
 */
import { copyFileSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { blobPathFor, textHashFor, type PlanRow } from "./write-cuts";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const PLAN = arg("plan")!, FROM = arg("from")!, TO = arg("to")!;
const PREFIX = "https://0xvmk87qe017z4ei.public.blob.vercel-storage.com/";

const plan = JSON.parse(readFileSync(PLAN, "utf-8")) as PlanRow[];
copyFileSync(FROM, TO);
const db = new Database(TO);
const now = new Date().toISOString();
const stmt = db.prepare(
  `insert into AudioAsset (id, contentType, contentId, itemKey, textHash, text, voice, model, audioUrl, createdAt, updatedAt, durationSeconds)
   values (?, 'story-word', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
let i = 0;
for (const r of plan) {
  stmt.run(`sim7176${String(++i).padStart(17, "0")}`, r.storyId, r.itemKey, textHashFor(r), r.word,
    r.voice, r.model, `${PREFIX}${blobPathFor(r, r.sha256)}`, now, now, r.seconds);
}
const n = db.prepare("select count(*) c from AudioAsset where contentType='story-word'").get() as { c: number };
db.close();
console.log(`копия снимка: ${TO}; добавлено строк ${i}; story-word в копии ${n.c}`);
