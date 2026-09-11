/**
 * Индекс — ЧИСТОЕ ДОБАВЛЕНИЕ: ответы запросов обязаны не измениться
 * (заход 7.173, долг 135).
 *
 * Два снимка одной и той же боевой базы — один без индекса, другой с
 * `AudioAsset_text_idx`, — и по ним прогоняется ТОТ ЖЕ SQL, который
 * отправляет Prisma (снят `prisma/run-7173/capture-sql.ts`, не
 * переписан от руки):
 *
 *   * `clipsByText` для ВСЕХ 275 медиа-записей, то есть для всех 550
 *     медиа-страниц обеих локалей (список слов у локалей один);
 *   * запрос `/api/word-audio` для выборки слов.
 *
 * Сверка — строка в строку И в том же порядке: сравниваются JSON
 * сериализации наборов без сортировки. Порядок здесь не придирка: клип
 * выбирается первым подходящим (`pickReusableClips`), и смена порядка
 * сменила бы ОТДАННЫЙ файл, не меняя содержимого выборки.
 *
 * В боевую базу не ходит ни одним запросом: оба адреса — `file:`.
 * Подсадки: `--plant=<n>` подменяет `audioUrl` в n-м наборе (содержимое),
 * `--plant-order=<n>` переставляет в нём две первые строки местами
 * (порядок). Сверка обязана поймать и то и другое.
 */
import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const BEFORE = arg("before");
const AFTER = arg("after");
const PLANT = arg("plant") ? Number(arg("plant")) : null;
const PLANT_ORDER = arg("plant-order") ? Number(arg("plant-order")) : null;
if (!BEFORE || !AFTER) throw new Error("нужны --before=file:… и --after=file:…");

const CLIPS_BY_TEXT = (n: number) =>
  "SELECT `main`.`AudioAsset`.`id`, `main`.`AudioAsset`.`contentType`, `main`.`AudioAsset`.`contentId`, " +
  "`main`.`AudioAsset`.`itemKey`, `main`.`AudioAsset`.`text`, `main`.`AudioAsset`.`audioUrl` " +
  "FROM `main`.`AudioAsset` WHERE (`main`.`AudioAsset`.`text` IN (" +
  Array.from({ length: n }, () => "?").join(",") +
  ") AND (NOT `main`.`AudioAsset`.`contentType` = ?)) ORDER BY `main`.`AudioAsset`.`contentType` ASC, " +
  "`main`.`AudioAsset`.`contentId` ASC, `main`.`AudioAsset`.`itemKey` ASC LIMIT -1 OFFSET 0";

const WORD_AUDIO =
  "SELECT `main`.`AudioAsset`.`id`, `main`.`AudioAsset`.`contentType`, `main`.`AudioAsset`.`contentId`, " +
  "`main`.`AudioAsset`.`itemKey`, `main`.`AudioAsset`.`text`, `main`.`AudioAsset`.`audioUrl` " +
  "FROM `main`.`AudioAsset` WHERE (`main`.`AudioAsset`.`voice` = ? AND (NOT `main`.`AudioAsset`.`contentType` = ?) " +
  "AND (`main`.`AudioAsset`.`text` = ? OR `main`.`AudioAsset`.`text` = ?)) ORDER BY `main`.`AudioAsset`.`contentType` ASC, " +
  "`main`.`AudioAsset`.`contentId` ASC, `main`.`AudioAsset`.`itemKey` ASC LIMIT -1 OFFSET 0";

type Case = { label: string; sql: string; args: string[] };

function mediaCases(): Case[] {
  const data = JSON.parse(readFileSync("src/lib/media/mediaData.json", "utf8")) as Record<
    string,
    { vocabulary?: Array<{ word: string }> }
  >;
  const out: Case[] = [];
  for (const [id, item] of Object.entries(data)) {
    // Ровно то, что делает clipsByText: дедуп, пустые выброшены.
    const wanted = [...new Set((item.vocabulary ?? []).map((v) => v.word).filter((w) => typeof w === "string" && w.length > 0))];
    if (wanted.length === 0) continue;
    out.push({ label: `media:${id}`, sql: CLIPS_BY_TEXT(wanted.length), args: [...wanted, "story"] });
  }
  return out;
}

