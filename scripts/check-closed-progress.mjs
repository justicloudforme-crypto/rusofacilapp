/**
 * check:closed-progress — ДОЛГ 206 (заход 7.292; решение владельца
 * 15.11.2026, вариант «б»).
 *
 * Карточка закрытого рассказа с прогрессом чтения обязана сказать, что
 * рассказ сейчас закрыт («Cerrado ahora…» / «Сейчас закрыт…»), — и только
 * закрытого: у открытого такой строки быть не должно. Поведение целиком
 * проверяет `StoriesCatalog.closed-progress.test.tsx` (8 случаев, es и ru);
 * этот сторож держит форму: подпись стоит под условием «есть прогресс И
 * закрыт», выбирает Premium по причине закрытия, строки есть в обоих
 * словарях и на своём языке.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const CARD = "src/components/stories/StoriesCatalog.tsx";
const DICTS = { es: "src/dictionaries/es.json", ru: "src/dictionaries/ru.json" };
const KEYS = ["closedProgressNote", "closedProgressNotePremium"];

function strip(src) {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function judge({ card, es, ru }) {
  const bad = [];
  const src = strip(card ?? "");
  const block = /\{progress && isLocked && \(\s*<span data-rf-closed-progress[^>]*>\s*\{story\.lockReason === "premium" \? dict\.closedProgressNotePremium : dict\.closedProgressNote\}/;
  if (!/data-rf-closed-progress/.test(src) || !/dict\.closedProgressNote\b/.test(src)) {
    bad.push(`${CARD}: у карточки с прогрессом нет подписи «закрыт» — закрытый рассказ снова молчит (долг 206)`);
  } else if (!block.test(src)) {
    bad.push(`${CARD}: подпись «закрыт» стоит не под условием «progress && isLocked» с выбором Premium по lockReason — покажется открытому или не тому (долг 206)`);
  }
  for (const [lang, raw] of Object.entries({ es, ru })) {
    let stories = null;
    try {
      stories = JSON.parse(raw ?? "").stories ?? null;
    } catch {
      stories = null;
    }
    if (!stories) {
      bad.push(`${DICTS[lang]}: словарь не прочитан — проверять нечего`);
      continue;
    }
    for (const key of KEYS) {
      const text = stories[key];
      if (typeof text !== "string" || text.trim() === "") bad.push(`${DICTS[lang]}: stories.${key} пуста — подпись выйдет пустой`);
      else if (lang === "es" && /[а-яё]/i.test(text)) bad.push(`${DICTS[lang]}: stories.${key} по-русски в испанском словаре`);
      else if (lang === "ru" && !/[а-яё]/i.test(text)) bad.push(`${DICTS[lang]}: stories.${key} не по-русски в русском словаре`);
    }
    if (stories.closedProgressNote && stories.closedProgressNote === stories.closedProgressNotePremium) {
      bad.push(`${DICTS[lang]}: подписи про подписку и про Premium одинаковые — человек не узнает, чего не хватает`);
    }
  }
  return bad;
}

function read() {
  return { card: readFileSync(CARD, "utf8"), es: readFileSync(DICTS.es, "utf8"), ru: readFileSync(DICTS.ru, "utf8") };
}

function main() {
  const live = read();
  if (process.argv.includes("--plant")) {
    let ok = judge(live).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие файлы`);
    const edit = (part, from, to) => {
      const next = live[part].replace(from, to);
      return next === live[part] ? null : { ...live, [part]: next };
    };
    const cases = [
      ["ПОЗИТИВНЫЙ КОНТРОЛЬ: карточка как на main a60af9d (подписи нет)", edit("card", /\s*\{progress && isLocked && \([\s\S]*?<\/span>\s*\)\}/, ""), "нет подписи «закрыт»"],
      ["подпись и у ОТКРЫТОГО (условие без isLocked)", edit("card", "{progress && isLocked && (", "{progress && ("), "не под условием"],
      ["Premium и подписка перепутаны", edit("card", 'story.lockReason === "premium" ? dict.closedProgressNotePremium : dict.closedProgressNote', 'story.lockReason === "free" ? dict.closedProgressNotePremium : dict.closedProgressNote'), "не под условием"],
      ["русская строка пуста", edit("ru", /"closedProgressNote": "[^"]*"/, '"closedProgressNote": ""'), "ru.json: stories.closedProgressNote пуста"],
      ["испанская строка по-русски", edit("es", /"closedProgressNotePremium": "[^"]*"/, '"closedProgressNotePremium": "Закрыт"'), "по-русски в испанском"],
      ["две подписи одинаковые", edit("es", /"closedProgressNotePremium": "[^"]*"/, `"closedProgressNotePremium": ${JSON.stringify(JSON.parse(live.es).stories.closedProgressNote)}`), "одинаковые"],
      ["пустой вход", { card: "", es: "", ru: "" }, "нет подписи"],
    ];
    let caught = 0;
    for (const [name, patched, expect] of cases) {
      if (!patched) {
        console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name}`);
        ok = false;
        continue;
      }
      const hit = judge(patched).some((m) => m.includes(expect));
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    ok &&= caught === cases.length;
    console.log(ok ? `check:closed-progress --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:closed-progress --plant — FAILED");
    return ok ? 0 : 1;
  }
  const bad = judge(live);
  if (bad.length) {
    console.error("check:closed-progress — ОТКАЗ:");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("check:closed-progress — закрытый рассказ с прогрессом подписан «закрыт» (подписка/Premium), открытый — нет; es и ru на своём языке (долг 206). Контроль — --plant.");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
