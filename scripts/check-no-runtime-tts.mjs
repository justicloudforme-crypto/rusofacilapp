/**
 * «Голоса, синтезированного в браузере, в продукте нет» — сторож захода 7.168.
 *
 * ЗАЧЕМ. Правило владельца одно и не меняется с 7.160: **звучит только
 * оплаченная записанная озвучка; голоса, сгенерированного на лету, не
 * должно быть нигде.** Браузерный `speechSynthesis` этому правилу
 * противоречит по устройству: он читает системным голосом ОС (на
 * macOS/iOS это Milena, на Android — «Google русский», на Windows —
 * «Ирина»), и именно его годами принимали за брак нашей озвучки —
 * долг 114, найденный только в 7.160.
 *
 * До этого захода правило держалось уговором и комментариями. Уговор уже
 * один раз не сработал: `no-runtime-tts.test.ts` существовал ещё в 7.163
 * и НЕ ВИДЕЛ этого класса вовсе — все четыре его правила были про платный
 * вызов OpenAI, и на 36 строках браузерного синтеза давали 0 совпадений.
 *
 * ПРАВИЛО. Ни `speechSynthesis`, ни `SpeechSynthesisUtterance` не
 * встречаются:
 *
 *   1) в исходниках продукта (`src/`, кроме тестов) — и слова эти ищутся
 *      в КОДЕ, а не в тексте: комментарии и строковые литералы снимаются
 *      перед поиском, иначе сторож ругался бы на собственные объяснения;
 *   2) в СОБРАННЫХ клиентских бандлах (`.next/static`) — половина,
 *      которую нельзя обойти ни комментарием, ни чужой зависимостью,
 *      притащившей вызов с собой. Комментарии до бандла не доживают,
 *      поэтому здесь ищется голый текст.
 *
 * Тесты — НЕ исключение по недосмотру, а по смыслу: `StoryText.test.tsx`
 * и `SlidesTab.test.tsx` НАРОЧНО подставляют движок синтеза в jsdom и
 * требуют, чтобы продукт его не позвал. Это детекторы правила, а не его
 * нарушители; запрет на них ослепил бы саму проверку.
 *
 *   node scripts/check-no-runtime-tts.mjs                    # исходники
 *   node scripts/check-no-runtime-tts.mjs --bundles          # + собранные бандлы, если они есть
 *   node scripts/check-no-runtime-tts.mjs --require-bundles  # бандлы обязаны быть собраны
 *   node scripts/check-no-runtime-tts.mjs --plant            # позитивный и отрицательный контроль
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ARGS = process.argv.slice(2);
const PLANT = ARGS.includes("--plant");
const REQUIRE_BUNDLES = ARGS.includes("--require-bundles");
const WITH_BUNDLES = REQUIRE_BUNDLES || ARGS.includes("--bundles");
const ROOT = process.cwd();

const BANNED = ["speechSynthesis", "SpeechSynthesisUtterance"];

/** Тесты — детекторы этого самого правила, см. шапку. */
const isTest = (path) => /\.(test|spec)\.[tj]sx?$/.test(path) || path.includes("/__tests__/");

function walk(dir, out = [], pick = () => true) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out, pick);
    else if (pick(full)) out.push(full);
  }
  return out;
}

/**
 * Снимает комментарии и строковые/шаблонные литералы, оставляя длину
 * файла прежней (пробелами), — так номер строки у находки остаётся
 * настоящим. Простой конечный автомат: регулярные выражения на этом
 * классе задач врут (правило 4.4 PROGRESS.md — «регулярка из данных»).
 */
export function stripCommentsAndStrings(source) {
  const out = source.split("");
  const blank = (from, to) => {
    for (let i = from; i < to && i < out.length; i++) if (out[i] !== "\n") out[i] = " ";
  };
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      let j = i;
      while (j < n && source[j] !== "\n") j++;
      blank(i, j);
      i = j;
    } else if (c === "/" && next === "*") {
      let j = source.indexOf("*/", i + 2);
      j = j === -1 ? n : j + 2;
      blank(i, j);
      i = j;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\\") { j += 2; continue; }
        if (source[j] === c) { j++; break; }
        j++;
      }
      blank(i + 1, j - 1);
      i = j;
    } else {
      i++;
    }
  }
  return out.join("");
}

function hitsIn(text, path) {
  const hits = [];
  const lines = text.split("\n");
  lines.forEach((line, idx) => {
    for (const word of BANNED) {
      if (line.includes(word)) hits.push({ path, line: idx + 1, word, text: line.trim().slice(0, 120) });
    }
  });
  return hits;
}

function scanSources() {
  const files = walk(join(ROOT, "src"), [], (f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f) && !isTest(f));
  const hits = [];
  for (const f of files) {
    const raw = readFileSync(f, "utf8");
    if (!BANNED.some((w) => raw.includes(w))) continue;
    hits.push(...hitsIn(stripCommentsAndStrings(raw), relative(ROOT, f)));
  }
  return { files: files.length, hits };
}

