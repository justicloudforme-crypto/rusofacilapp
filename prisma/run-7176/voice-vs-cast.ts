/**
 * Заход 7.176, часть 3: сплошная сверка «колонка `voice` против каста» по
 * ВСЕМ строкам `story-word`.
 *
 * Это позитивный контроль правки долга 137, и он обязан работать в обе
 * стороны: на данных ДО записи сверка называет РОВНО одну строку
 * (`cmsxtq0gh0005qwncjblja933 2-0-32` «писать», рассказ «Ванька»), на
 * данных ПОСЛЕ — ни одной. Проверка, которая не умеет находить
 * расхождение, результатом не считается, поэтому есть подсадка
 * `--plant`: одной случайной строке приписывается чужой голос, и
 * расхождений обязано стать на одно больше.
 *
 * Входом берётся выгрузка `AudioAsset` (snapshot-audio.ts --out=…), а не
 * боевая база: сверка не платит за чтения сама.
 *
 *   npx tsx prisma/run-7176/voice-vs-cast.ts --audio=<audio.json> [--plant]
 */
import { readFileSync } from "node:fs";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const AUDIO = arg("audio")!;
const PLANT = process.argv.includes("--plant");

interface Row { id: string; contentType: string; contentId: string; itemKey: string; text: string; voice: string; model: string }

const rows = JSON.parse(readFileSync(AUDIO, "utf-8")) as Row[];
const cast = new Map<string, string>();
for (const r of rows) if (r.contentType === "story") cast.set(`${r.contentId}|${r.itemKey}`, r.voice);

const words = rows.filter((r) => r.contentType === "story-word");
if (PLANT) {
  // подсадка только в памяти: голос одной строки заменяется на заведомо чужой
  const victim = words.find((r) => cast.get(`${r.contentId}|${r.itemKey.split("-").slice(0, 2).join("-")}`) === "onyx")!;
  victim.voice = "shimmer";
  console.log(`ПОДСАДКА: строке ${victim.id} ${victim.contentId} ${victim.itemKey} приписан голос shimmer`);
}

const mismatched: string[] = [];
let checked = 0, noCast = 0;
for (const r of words) {
  const key = `${r.contentId}|${r.itemKey.split("-").slice(0, 2).join("-")}`;
  const c = cast.get(key);
  if (!c) { noCast++; continue; }
  checked++;
  if (r.voice !== c) mismatched.push(`${r.id} ${r.contentId} ${r.itemKey} «${r.text}» (${r.model}): колонка ${r.voice}, каст ${c}`);
}
console.log(`строк story-word: ${words.length}; у скольких нашлось предложение с кастом: ${checked} (без каста ${noCast})`);
console.log(`РАСХОЖДЕНИЙ «колонка voice ≠ голосу каста»: ${mismatched.length}`);
for (const m of mismatched) console.log(`  ${m}`);
process.exit(PLANT ? (mismatched.length > 0 ? 0 : 1) : 0);
