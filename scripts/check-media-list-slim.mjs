// СПИСОК МЕДИА НЕ ТАЩИТ СУБТИТРЫ (заход 7.262, Sentry JAVASCRIPT-NEXTJS-15 «Slow DB Query»).
//
// `getAllMedia()` зовут урок, рассказ, каталог медиа и карта сайта. До
// 7.262 он делал `db.mediaOverride.findMany()` без `select`: 233 строки, но
// 2,27 МБ субтитров (ответ базы 2,9 МБ вместо 57 КБ) и разбор 232 JSON на
// каждом рендере — ради поля, которое ни одна из этих страниц не печатает.
//
// Правила:
//   list-select       — `getAllMedia` читает накладку с `select`, и в выборке
//                       нет `subtitles`;
//   full-admin-only   — `getAllMediaWithSubtitles` зовут только админка и
//                       пакетная генерация субтитров;
//   no-bare-findmany  — голый `db.mediaOverride.findMany()` есть ровно один —
//                       в `readOverrides` (админские пути).
//
//   node scripts/check-media-list-slim.mjs          # гейт
//   node scripts/check-media-list-slim.mjs --plant  # позитивный контроль
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const DATA = "src/lib/media/data.ts";
const LESSON = "src/app/[lang]/courses/[level]/[lesson]/page.tsx";
const ADMIN_ALLOWED = [/^src\/app\/\[lang\]\/admin\//, /^src\/app\/api\/admin\//, /^src\/lib\/media\/generateAllSubtitles\.ts$/, /^src\/lib\/media\/data\.ts$/];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "generated" || name === "node_modules") continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function audit({ files }) {
  const failed = [];
  const data = files.get(DATA) ?? "";
  const fn = data.match(/export async function getAllMedia\(\)[\s\S]*?\n\}\n/)?.[0] ?? "";
  const cols = data.match(/const LIST_OVERRIDE_COLUMNS = \{([\s\S]*?)\}/)?.[1] ?? null;
  if (!/db\.mediaOverride\.findMany\(\{\s*select:\s*LIST_OVERRIDE_COLUMNS\s*\}\)/.test(fn) || cols === null || /subtitles/.test(cols))
    failed.push({ id: "list-select", hits: [DATA] });

  const callers = [...files].filter(([f, s]) => /getAllMediaWithSubtitles/.test(s) && !ADMIN_ALLOWED.some((re) => re.test(f))).map(([f]) => f);
  if (callers.length) failed.push({ id: "full-admin-only", hits: callers });

  const bare = [...files].flatMap(([f, s]) => (s.match(/db\.mediaOverride\.findMany\(\)/g) ?? []).map(() => f));
  if (bare.length !== 1 || bare[0] !== DATA || !/async function readOverrides[\s\S]{0,200}db\.mediaOverride\.findMany\(\)/.test(data))
    failed.push({ id: "no-bare-findmany", hits: bare.length ? bare : ["(нет readOverrides)"] });
  return failed;
}

const swap = (f, file, fn) => ({ files: new Map([...f.files].map(([k, v]) => [k, k === file ? fn(v) : v])) });

const PLANTS = [
  {
    id: "list-select",
    title: "getAllMedia вернулся к `findMany()` без select (старый вид — NEXTJS-15)",
    break: (f) => swap(f, DATA, (s) => s.replace("db.mediaOverride.findMany({ select: LIST_OVERRIDE_COLUMNS })", "db.mediaOverride.findMany()")),
  },
  {
    id: "list-select",
    title: "в выборку списка вернули subtitles",
    break: (f) => swap(f, DATA, (s) => s.replace("  mediaId: true,\n  embedStatus: true,", "  mediaId: true,\n  subtitles: true,\n  embedStatus: true,")),
  },
  {
    id: "full-admin-only",
    title: "урок стал звать полную накладку",
    break: (f) => swap(f, LESSON, (s) => s.replace("getAllMedia()", "getAllMediaWithSubtitles()")),
  },
];

if (IS_ENTRY_POINT) {
  const files = { files: new Map(walk("src").map((p) => [p, readFileSync(p, "utf-8")])) };
  if (process.argv.includes("--plant")) {
    console.log("check:media-list-slim --plant");
    let ok = 0;
    const clean = audit(files);
    if (clean.length === 0) ok++;
    console.log(`  ${clean.length === 0 ? "СОШЛОСЬ " : "НЕ СОШЛОСЬ"} отрицательный контроль: нынешний код проходит`);
    for (const plant of PLANTS) {
      const failed = audit(plant.break(files)).map((x) => x.id);
      const caught = failed.includes(plant.id);
      if (caught) ok++;
      console.log(`  ${caught ? "ПОЙМАНО  " : "ПРОПУЩЕНО"} ${plant.title} → ${failed.join(", ") || "тишина"}`);
    }
    console.log(`  итог: ${ok} из ${PLANTS.length + 1}`);
    process.exit(ok === PLANTS.length + 1 ? 0 : 1);
  }
  const failed = audit(files);
  if (failed.length) {
    for (const f of failed) console.error(`✗ ${f.id}\n    ${f.hits.join("\n    ")}`);
    process.exit(1);
  }
  console.log("check:media-list-slim: список медиа без subtitles, полная накладка — только админка, голый findMany — один (readOverrides)");
}