async function wordCases(db: Client): Promise<Case[]> {
  // Выборка слов: 300 из банка слов (клип есть) и 200 из остального
  // банка (клип «того же текста» может найтись или нет). Детерминирована:
  // порядок по id, без случайности.
  const bank = await db.execute(
    "select distinct text from AudioAsset where contentType = 'word' order by text limit 300"
  );
  const other = await db.execute(
    "select distinct text from AudioAsset where contentType not in ('word','story') and length(text) <= 20 order by text limit 200"
  );
  const words = [...bank.rows, ...other.rows].map((r) => String(r.text));
  return words.map((w) => ({
    label: `word:${w}`,
    sql: WORD_AUDIO,
    args: ["onyx", "story", w, w.toLowerCase()],
  }));
}

async function run(db: Client, cases: Case[]): Promise<string[]> {
  const out: string[] = [];
  for (const c of cases) {
    const r = await db.execute({ sql: c.sql, args: c.args });
    out.push(JSON.stringify(r.rows.map((row) => r.columns.map((col) => row[col] ?? null))));
  }
  return out;
}

async function main() {
  const before = createClient({ url: BEFORE! });
  const after = createClient({ url: AFTER! });
  for (const url of [BEFORE!, AFTER!]) {
    if (!url.startsWith("file:")) throw new Error(`ОТКАЗ: ${url} не локальный снимок — сверка в боевую базу не ходит`);
  }

  const media = mediaCases();
  const words = await wordCases(before);
  console.log(`наборов: медиа ${media.length} (это ${media.length * 2} медиа-страниц двух локалей), слов ${words.length}`);

  const all = [...media, ...words];
  const a = await run(before, all);
  const b = await run(after, all);

  if (PLANT !== null) {
    const i = Math.min(PLANT, b.length - 1);
    const parsed = JSON.parse(b[i]) as unknown[][];
    if (parsed.length === 0) throw new Error(`подсадка невозможна: набор ${i} пуст, выберите другой --plant`);
    parsed[0][parsed[0].length - 1] = "https://подсажено.invalid/x.mp3";
    b[i] = JSON.stringify(parsed);
    console.log(`ПОДСАДКА: в наборе ${i} (${all[i].label}) подменён audioUrl первой строки`);
  }

  if (PLANT_ORDER !== null) {
    const i = Math.min(PLANT_ORDER, b.length - 1);
    const parsed = JSON.parse(b[i]) as unknown[][];
    if (parsed.length < 2) throw new Error(`подсадка порядка невозможна: в наборе ${i} меньше двух строк`);
    [parsed[0], parsed[1]] = [parsed[1], parsed[0]];
    b[i] = JSON.stringify(parsed);
    console.log(`ПОДСАДКА ПОРЯДКА: в наборе ${i} (${all[i].label}) две первые строки переставлены`);
  }

  let differ = 0;
  let rowsTotal = 0;
  let nonEmpty = 0;
  for (let i = 0; i < all.length; i++) {
    const n = (JSON.parse(a[i]) as unknown[]).length;
    rowsTotal += n;
    if (n > 0) nonEmpty++;
    if (a[i] !== b[i]) {
      differ++;
      if (differ <= 5) console.log(`  РАСХОЖДЕНИЕ ${all[i].label}\n    до:    ${a[i].slice(0, 200)}\n    после: ${b[i].slice(0, 200)}`);
    }
  }
  console.log(
    `сверено наборов ${all.length}, непустых ${nonEmpty}, строк в ответах всего ${rowsTotal}, расхождений ${differ}`
  );
  if (rowsTotal === 0) {
    console.error("ОТКАЗ: все ответы пусты — сверять нечего, сравнение пустого с пустым результатом не является");
    process.exitCode = 1;
    return;
  }
  process.exitCode = differ === 0 ? 0 : 1;
}

main();
