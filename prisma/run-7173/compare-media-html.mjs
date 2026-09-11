/**
 * Индекс — чистое добавление: HTML страниц обязан не измениться
 * (заход 7.173, долг 135).
 *
 * Сравниваются два съёма 20 НЕзамороженных медиа-страниц живого прода —
 * до создания индекса и после. Побайтово, кроме полей, которые меняются
 * от запроса к запросу по устройству Sentry и названы здесь ПОИМЁННО:
 *
 *   * `<meta name="sentry-trace" content="…">` — идентификатор трассы
 *     запроса, новый у каждого запроса;
 *   * `<meta name="baggage" content="…">` — служебный набор того же
 *     Sentry. Первая попытка нормализовала в нём только `sentry-trace_id`
 *     и `sentry-sample_rand` и оставила 4 расхождения из 20: у части
 *     запросов в наборе появляется ещё и ключ `sentry-transaction=…`, а у
 *     части его нет вовсе — решение о выборке принимается на каждый
 *     запрос. Поэтому нормализуется всё содержимое тега; от страницы в
 *     нём нет ничего, кроме имени её же маршрута.
 *
 * Больше НИЧЕГО не нормализуется — ровно два тега в `<head>`. Любое иное
 * расхождение — находка, а не шум: именно это отличает «HTML тот же» от
 * «HTML похож».
 *
 * Подсадка `--plant`: в одну копию «после» подменяется текст `<title>` —
 * сверка обязана её поймать. Без этого «0 расхождений» означало бы «0
 * совпадений регулярки» (правило 4.1).
 *
 * ПЕРВАЯ подсадка была ПУСТОЙ, и это findings, а не мелочь. Она меняла
 * адрес mp3 у кнопки «слушать» — и не поймала ничего, потому что АНОНИМУ
 * «Ключевая лексика» не отдаётся вовсе: адресов `.mp3` в HTML этих 20
 * страниц РОВНО НОЛЬ (проверено грепом). Отсюда прямое следствие для
 * чтения результата: равенство HTML говорит, что индекс не сдвинул
 * разметку, и НЕ говорит ничего о наборе клипов — набор клипов сверен
 * отдельно, строка в строку, по 775 выборкам
 * (`prisma/run-7173/prove-index-equal.ts`). Запрос при этом страница
 * выполняет и платит за него независимо от того, дошёл ли ответ до HTML.
 *
 *   node prisma/run-7173/compare-media-html.mjs --before=<кат> --after=<кат>
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const BEFORE = arg("before");
const AFTER = arg("after");
const PLANT = process.argv.includes("--plant");

const VARYING = [
  { what: 'meta name="sentry-trace"', re: /(<meta name="sentry-trace" content=")[^"]*(")/g, to: "$1<ТРАССА>$2" },
  { what: 'meta name="baggage"', re: /(<meta name="baggage" content=")[^"]*(")/g, to: "$1<НАБОР SENTRY>$2" },
];

function normalize(html) {
  let out = html;
  const hits = {};
  for (const f of VARYING) {
    const before = out;
    out = out.replace(f.re, f.to);
    hits[f.what] = (before.match(f.re) ?? []).length;
  }
  return { out, hits };
}

function main() {
  if (!BEFORE || !AFTER) throw new Error("нужны --before=<каталог> и --after=<каталог>");
  const files = readdirSync(BEFORE).filter((f) => f.endsWith(".html")).sort();
  if (files.length === 0) throw new Error("ОТКАЗ: в каталоге «до» нет ни одного файла — сравнивать нечего");

  let identical = 0;
  const differing = [];
  const hitTotals = {};
  for (const f of files) {
    const a = normalize(readFileSync(path.join(BEFORE, f), "utf8"));
    let afterRaw = readFileSync(path.join(AFTER, f), "utf8");
    if (PLANT && f === files[0]) {
      afterRaw = afterRaw.replace(/<title>([^<]*)<\/title>/, "<title>$1 ПОДСАЖЕНО</title>");
      if (!/ПОДСАЖЕНО/.test(afterRaw)) throw new Error("ОТКАЗ: подсадка ничего не подменила — контроль был бы пустым");
    }
    const b = normalize(afterRaw);
    for (const [k, v] of Object.entries(a.hits)) hitTotals[k] = (hitTotals[k] ?? 0) + v;
    if (a.out === b.out) identical++;
    else {
      let i = 0;
      while (i < a.out.length && i < b.out.length && a.out[i] === b.out[i]) i++;
      differing.push({ file: f, at: i, before: a.out.slice(i - 60, i + 60), after: b.out.slice(i - 60, i + 60) });
    }
  }

  console.log("нормализованные поля (совпадений в файлах «до», всего):");
  for (const [k, v] of Object.entries(hitTotals)) console.log(`  ${k}: ${v}`);
  for (const d of differing) {
    console.log(`  РАСХОЖДЕНИЕ ${d.file} на байте ${d.at}\n    до:    …${d.before}…\n    после: …${d.after}…`);
  }
  console.log(`страниц ${files.length}, равны после нормализации ${identical}, расходятся ${differing.length}`);
  if (Object.values(hitTotals).some((v) => v === 0)) {
    console.error("ОТКАЗ: какое-то из нормализуемых полей не встретилось ни разу — нормализация сравнивает не то, что думает");
    return 1;
  }
  return differing.length === 0 ? 0 : 1;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  try {
    process.exitCode = main();
  } catch (e) {
    console.error(String(e));
    process.exitCode = 1;
  }
}
