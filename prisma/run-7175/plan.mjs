/**
 * 7.175 — план на шесть мест долга 136 и на «стороны».
 *
 * ГОЛОС БЕРЁТСЯ ТОЛЬКО ИЗ КОЛОНКИ `AudioAsset.voice` предложения на
 * свежем снимке прода. Журнальный ярлык голоса (7.168) сюда не попадает
 * вовсе — ровно из-за него и завёлся долг 136. Ярлык печатается рядом
 * ТОЛЬКО как справка о том, чем место звучало раньше.
 *
 * ТЕКСТ СО ЗНАКОМ УДАРЕНИЯ берётся тот же, что в 7.171 (владелец уже
 * одобрил ударение на слух): поле `marked` журнала `A-настоящий.jsonl`.
 * Меняется ТОЛЬКО голос. Совпадение текста проверяется утверждением
 * «снять знаки = предложению из базы знак в знак».
 *
 *   node prisma/run-7175/plan.mjs --out=…
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const OUT = arg("out");
const SNAP = arg("snapshot", "prisma/snapshots/prod-latest.db");
const WORK = `${process.env.HOME}/rusofacil-listen/7.171/работа`;
const MARK = "́";

const held = JSON.parse(readFileSync("prisma/run-7174/held-7174.json", "utf-8"));
const STORONY = { n: 5.5, storyId: "cmsxtqp42004uqwncmhhhk44i", itemKey: "8-0-6", word: "стороны", why: "вхождение не выровнялось на расшифровку (7.171, часть 3)" };

const db = new DatabaseSync(SNAP, { readOnly: true });
const cast = new Map();
for (const r of db.prepare("select contentId, itemKey, voice, audioUrl from AudioAsset where contentType='story'").all())
  cast.set(`${r.contentId}|${r.itemKey}`, r);
const titles = new Map(db.prepare("select id, title, text from Story").all().map((s) => [s.id, s]));

// Текст со знаком ударения из 7.171 — по ключу «рассказ + абзац-предложение-слово».
const marked = new Map();
for (const l of readFileSync(`${WORK}/A-настоящий.jsonl`, "utf-8").trim().split("\n")) {
  const r = JSON.parse(l);
  marked.set(`${r.storyId}|${r.paragraphIndex}-${r.sentenceIndex}-${r.wordIndex}`, r);
}
// Ярлык журнала 7.168 — ТОЛЬКО как справка.
const label = new Map();
for (const l of readFileSync(`${WORK}/homo2.jsonl`, "utf-8").trim().split("\n")) {
  const r = JSON.parse(l);
  label.set(`${r.storyId}|${r.p}-${r.s}-${r.token}`, r);
}
const places = JSON.parse(readFileSync(`${WORK}/places-217.json`, "utf-8"));
const byItemKey = new Map(places.map((p) => [`${p.storyId}|${p.itemKey}`, p]));

const problems = [];
const rows = [...held, STORONY].map((h) => {
  const p = byItemKey.get(`${h.storyId}|${h.itemKey}`);
  if (!p) { problems.push(`нет места ${h.storyId} ${h.itemKey} в places-217`); return null; }
  const sentKey = `${h.storyId}|${p.paragraphIndex}-${p.sentenceIndex}`;
  const c = cast.get(sentKey);
  if (!c) { problems.push(`у предложения ${sentKey} нет записи каста`); return null; }
  const mk = marked.get(`${h.storyId}|${p.paragraphIndex}-${p.sentenceIndex}-${p.wordIndex}`);
  const lb = label.get(`${h.storyId}|${p.paragraphIndex}-${p.sentenceIndex}-${p.wordIndex}`);
  // Утверждение: текст со знаком, снятый до голого, равен предложению базы.
  if (mk && mk.marked.replaceAll(MARK, "") !== p.sentence) problems.push(`текст со знаком не сходится с предложением: ${h.storyId} ${h.itemKey}`);
  if (mk && [...mk.marked].filter((ch) => ch === MARK).length !== 1) problems.push(`знаков ударения не один: ${h.storyId} ${h.itemKey}`);
  return {
    n: h.n, storyId: h.storyId, itemKey: h.itemKey,
    paragraphIndex: p.paragraphIndex, sentenceIndex: p.sentenceIndex,
    wordIndex: p.wordIndex, tokenIndex: p.tokenIndex,
    word: p.word, sentence: p.sentence,
    story: titles.get(h.storyId)?.title ?? "?",
    castVoice: c.voice,                      // ЕДИНСТВЕННЫЙ источник голоса
    sentenceUrl: c.audioUrl,
    journalLabel: lb?.voice ?? null,         // справка, входом не является
    marked: mk?.marked ?? null,
    vowelN: mk?.vowelN ?? null, vowelWhy: mk?.vowelWhy ?? null,
    prevVoice7171: mk ? mk.voice : null,
    why136: h.why,
  };
}).filter(Boolean);

for (const r of rows) {
  console.log(`№${String(r.n).padStart(4)}  ${r.story.padEnd(22)} ${r.itemKey.padEnd(9)} «${r.word}»  каст=${r.castVoice.padEnd(6)} ярлык-журнала=${String(r.journalLabel).padEnd(6)} 7.171-синтез=${String(r.prevVoice7171).padEnd(6)} ${r.marked ? "текст со знаком есть" : "ТЕКСТА СО ЗНАКОМ НЕТ"}`);
}
console.log(`\nмест: ${rows.length}; расхождений плана: ${problems.length}`);
for (const p of problems) console.log(`  ПРОБЛЕМА: ${p}`);
if (OUT) { writeFileSync(OUT, JSON.stringify(rows, null, 1), "utf-8"); console.log(`план записан: ${OUT}`); }
process.exit(problems.length ? 1 : 0);
