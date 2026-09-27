/**
 * check:story-player-truth — заход 7.240, задачи 2 и 5.
 *
 * Что видел владелец (видео 28.09, POCO 1.0.11) и что замерено на эмуляторе:
 *   1. ушёл с рассказа — шторка осталась «PLAYING» без кнопок (`actions=0`),
 *      время бежит: снимались обработчики, а состояние — нет;
 *   2. обложка в шторке — серый динамик: плагину передавался относительный
 *      адрес, а его Java-половина понимает только `http…`/`data:`;
 *   3. кнопка плеера верила своему флагу, а не элементу `<audio>`: чужая
 *      пауза оставляла «⏸» при тишине;
 *   4. «столом .» — точка отрывалась от слова: слово — `<button>`, перенос
 *      строки за ним разрешён, а поле кнопки выглядит как пробел.
 *
 * Правила (все по живым файлам):
 *   R1 размонтирование И `pagehide` зовут `clearNativeMediaSession()`;
 *   R2 `clearNativeMediaSession` ставит состояние `"none"` (иначе служба
 *      плагина не отвяжется и уведомление останется);
 *   R3 `StoryText` слушает события `pause` и `play` самого элемента;
 *   R4 метаданные шторки получают обложку из `nativeArtworkSrc()`, и ни
 *      один вызов `setNativeMediaMetadata` не несёт `src: "/…"`;
 *   R5 слово со следующим знаком — в `whitespace-nowrap`, абзацы — через
 *      `tidyPunctuationSpacing`;
 *   R6 кнопка и шкала плеера несут `data-rf-player` (по ним плеер
 *      оживает в скачанной копии, долг 311);
 *   R7 каждый `data-rf-player`, который ищет каркас копии, есть у плеера,
 *      и подписи кнопки каркас берёт из тех же атрибутов.
 *
 * Позитивный контроль — `--plant`: каждая подсадка ломает одно правило
 * на копии живого файла и обязана быть пойманной; живые файлы — 0 находок.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const FILES = {
  text: "src/components/stories/StoryText.tsx",
  bridge: "src/lib/native-media-session.ts",
  player: "src/components/stories/StoryAudioPlayer.tsx",
  stories: "src/lib/stories.ts",
  shell: "public/offline.html",
};

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

function functionBody(code, name) {
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(code);
  if (!m) return null;
  return blockFrom(code, code.indexOf("{", m.index), "{", "}");
}

/** Тело `const name = (...) => { … }` внутри файла. */
function arrowBody(code, name) {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{`).exec(code);
  if (!m) return null;
  return blockFrom(code, code.indexOf("{", m.index + m[0].length - 1), "{", "}");
}

/** Код без комментариев — чтобы правило не засчитывало объяснение. */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function violationsIn(src) {
  const bad = [];
  const text = stripComments(src.text);
  const bridge = stripComments(src.bridge);
  const player = stripComments(src.player);
  const stories = stripComments(src.stories);

  // R1
  const stop = arrowBody(text, "stopEverything");
  if (stop === null) bad.push("R1: в StoryText нет stopEverything — сторож ослеп, а не доволен");
  else {
    if (!/clearNativeMediaSession\s*\(/.test(stop)) bad.push("R1: уход со страницы не гасит шторку — останется «PLAYING» без кнопок");
    if (!/\.pause\s*\(/.test(stop)) bad.push("R1: уход со страницы не останавливает звук");
    if (!/addEventListener\(\s*"pagehide"\s*,\s*stopEverything/.test(text)) bad.push("R1: смерть документа (pagehide) не гасит шторку — копия без сети покажет чужое «PLAYING»");
    if (!/return\s*\(\)\s*=>\s*\{[^}]*stopEverything\(\)/.test(text)) bad.push("R1: размонтирование не зовёт stopEverything");
  }
  // R2
  const clear = functionBody(bridge, "clearNativeMediaSession");
  if (clear === null) bad.push("R2: функции clearNativeMediaSession нет");
  else if (!/playbackState:\s*"none"/.test(clear)) bad.push("R2: clearNativeMediaSession не ставит состояние \"none\" — служба плагина не отвяжется");
  // R3
  if (!/addEventListener\(\s*"pause"/.test(text)) bad.push("R3: StoryText не слушает событие pause элемента — кнопка врёт после чужой паузы");
  if (!/addEventListener\(\s*"play"/.test(text)) bad.push("R3: StoryText не слушает событие play элемента");
  // R4
  const metaCalls = [...text.matchAll(/setNativeMediaMetadata\(\{[\s\S]*?\}\)/g)].map((m) => m[0]);
  if (metaCalls.length === 0) bad.push("R4: вызова setNativeMediaMetadata нет — сторож ослеп");
  for (const call of metaCalls) {
    if (/src:\s*["'`]\//.test(call)) bad.push("R4: обложка шторки — относительный адрес: Java плагина рисует серый динамик");
  }
  if (!/nativeArtworkSrc\s*\(/.test(text)) bad.push("R4: обложка шторки не берётся из nativeArtworkSrc()");
  // R5
  const render = functionBody(text, "renderSentenceTokens");
  if (render === null) bad.push("R5: функции renderSentenceTokens нет — слова рисуются мимо склейки со знаком");
  else if (!/whitespace-nowrap/.test(render) || !/gluedPunctuation\s*\(/.test(render)) {
    bad.push("R5: слово и знак после него не склеены — точка снова уедет на отдельную строку");
  }
  if (!/\{renderSentenceTokens\(/.test(text)) bad.push("R5: предложение рисует токены не через renderSentenceTokens");
  const split = functionBody(stories, "splitStoryParagraphs");
  if (split === null || !/tidyPunctuationSpacing\s*\(/.test(split)) bad.push("R5: splitStoryParagraphs не убирает пробел перед знаком");
  // R6
  for (const role of ["play", "bar"]) {
    if (!new RegExp(`data-rf-player="${role}"`).test(player)) bad.push(`R6: у плеера нет data-rf-player="${role}" — в копии его нечем оживить`);
  }
  if (!/data-rf-play-label=/.test(player) || !/data-rf-pause-label=/.test(player)) bad.push("R6: кнопка плеера не несёт обе подписи для копии");
  // R7
  const wanted = [...(src.shell ?? "").matchAll(/\[data-rf-player="([a-z]+)"\]/g)].map((m) => m[1]);
  if (wanted.length === 0) bad.push("R7: каркас копии не ищет ни одного data-rf-player — сторож ослеп, а плеер копии мёртв");
  for (const role of new Set(wanted)) {
    if (!new RegExp(`data-rf-player="${role}"`).test(player)) bad.push(`R7: каркас ищет data-rf-player="${role}", а у плеера такого нет — в копии эта кнопка мертва`);
  }
  for (const attr of ["data-rf-play-label", "data-rf-pause-label", "data-rf-story-title"]) {
    if (!(src.shell ?? "").includes(attr)) bad.push(`R7: каркас не читает ${attr}`);
  }
  return bad;
}

function readAll() {
  return Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, readFileSync(f, "utf8")]));
}

function plant() {
  const live = readAll();
  const cases = [];
  const planted = (key, from, to, name, expect) => {
    const mutated = live[key].replace(from, to);
    if (mutated === live[key]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    const found = violationsIn({ ...live, [key]: mutated });
    cases.push({ name, ok: found.some((f) => f.startsWith(expect)) });
  };

  cases.push({ name: "отрицательный контроль: живые файлы чисты", ok: violationsIn(live).length === 0 });
  planted("text", "      void clearNativeMediaSession();\n    };", "    };", "подсадка: уход не гасит шторку (как до 7.240)", "R1");
  planted("text", 'window.addEventListener("pagehide", stopEverything);', "", "подсадка: pagehide не слушается", "R1");
  planted("bridge", 'setPlaybackState({ playbackState: "none" })', 'setPlaybackState({ playbackState: "paused" })', "подсадка: «гашение» ставит паузу", "R2");
  planted("text", 'audio.addEventListener("pause", onPause);', "", "подсадка: чужая пауза не слушается", "R3");
  planted(
    "text",
    'artwork: [{ src, sizes: "192x192", type: "image/png" }],',
    'artwork: [{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],',
    "подсадка: НАСТОЯЩИЙ старый код обложки (относительный адрес)",
    "R4",
  );
  planted("text", 'className="whitespace-nowrap"', 'className=""', "подсадка: склейку слова со знаком сняли", "R5");
  planted("stories", ".map((paragraph) => tidyPunctuationSpacing(paragraph.trim()))", ".map((paragraph) => paragraph.trim())", "подсадка: нормализацию пробела убрали", "R5");
  planted("player", 'data-rf-player="play"', "", "подсадка: у кнопки плеера нет признака для копии", "R6");
  planted("player", 'data-rf-player="back"', 'data-rf-player="rewind"', "подсадка: плеер переименовал «назад», каркас ищет старое имя", "R7");
  planted("shell", 'root.querySelector(\'[data-rf-player="bar"]\')', 'root.querySelector(\'[data-rf-player="progress"]\')', "подсадка: каркас ищет шкалу под именем, которого у плеера нет", "R7");
  // Отрицательный: объяснение в комментарии — не нарушение.
  const commented = live.text.replace("function renderSentenceTokens(", '// src: "/icons/x.png" — так было до 7.240\nfunction renderSentenceTokens(');
  cases.push({ name: "отрицательный контроль: старый адрес в КОММЕНТАРИИ — молчание", ok: violationsIn({ ...live, text: commented }).length === 0 });

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:story-player-truth --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(readAll());
  if (bad.length) {
    console.error("ПЛЕЕР РАССКАЗА СНОВА РАСХОДИТСЯ СО ЗВУКОМ (заход 7.240):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("[check:story-player-truth] шторка гаснет с уходом и pagehide, кнопка слушает элемент, обложка картинкой, знак приклеен к слову, признаки плеера для копии на месте (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