function scanBundles() {
  const dir = join(ROOT, ".next", "static");
  const files = walk(dir, [], (f) => f.endsWith(".js"));
  const hits = [];
  for (const f of files) {
    const raw = readFileSync(f, "utf8");
    for (const word of BANNED) {
      if (raw.includes(word)) hits.push({ path: relative(ROOT, f), line: 0, word, text: "(в собранном бандле)" });
    }
  }
  return { files: files.length, hits };
}

function plant() {
  const cases = [];
  const clean = `
    // window.speechSynthesis жил здесь до 7.168 — это объяснение, а не вызов
    const label = "SpeechSynthesisUtterance";
    /* блок про speechSynthesis */
    function speak(audioUrl) { new Audio(audioUrl).play(); }
  `;
  cases.push({
    name: "отрицательный контроль: комментарий и строка НЕ считаются вызовом",
    ok: hitsIn(stripCommentsAndStrings(clean), "x.ts").length === 0,
  });
  const planted = `function speak(t) { window.speechSynthesis.speak(new SpeechSynthesisUtterance(t)); }`;
  cases.push({
    name: "подсадка: прямой вызов синтеза найден",
    ok: hitsIn(stripCommentsAndStrings(planted), "x.ts").length === 2,
  });
  cases.push({
    name: "подсадка: вызов в конце строки с комментарием найден",
    ok: hitsIn(stripCommentsAndStrings(`const u = new SpeechSynthesisUtterance(t); // прежний путь`), "x.ts").length === 1,
  });
  cases.push({
    name: "подсадка: обращение через квадратные скобки найдено",
    ok: hitsIn(stripCommentsAndStrings(`const s = window["speechSynthesis"];`), "x.ts").length === 0,
  });
  // ↑ отдельный случай: строковый ключ снимается вместе со строками, и это
  //   честная слепота — её закрывает половина «собранные бандлы», где
  //   строка доживает до файла и находится голым текстом.
  cases.push({
    name: "бандл: обращение через строковый ключ находится в собранном виде",
    ok: hitsIn(`const s=window["speechSynthesis"];`, "chunk.js").length === 1,
  });
  cases.push({
    name: "отрицательный контроль: чистый файл даёт 0",
    ok: hitsIn(stripCommentsAndStrings(`const a = new Audio(url); a.play();`), "x.ts").length === 0,
  });
  cases.push({
    name: "тест-детектор не считается нарушителем",
    ok: isTest("src/components/stories/StoryText.test.tsx") && !isTest("src/components/stories/StoryText.tsx"),
  });
  cases.push({
    name: "подсадка: живой продуктовый файл с вызовом был бы пойман",
    ok:
      hitsIn(
        stripCommentsAndStrings(readFileSync(join(ROOT, "src/components/lesson/SpeakButton.tsx"), "utf8") +
          "\nfunction planted(t){window.speechSynthesis.speak(new SpeechSynthesisUtterance(t));}\n"),
        "SpeakButton.tsx",
      ).length === 2,
  });
  let caught = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) caught++;
  }
  console.log(`[check:no-runtime-tts --plant] пройдено ${caught} из ${cases.length}`);
  return caught === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const src = scanSources();
  if (src.files === 0) {
    console.error("проверять нечего: в src/ не нашлось ни одного файла — пустое множество результатом не считается");
    return 1;
  }
  console.log(`[check:no-runtime-tts] исходников продукта просмотрено: ${src.files}, находок: ${src.hits.length}`);
  let hits = [...src.hits];
  if (WITH_BUNDLES) {
    const bundles = scanBundles();
    if (bundles.files === 0) {
      if (REQUIRE_BUNDLES) {
        console.error("бандлы не собраны (.next/static пуст): проверить нечего, а молчать об этом нельзя");
        return 1;
      }
      console.log("бандлы не собраны — половина проверки пропущена (запускать после npm run build)");
    } else {
      console.log(`клиентских бандлов просмотрено: ${bundles.files}, находок: ${bundles.hits.length}`);
      hits.push(...bundles.hits);
    }
  }
  if (hits.length) {
    console.error("\nБРАУЗЕРНЫЙ СИНТЕЗ ВЕРНУЛСЯ В ПРОДУКТ:");
    for (const h of hits) console.error(`  ${h.path}:${h.line} ${h.word} — ${h.text}`);
    return 1;
  }
  console.log("вызовов браузерного синтеза 0 (контроль — --plant).");
  return 0;
}

// Только когда этот файл — точка входа процесса: импорт его запускать не
// должен (см. src/lib/entry-point.ts и инцидент 29.08.2026).
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
