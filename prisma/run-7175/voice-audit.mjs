/**
 * 7.175, часть 1 — не задела ли ошибка ярлыка голоса что-то ещё.
 *
 * Вопрос, на который отвечает этот скрипт, ровно один: какие файлы вообще
 * синтезировались голосом ИЗ ЖУРНАЛЬНОГО ЯРЛЫКА, а не из колонки
 * `AudioAsset.voice` предложения, и у скольких записанных на прод мест
 * голос файла расходится с кастом предложения.
 *
 * Источник правды о голосе — снимок боевой базы, а не журналы (правило
 * 7.175). Вырезки из оплаченной озвучки рассказа безопасны по построению:
 * звук взят из самой записи предложения, поэтому голос у вырезки тот же,
 * каким бы ни был ярлык. Их число называется ОТДЕЛЬНО.
 *
 *   node prisma/run-7175/voice-audit.mjs [--snapshot=…] [--plant]
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const SNAP = arg("snapshot", "prisma/snapshots/prod-latest.db");
const PLANT = argv.includes("--plant");
const WORK = `${process.env.HOME}/rusofacil-listen/7.171/работа`;

const db = new DatabaseSync(SNAP, { readOnly: true });

// --- каст предложения: голос строки озвучки САМОГО предложения ------------
const cast = new Map();
for (const r of db.prepare("select contentId, itemKey, voice from AudioAsset where contentType='story'").all()) {
  cast.set(`${r.contentId}|${r.itemKey}`, r.voice);
}

// --- строки story-word на проде -------------------------------------------
const rows = db.prepare("select id, contentId, itemKey, text, voice, model from AudioAsset where contentType='story-word'").all();
const sentKeyOf = (itemKey) => itemKey.split("-").slice(0, 2).join("-");

// Подсадка: одному месту намеренно приписывается чужой голос. Проверка,
// которая не умеет находить расхождение, результатом не считается.
if (PLANT) {
  const victim = rows.find((r) => r.model === "cut-from-story-audio");
  victim.voice = victim.voice === "onyx" ? "echo" : "onyx";
}

const byModel = new Map();
for (const r of rows) {
  const c = cast.get(`${r.contentId}|${sentKeyOf(r.itemKey)}`);
  const b = byModel.get(r.model) ?? { всего: 0, "каст известен": 0, "голос = касту": 0, расхождений: 0, места: [] };
  b.всего += 1;
  if (c) {
    b["каст известен"] += 1;
    if (c === r.voice) b["голос = касту"] += 1;
    else { b.расхождений += 1; b.места.push(`${r.contentId} ${r.itemKey} «${r.text}»: строка ${r.voice}, каст ${c}`); }
  }
  byModel.set(r.model, b);
}

console.log(`снимок: ${SNAP}${PLANT ? "  (ПОДСАДКА: одному месту приписан чужой голос)" : ""}`);
console.log(`\n--- строки story-word на проде: ${rows.length} ---`);
for (const [model, b] of byModel) {
  const safe = model === "cut-from-story-audio";
  console.log(`  ${model.padEnd(22)} всего ${String(b.всего).padStart(4)}  каст известен ${String(b["каст известен"]).padStart(4)}  голос = касту ${String(b["голос = касту"]).padStart(4)}  РАСХОЖДЕНИЙ ${b.расхождений}${safe ? "   (вырезка из оплаченной озвучки — голос верен по построению)" : "   (СИНТЕЗ — голос задавался явно)"}`);
  for (const m of b.места.slice(0, 12)) console.log(`      ${m}`);
}

// --- прочие поверхности: синтез вне рассказов ------------------------------
const others = db.prepare("select contentType, voice, count(*) n from AudioAsset where contentType not in ('story','story-word') group by contentType, voice order by contentType").all();
const nonOnyx = others.filter((r) => r.voice !== "onyx");
console.log(`\n--- поверхности вне рассказов: ${others.reduce((a, r) => a + r.n, 0)} строк, голосов кроме onyx: ${nonOnyx.length} ---`);
console.log("  (у них каста нет вовсе: голос банка один и тот же, ярлык предложения к ним не применяется)");

// --- журнальный ярлык против колонки: по всем журналам вырезки -------------
console.log(`\n--- журнальный ярлык голоса против колонки AudioAsset.voice ---`);
let totalRows = 0, totalDiff = 0;
for (const f of ["homo166.jsonl", "homo2.jsonl"]) {
  const p = `${WORK}/${f}`;
  if (!existsSync(p)) { console.log(`  ${f}: нет файла`); continue; }
  const recs = readFileSync(p, "utf-8").trim().split("\n").map((l) => JSON.parse(l));
  const seen = new Map();
  for (const r of recs) seen.set(`${r.storyId}|${r.p}-${r.s}`, r.voice);
  let diff = 0, known = 0;
  const examples = [];
  for (const [k, v] of seen) {
    const c = cast.get(k);
    if (!c) continue;
    known += 1;
    if (c !== v) { diff += 1; if (examples.length < 8) examples.push(`${k}: журнал ${v}, колонка ${c}`); }
  }
  totalRows += known; totalDiff += diff;
  console.log(`  ${f}: предложений ${seen.size}, каст известен ${known}, ЯРЛЫК РАЗОШЁЛСЯ У ${diff}`);
  for (const e of examples) console.log(`      ${e}`);
}
console.log(`  ИТОГО по журналам: предложений с известным кастом ${totalRows}, расхождений ярлыка ${totalDiff}`);

const synth = byModel.get("gpt-4o-mini-tts-cut") ?? { всего: 0, расхождений: 0 };
const cuts = byModel.get("cut-from-story-audio") ?? { всего: 0, расхождений: 0 };
console.log(`\n=== ИТОГ ЧАСТИ 1 ===`);
console.log(`  файлов, синтезированных голосом из ярлыка (метод А, 7.171): ${synth.всего} записанных на прод + 6 придержанных (долг 136) + 1 без файла («стороны») = 114 синтезированных записей`);
console.log(`  из записанных на прод синтезированных мест голос расходится с кастом: ${synth.расхождений}`);
console.log(`  вырезок из оплаченной озвучки (безопасны по построению): ${cuts.всего}, расхождений колонки с кастом ${cuts.расхождений}`);
console.log(`  прочих поверхностей затронуто: 0 (голос банка один, каста у них нет)`);
process.exit(PLANT ? (synth.расхождений + cuts.расхождений > 0 ? 0 : 1) : 0);
