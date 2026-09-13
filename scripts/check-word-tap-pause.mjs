/**
 * «Тап по слову во время чтения не оставляет два голоса» — сторож долга
 * 158 (заход 7.187).
 *
 * ЧТО ПЕРЕМЕРЕНО 13.09.2026. Жалоба владельца была «нажатие на слово не
 * останавливает чтение, два голоса звучат вместе». На видеозаписи
 * наложения нет ни разу — и это не опровержение, а уточнение: тап по
 * слову сам по себе звука НЕ запускает (клип слова звучит только по
 * нажатию 🔊 в карточке). Зато тап делал другое, чего не знал никто:
 * обработчик предложения звал `handleSentenceClick` ДАЖЕ при попадании в
 * слово, то есть перематывал чтение на начало этого предложения и
 * продолжал читать. Наложение получалось на втором действии.
 *
 * ПОВЕДЕНИЕ заперто рядом, в `StoryText.word-tap-pause.test.tsx`: там
 * считается число ОДНОВРЕМЕННО играющих дорожек (до правки 2, после 1) и
 * отдельным тестом показано, что счётчик умеет увидеть наложение.
 *
 * ЗДЕСЬ заперта СТРУКТУРА — те четыре места, порознь каждое из которых
 * возвращает болезнь целиком:
 *
 *   1) попадание в слово не доходит до `handleSentenceClick` (иначе
 *      перемотка на начало предложения возвращается);
 *   2) пауза берётся у `handlePlayPause`, а не собственным `pause()`
 *      (иначе состояние кнопки разойдётся с настоящим звуком);
 *   3) `close()` возвращает рассказ (иначе он замолкает навсегда там,
 *      где клип слова не зазвучал);
 *   4) кнопка слова в карточке получает `onPlay` и `onStop` (иначе
 *      рассказ не узнает, что слово началось и кончилось).
 *
 *   node scripts/check-word-tap-pause.mjs          # гейт
 *   node scripts/check-word-tap-pause.mjs --plant  # позитивный и отрицательный контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const TARGET = "src/components/stories/StoryText.tsx";

/** Тело блока, начиная с позиции открывающей скобки `open`. */
function blockFrom(code, index, open, close) {
  let depth = 0;
  for (let i = index; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close) {
      depth--;
      if (depth === 0) return code.slice(index, i + 1);
    }
  }
  return "";
}

/** Тело именованной функции `function name(` в исходнике. */
function functionBody(code, name) {
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(code);
  if (!m) return null;
  const brace = code.indexOf("{", m.index);
  if (brace === -1) return null;
  return blockFrom(code, brace, "{", "}");
}

/** Ветка `if (wordEl?.dataset.word) { … }` делегирующего обработчика. */
function wordBranch(code) {
  const m = /if\s*\(\s*wordEl\?\.dataset\.word\s*\)\s*\{/.exec(code);
  if (!m) return null;
  return blockFrom(code, code.indexOf("{", m.index), "{", "}");
}

/** Разметка `<SpeakButton … />`, которой карточка перевода озвучивает слово. */
function popoverSpeakButton(code) {
  const at = code.indexOf("<SpeakButton");
  if (at === -1) return null;
  const end = code.indexOf("/>", at);
  return end === -1 ? null : code.slice(at, end);
}

export function violationsIn(code) {
  const bad = [];

  const branch = wordBranch(code);
  if (branch === null) {
    bad.push("в обработчике предложения нет ветки `if (wordEl?.dataset.word)` — сторож ослеп, а не доволен");
  } else if (!/\breturn\b/.test(branch)) {
    bad.push("тап по СЛОВУ проваливается в handleSentenceClick: рассказ перематывается на начало предложения (долг 158)");
  }

  const pause = functionBody(code, "pauseForWord");
  if (pause === null) bad.push("функции pauseForWord нет вовсе");
  else if (!/handlePlayPause\s*\(/.test(pause)) {
    bad.push("pauseForWord останавливает звук мимо handlePlayPause — состояние кнопки разойдётся с настоящим звуком");
  }

  const resume = functionBody(code, "resumeAfterWord");
  if (resume === null) bad.push("функции resumeAfterWord нет вовсе");
  else if (!/handlePlayPause\s*\(/.test(resume)) bad.push("resumeAfterWord не возвращает воспроизведение через handlePlayPause");

  const close = functionBody(code, "close");
  if (close === null) bad.push("функции close нет вовсе");
  else if (!/resumeAfterWord\s*\(/.test(close)) {
    bad.push("close() не возвращает рассказ: клип слова мог не зазвучать вовсе, и тогда рассказ замолчит навсегда (долг 158)");
  }

  const button = popoverSpeakButton(code);
  if (button === null) bad.push("в карточке перевода нет <SpeakButton> — сторож ослеп");
  else {
    if (!/onPlay=/.test(button)) bad.push("<SpeakButton> карточки не получает onPlay — рассказ не узнает, что слово зазвучало");
    if (!/onStop=/.test(button)) bad.push("<SpeakButton> карточки не получает onStop — рассказ не узнает, что слово кончилось");
  }
  return bad;
}

function plant() {
  const raw = readFileSync(TARGET, "utf8");
  const cases = [];
  const planted = (from, to, name, expect) => {
    const mutated = raw.replace(from, to);
    if (mutated === raw) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    const found = violationsIn(mutated);
    cases.push({ name, ok: found.some((f) => f.includes(expect)) });
  };

  cases.push({ name: "отрицательный контроль: живой файл сегодня чист", ok: violationsIn(raw).length === 0 });
  planted(
    "                      pauseForWord();\n                      void handleWordClick(wordEl.dataset.word, wordEl, queueIndex);\n                      return;",
    "                      void handleWordClick(wordEl.dataset.word, wordEl, queueIndex);",
    "подсадка: вернуть проваливание тапа по слову в handleSentenceClick — поймано",
    "перематывается",
  );
  planted(
    "  function pauseForWord() {\n    if (!playing) return;\n    handlePlayPause();",
    "  function pauseForWord() {\n    if (!playing) return;\n    audioRef.current?.pause();",
    "подсадка: пауза мимо handlePlayPause — поймана",
    "мимо handlePlayPause",
  );
  planted(
    "    // Долг 158: карточка закрыта — со словом покончено в любом исходе,\n    // включая «клип так и не зазвучал».\n    resumeAfterWord();",
    "",
    "подсадка: close() перестал возвращать рассказ — поймано",
    "замолчит навсегда",
  );
  planted("onPlay={pauseForWord}", "", "подсадка: у кнопки слова отняли onPlay — поймано", "onPlay");
  planted("onStop={resumeAfterWord}", "", "подсадка: у кнопки слова отняли onStop — поймано", "onStop");

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:word-tap-pause --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(readFileSync(TARGET, "utf8"));
  if (bad.length) {
    console.error("ТАП ПО СЛОВУ СНОВА ОСТАВЛЯЕТ ДВА ГОЛОСА (долг 158):");
    for (const b of bad) console.error(`  ${TARGET}: ${b}`);
    return 1;
  }
  console.log("[check:word-tap-pause] четыре места на месте: тап по слову не перематывает, пауза и возврат через handlePlayPause, close() возвращает, кнопка слова отчитывается (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
