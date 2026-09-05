// Сверка двух карт сайта: что именно изменилось между «до» и «после».
//
//   node scripts/check-sitemap-delta.mjs --before=a.xml --after=b.xml
//   node scripts/check-sitemap-delta.mjs --before=a.xml --after=b.xml --plant
//
// Зачем отдельный скрипт, а не «глазами». Правка `<lastmod>` обязана
// быть доказуемо УЗКОЙ: число URL не изменилось, ни один не исчез и не
// появился, порядок совпал, изменилось ровно одно поле и ровно у
// стольких-то записей. Каждое из этих утверждений — отдельная колонка
// ниже, потому что «файл стал больше на 132 байта» их не заменяет.
//
// `--plant` — позитивный контроль самой сверки, и он обязателен, когда
// она отвечает «изменилось 0» по полутора тысячам URL. Проверка, которая
// не умеет показать, что видит пропажу и сдвиг даты, не является
// доказательством того, что их нет. Подсадка делается в КОПИЮ «после»,
// исходные файлы не трогаются.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

/** [{url, lastmod, changefreq, index}] в том порядке, в каком они в файле. */
export function parseSitemap(xml) {
  const out = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  blocks.forEach((block, index) => {
    const pick = (tag) => block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? null;
    out.push({ url: pick("loc"), lastmod: pick("lastmod"), changefreq: pick("changefreq"), index });
  });
  return out;
}

export function compare(beforeXml, afterXml) {
  const before = parseSitemap(beforeXml);
  const after = parseSitemap(afterXml);
  const beforeBy = new Map(before.map((e) => [e.url, e]));
  const afterBy = new Map(after.map((e) => [e.url, e]));

  const gone = before.filter((e) => !afterBy.has(e.url)).map((e) => e.url);
  const added = after.filter((e) => !beforeBy.has(e.url)).map((e) => e.url);

  // Порядок сверяется по ОБЩИМ URL: пропажа сама по себе сдвигает
  // индексы, и без этого фильтра одна недостача выглядела бы как
  // перестановка всего хвоста.
  const commonBefore = before.filter((e) => afterBy.has(e.url)).map((e) => e.url);
  const commonAfter = after.filter((e) => beforeBy.has(e.url)).map((e) => e.url);
  const orderKept = commonBefore.length === commonAfter.length
    && commonBefore.every((url, i) => url === commonAfter[i]);

  const changed = [];
  for (const entry of after) {
    const was = beforeBy.get(entry.url);
    if (!was) continue;
    const fields = ["lastmod", "changefreq"].filter((f) => (was[f] ?? null) !== (entry[f] ?? null));
    if (fields.length) changed.push({ url: entry.url, fields, from: was.lastmod, to: entry.lastmod });
  }

  return {
    countBefore: before.length,
    countAfter: after.length,
    gone,
    added,
    orderKept,
    changed,
    fieldsTouched: [...new Set(changed.flatMap((c) => c.fields))].sort(),
    withLastmodBefore: before.filter((e) => e.lastmod).length,
    withLastmodAfter: after.filter((e) => e.lastmod).length,
  };
}

/** Подсадка в копию «после»: одна запись вынута, у другой сдвинута дата. */
export function plant(afterXml) {
  const blocks = afterXml.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  if (blocks.length < 2) throw new Error("нечего подсаживать");
  const removed = blocks[Math.floor(blocks.length / 2)];
  const removedUrl = removed.match(/<loc>([\s\S]*?)<\/loc>/)[1];
  let planted = afterXml.replace(removed, "");
  const victim = blocks[0];
  const victimUrl = victim.match(/<loc>([\s\S]*?)<\/loc>/)[1];
  const shifted = victim.includes("<lastmod>")
    ? victim.replace(/<lastmod>[\s\S]*?<\/lastmod>/, "<lastmod>2001-01-01T00:00:00.000Z</lastmod>")
    : victim.replace("</url>", "<lastmod>2001-01-01T00:00:00.000Z</lastmod></url>");
  planted = planted.replace(victim, shifted);
  return { planted, removedUrl, victimUrl };
}

function report(result) {
  console.log(`    URL «до» / «после»    : ${result.countBefore} / ${result.countAfter}`);
  console.log(`    исчезло               : ${result.gone.length}${result.gone.length ? " — " + result.gone.slice(0, 3).join(", ") : ""}`);
  console.log(`    добавилось            : ${result.added.length}${result.added.length ? " — " + result.added.slice(0, 3).join(", ") : ""}`);
  console.log(`    порядок общих URL     : ${result.orderKept ? "совпал" : "РАЗОШЁЛСЯ"}`);
  console.log(`    изменившихся записей  : ${result.changed.length}`);
  console.log(`    изменившиеся поля     : ${result.fieldsTouched.length ? result.fieldsTouched.join(", ") : "нет"}`);
  console.log(`    с <lastmod> до/после  : ${result.withLastmodBefore} / ${result.withLastmodAfter}`);
}

async function main() {
  const beforePath = arg("before", "");
  const afterPath = arg("after", "");
  if (!beforePath || !afterPath) {
    console.log("нужны --before=<file.xml> и --after=<file.xml>");
    process.exit(2);
  }
  const beforeXml = readFileSync(beforePath, "utf8");
  const afterXml = readFileSync(afterPath, "utf8");

  console.log(`--- сверка: ${beforePath} против ${afterPath} ---`);
  const result = compare(beforeXml, afterXml);
  report(result);

  if (arg("byType", "") === "yes" || argv.includes("--by-type")) {
    const bucket = (url) => {
      const seg = new URL(url).pathname.split("/").filter(Boolean);
      if (seg.length < 2) return "корень локали";
      const r = seg[1];
      if (r === "stories") return seg.length > 2 ? "рассказ" : "каталог";
      if (r === "media") return seg.length > 2 ? "медиа" : "каталог";
      if (r === "glossary") return seg.length > 2 ? "словарь" : "каталог";
      if (r === "courses") return seg.length > 3 ? "урок" : "уровень";
      if (r === "word-games") return "пазл";
      if (r === "vocabulary") return seg.length > 2 ? "категория" : "статика";
      return "статика/лендинг";
    };
    const byType = new Map();
    for (const c of result.changed) byType.set(bucket(c.url), (byType.get(bucket(c.url)) ?? 0) + 1);
    console.log("    по типам:");
    for (const [k, v] of [...byType].sort((a, b) => b[1] - a[1])) console.log(`      ${k.padEnd(18)}${v}`);
  }

  if (!argv.includes("--plant")) {
    console.log("\nбез --plant это не результат: сверка не показала, что умеет находить проблему");
    return;
  }

  console.log("\n--- контроль: подсаженные изменения обязаны найтись ---");
  const { planted, removedUrl, victimUrl } = plant(afterXml);
  const control = compare(beforeXml, planted);
  const caughtGone = control.gone.includes(removedUrl);
  const caughtShift = control.changed.some((c) => c.url === victimUrl && c.fields.includes("lastmod"));
  console.log(`    вынутый URL найден    : ${caughtGone ? "да" : "НЕТ"} — ${removedUrl}`);
  console.log(`    сдвинутая дата найдена: ${caughtShift ? "да" : "НЕТ"} — ${victimUrl}`);
  console.log(`    порядок после пропажи : ${control.orderKept ? "всё равно совпал" : "разошёлся"}`);
  if (!caughtGone || !caughtShift) {
    console.log("\nFAIL — сверка слепа, её ответам верить нельзя");
    process.exit(1);
  }
  console.log("\nPASS — сверка видит и пропажу, и сдвиг даты");
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) await main();
