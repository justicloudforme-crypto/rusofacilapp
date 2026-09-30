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
 *      и подписи кнопки каркас берёт из тех же атрибутов;
 *   R8 (заходы 7.253 → 7.254, долг 362) перемотка по полоске пальцем
 *      есть, но только намеренная. Поведение — сам модуль жеста
 *      `src/lib/seek-gesture.ts` (без сборки, Node исполняет .ts):
 *      тап и перетаскивание перематывают ОДИН раз при отпускании;
 *      прокрутка с полоски (сдвиг по вертикали), отмена жеста браузером,
 *      долгое касание без сдвига (ладонь) и второй палец — не
 *      перематывают; мышь — сразу и на каждом шаге. Разметка плеера:
 *      зона касания `data-rf-player="seek-zone"` высотой 44 px (`h-11`) с
 *      `touch-pan-y` и обработчиками через `seekGestureStep`; ползунок
 *      `range` указателю недоступен (`pointer-events-none`), а его
 *      `onChange` (клавиатура, TalkBack) зовёт `onSeek`. Видео POCO 30.09
 *      (до 7.253): палец по полоске — лесенка 8 → 0; решение владельца
 *      30.09: перемотка пальцем нужна.
 *   R9 (заход 7.254) полоска рассказа с одной дорожкой идёт по ВРЕМЕНИ,
 *      как шкала шторки: `StoryText` отдаёт плееру `audioRef` и
 *      `sentenceOffsets`, плеер рисует `clock.time / timeline.duration`.
 *      Видео POCO 01.10: пауза на 24,9 с — шторка 28 %, страница ≈ 50 %
 *      (номер строки + 1 из 14).
 *   R10 (заход 7.255) ⏪/⏩ до первого «▶» считают от СОХРАНЁННОГО места и
 *      переносят его. Поведение — сам модуль `src/lib/story-skip.ts`
 *      (Node исполняет .ts): место 26,2 с, ⏪ → 11,2, ⏩ → 41,2; место
 *      10 с, ⏪ → 0 (не меньше); у конца — не дальше длины; во время
 *      игры — от дорожки, ровно 15 с. Разметка: `skipByFull` берёт
 *      `pendingResumeOffset(audio)` и передаёт его в `skipTarget`, а при
 *      непустом месте ставит строку, снимает метку «продолжить отсюда» и
 *      сохраняет место; «▶» подставляет место через тот же
 *      `pendingResumeOffset`. Видео POCO 01.10: одно ⏪ до «▶» у
 *      «Снегурочки» и «Репки» — полоска в ноль, «▶» с первой фразы.
 *
 * Позитивный контроль — `--plant`: каждая подсадка ломает одно правило
 * на копии живого файла и обязана быть пойманной; живые файлы — 0 находок.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const FILES = {
  text: "src/components/stories/StoryText.tsx",
  bridge: "src/lib/native-media-session.ts",
  player: "src/components/stories/StoryAudioPlayer.tsx",
  stories: "src/lib/stories.ts",
  shell: "public/offline.html",
  gesture: "src/lib/seek-gesture.ts",
  skip: "src/lib/story-skip.ts",
};

/**
 * Исполняет текст модуля жеста (живой или подсаженный) и гоняет по нему
 * жесты. Файл кладётся во временную папку — у модуля нет импортов.
 */
async function gestureViolations(source) {
  const bad = [];
  const dir = mkdtempSync(join(tmpdir(), "rf-seek-gesture-"));
  let mod;
  try {
    const file = join(dir, "seek-gesture.ts");
    writeFileSync(file, source);
    mod = await import(pathToFileURL(file).href);
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    return [`R8: модуль жеста не исполняется (${error.message.split("\n")[0]}) — сторож ослеп`];
  }
  rmSync(dir, { recursive: true, force: true });
  if (typeof mod.seekGestureStep !== "function") return ["R8: в модуле жеста нет seekGestureStep — сторож ослеп"];
  const run = (events) => {
    let state = null;
    const commits = [];
    for (const e of events) {
      const step = mod.seekGestureStep(state, e);
      state = step.state;
      if (step.commit !== null) commits.push(step.commit);
    }
    return commits;
  };
  const down = (x, y, t, f, pointer = "touch", pointerId = 1, isPrimary = true) => ({ type: "down", pointerId, pointer, isPrimary, x, y, t, fraction: f });
  const move = (x, y, t, f, pointerId = 1) => ({ type: "move", pointerId, x, y, t, fraction: f });
  const up = (x, y, t, f, pointerId = 1) => ({ type: "up", pointerId, x, y, t, fraction: f });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  if (!same(run([down(100, 600, 0, 0.4), up(101, 600, 120, 0.4)]), [0.4])) bad.push("R8: тап пальцем по полоске не перематывает — перемотка пальцем, которую просил владелец, пропала");
  const drag = run([down(300, 600, 0, 0.8), move(270, 601, 20, 0.6), move(200, 602, 40, 0.3), move(120, 603, 60, 0.05), up(110, 603, 950, 0)]);
  if (drag.length === 0) bad.push("R8: перетаскивание пальцем не перематывает — перемотка пальцем пропала");
  else if (!same(drag, [0])) bad.push(`R8: перетаскивание перематывает на каждом шаге (${drag.join(" → ")}) — лесенка 8 → 0 с видео POCO вернётся`);
  if (run([down(250, 600, 0, 0.5), move(252, 615, 20, 0.5), move(254, 660, 40, 0.5), up(254, 660, 200, 0.5)]).length) bad.push("R8: прокрутка страницы, начатая на полоске, перематывает рассказ");
  // Прокрутка дугой: палец ушёл вниз, потом вбок — это всё ещё прокрутка.
  if (run([down(250, 600, 0, 0.5), move(252, 630, 20, 0.5), move(300, 634, 40, 0.7), up(300, 634, 200, 0.7)]).length) bad.push("R8: прокрутка страницы дугой (вниз, потом вбок) перематывает рассказ");
  if (run([down(250, 600, 0, 0.5), { type: "cancel", pointerId: 1 }, up(250, 600, 100, 0.5)]).length) bad.push("R8: жест, отменённый браузером (прокрутка), перематывает");
  if (run([down(60, 610, 0, 0.02), up(60, 610, 1200, 0.02)]).length) bad.push("R8: лежащая ладонь (долгое касание без сдвига) перематывает");
  if (run([down(200, 600, 0, 0.3), down(40, 610, 30, 0, "touch", 2, false), up(40, 610, 60, 0, 2), up(200, 600, 120, 0.3)]).length) bad.push("R8: второй палец (ладонь) не снимает перемотку");
  if (!same(run([down(100, 600, 0, 0.2, "mouse"), move(150, 600, 20, 0.4), up(150, 600, 40, 0.4)]), [0.2, 0.4])) bad.push("R8: мышь больше не перематывает сразу и на каждом шаге");
  return bad;
}

/** Исполняет модуль ⏪/⏩ (живой или подсаженный) — правило R10. */
async function skipViolations(source) {
  const bad = [];
  const dir = mkdtempSync(join(tmpdir(), "rf-story-skip-"));
  let mod;
  try {
    const file = join(dir, "story-skip.ts");
    writeFileSync(file, source);
    mod = await import(pathToFileURL(file).href);
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    return [`R10: модуль ⏪/⏩ не исполняется (${error.message.split("\n")[0]}) — сторож ослеп`];
  }
  rmSync(dir, { recursive: true, force: true });
  if (typeof mod.skipTarget !== "function") return ["R10: в модуле ⏪/⏩ нет skipTarget — сторож ослеп"];
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const back = mod.skipTarget(0, 26.208, -15, 80.82);
  if (!near(back, 11.208)) bad.push(`R10: ⏪ до «▶» с места 26,2 с дал ${back} — ждали 11,208 (видео POCO 01.10: в ноль)`);
  const fwd = mod.skipTarget(0, 26.208, 15, 80.82);
  if (!near(fwd, 41.208)) bad.push(`R10: ⏩ до «▶» с места 26,2 с дал ${fwd} — ждали 41,208`);
  if (!near(mod.skipTarget(0, 10, -15, 80.82), 0)) bad.push("R10: ⏪ у начала уводит ниже нуля");
  if (!near(mod.skipTarget(0, 75, 15, 80.82), 80.82)) bad.push("R10: ⏩ у конца уводит дальше длины");
  if (!near(mod.skipTarget(40, null, -15, 80.82), 25) || !near(mod.skipTarget(40, null, 15, 80.82), 55)) bad.push("R10: во время игры ⏪/⏩ — не ровно 15 с от дорожки");
  return bad;
}

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

export async function violationsIn(src) {
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
  // R8 — разметка плеера; поведение жеста — gestureViolations().
  const zoneAt = player.search(/data-rf-player="seek-zone"/);
  if (zoneAt < 0) bad.push("R8: у полоски нет зоны касания data-rf-player=\"seek-zone\" — сторож ослеп, а не доволен");
  else {
    const open = player.lastIndexOf("<div", zoneAt);
    const zone = player.slice(open, player.indexOf("/>", zoneAt) + 2);
    if (!/\bh-11\b|\bh-12\b|\bh-14\b/.test(zone)) bad.push("R8: зона касания полоски ниже 44 px");
    if (!/\btouch-pan-y\b|touchAction:\s*"pan-y"/.test(zone)) bad.push("R8: зона касания не отдаёт браузеру вертикальную прокрутку (touch-action: pan-y)");
    for (const handler of ["onPointerDown", "onPointerMove", "onPointerUp", "onPointerCancel"]) {
      if (!new RegExp(`${handler}=`).test(zone)) bad.push(`R8: у зоны касания нет ${handler} — жест не доходит до seekGestureStep`);
    }
  }
  if (!/from\s+"@\/lib\/seek-gesture"/.test(player) || !/seekGestureStep\s*\(/.test(player)) bad.push("R8: плеер не ведёт жест через seekGestureStep");
  const rangeAt = player.search(/<input\s+type="range"/);
  if (rangeAt < 0) bad.push("R8: у плеера нет ползунка type=\"range\" — клавиатура и TalkBack без перемотки");
  else {
    const range = player.slice(rangeAt, player.indexOf("/>", rangeAt) + 2);
    if (!/\bpointer-events-none\b/.test(range)) bad.push("R8: указатель доходит до ползунка — палец снова перематывает на каждом шаге, мимо правил жеста");
    if (!/onChange=\{\(?\w+\)?\s*=>\s*onSeek\(/.test(range) && !/onChange=\{[\s\S]*?onSeek\(/.test(range)) bad.push("R8: onChange ползунка не зовёт onSeek — клавиатура и TalkBack потеряли перемотку");
  }
  // R9
  if (!/audioRef=\{hasFullAudio \? audioRef : undefined\}/.test(text) || !/sentenceOffsets=\{hasFullAudio \? sentenceOffsets : null\}/.test(text)) {
    bad.push("R9: StoryText не отдаёт плееру дорожку и начала строк — полоска снова по номеру строки и расходится со шторкой");
  }
  if (!/clock\.time\s*\/\s*timeline\.duration/.test(player)) bad.push("R9: полоска плеера не считает время / длину дорожки — расходится со шторкой");
  if (!/width:\s*`\$\{fill \* 100\}%`/.test(player)) bad.push("R9: ширина полоски берётся не из времени дорожки");
  // R10 — разметка; поведение — skipViolations().
  const skipFull = functionBody(text, "skipByFull");
  const pending = functionBody(text, "pendingResumeOffset");
  if (skipFull === null || pending === null) bad.push("R10: в StoryText нет skipByFull или pendingResumeOffset — сторож ослеп, а не доволен");
  else {
    if (!/readingQueueIndex\s*!==\s*null/.test(pending) || !/resumeQueueIndex\s*===\s*null/.test(pending) || !/sentenceOffsets\?\.\[resumeQueueIndex\]/.test(pending)) bad.push("R10: pendingResumeOffset не отдаёт начало сохранённой строки до первого «▶»");
    if (!/=\s*pendingResumeOffset\(audio\)/.test(skipFull) || !/skipTarget\(\s*audio\.currentTime\s*,\s*pendingResume\s*,/.test(skipFull)) bad.push("R10: ⏪/⏩ считают не от сохранённого места — до «▶» снова уведут в ноль");
    if (!/setResumeQueueIndex\(null\)/.test(skipFull) || !/saveStoryProgress\(/.test(skipFull) || !/setReadingQueueIndex\(/.test(skipFull)) bad.push("R10: ⏪/⏩ до «▶» не переносят сохранённое место — «▶» вернёт на старое");
  }
  const playPause = functionBody(text, "handlePlayPause");
  if (playPause === null || !/pendingResumeOffset\(audio\)/.test(playPause)) bad.push("R10: «▶» подставляет место не через pendingResumeOffset — правило ⏪/⏩ и «▶» разойдутся");
  bad.push(...(await skipViolations(src.skip ?? "")));
  bad.push(...(await gestureViolations(src.gesture ?? "")));
  return bad;
}

function readAll() {
  return Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, readFileSync(f, "utf8")]));
}

async function plant() {
  const live = readAll();
  const cases = [];
  const pending = [];
  const planted = (key, from, to, name, expect) => {
    const mutated = live[key].replace(from, to);
    if (mutated === live[key]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    pending.push(
      violationsIn({ ...live, [key]: mutated }).then((found) => cases.push({ name, ok: found.some((f) => f.startsWith(expect)) })),
    );
  };

  cases.push({ name: "отрицательный контроль: живые файлы чисты", ok: (await violationsIn(live)).length === 0 });
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
  // R8 — поведение модуля жеста.
  planted(
    "gesture",
    "if (state.mode === \"drag\") {\n      return { state: { ...state, fraction: event.fraction }, commit: null, preview: event.fraction };",
    "if (state.mode === \"drag\") {\n      return { state: { ...state, fraction: event.fraction }, commit: event.fraction, preview: event.fraction };",
    "подсадка: перетаскивание перематывает на каждом шаге (как ползунок до 7.253)",
    "R8",
  );
  planted(
    "gesture",
    "if (dy >= SEEK_SLOP_PX && dy >= dx) return { state: { ...state, mode: \"void\" }, commit: null, preview: null };",
    "",
    "подсадка: прокрутка с полоски не отличается от перетаскивания",
    "R8",
  );
  planted("gesture", "if (event.type === \"cancel\") return { state: null, commit: null, preview: null };", "if (event.type === \"cancel\") return { state: null, commit: state.fraction, preview: null };", "подсадка: отменённый браузером жест перематывает", "R8");
  planted("gesture", "const short = event.t - state.t0 <= SEEK_TAP_MAX_MS;", "const short = true;", "подсадка: лежащая ладонь считается тапом", "R8");
  planted("gesture", "return { state: { ...state, mode: \"void\" }, commit: null, preview: null };\n    }\n    if (!event.isPrimary)", "return { state, commit: null, preview: null };\n    }\n    if (!event.isPrimary)", "подсадка: второй палец не снимает перемотку", "R8");
  planted("gesture", "if (state.mode === \"drag\") return { state: null, commit: event.fraction, preview: null };", "if (state.mode === \"drag\") return { state: null, commit: null, preview: null };", "подсадка: НАСТОЯЩИЙ итог 7.253 — палец не перематывает вовсе", "R8");
  planted("gesture", "if (event.pointer === \"mouse\") return { state: next, commit: event.fraction, preview: null };", "", "подсадка: мышь не перематывает при нажатии", "R8");
  // R8 — разметка плеера.
  planted("player", "pointer-events-none absolute", "absolute", "подсадка: НАСТОЯЩИЙ старый ползунок — указатель снова доходит до range", "R8");
  planted("player", "cursor-pointer touch-pan-y", "cursor-pointer", "подсадка: зона касания без touch-action: pan-y", "R8");
  planted("player", "top-1/2 h-11 -translate-y-1/2 cursor-pointer", "top-1/2 h-6 -translate-y-1/2 cursor-pointer", "подсадка: зона касания 24 px, как у прежнего ползунка", "R8");
  planted("player", "onPointerCancel={(event) => run({ type: \"cancel\", pointerId: event.pointerId })}", "", "подсадка: отмену жеста браузером зона не слушает", "R8");
  planted("player", "onChange={(event) => onSeek(Number(event.target.value))}", "onChange={() => {}}", "подсадка: клавиатура не перематывает", "R8");
  planted("text", "audioRef={hasFullAudio ? audioRef : undefined}", "", "подсадка: StoryText не отдаёт плееру дорожку (как до 7.254)", "R9");
  planted("player", "if (clock.time > 0) return clock.time / timeline.duration;", "if (clock.time > 0) return progress;", "подсадка: полоска по номеру строки при игре", "R9");
  // R10 — поведение модуля ⏪/⏩ и разметка StoryText.
  planted("skip", "const from = pendingResume ?? currentTime;", "const from = currentTime;", "подсадка: НАСТОЯЩЕЕ старое правило — ⏪/⏩ от дорожки, а не от места", "R10");
  planted("skip", "Math.min(Math.max(0, from + delta), end)", "Math.min(from + delta, end)", "подсадка: ⏪ ниже нуля", "R10");
  planted("text", "skipTarget(audio.currentTime, pendingResume, deltaSeconds, audio.duration)", "skipTarget(audio.currentTime, null, deltaSeconds, audio.duration)", "подсадка: StoryText не отдаёт место в skipTarget", "R10");
  planted("text", "    setResumeQueueIndex(null);\n    if (storyId) saveStoryProgress(storyId, { currentPage: index + 1, totalPages: queue.length, queueIndex: index });\n  }\n\n  /** ±15s skip, correctly", "  }\n\n  /** ±15s skip, correctly", "подсадка: ⏪ до «▶» не переносит сохранённое место", "R10");
  planted("text", "      const pendingResume = pendingResumeOffset(audio);\n      if (pendingResume !== null) audio.currentTime = pendingResume;", "      if (readingQueueIndex === null && resumeQueueIndex !== null && audio.currentTime === 0) {\n        const offset = sentenceOffsets?.[resumeQueueIndex];\n        if (offset !== undefined) audio.currentTime = offset;\n      }", "подсадка: «▶» со своим условием места (как до 7.255)", "R10");
  planted("player", "style={{ width: `${fill * 100}%` }}", "style={{ width: `${Math.min(progress * 100, 100)}%` }}", "подсадка: НАСТОЯЩАЯ старая ширина полоски (до 7.254)", "R9");
  // Отрицательный: объяснение в комментарии — не нарушение.
  const commented = live.text.replace("function renderSentenceTokens(", '// src: "/icons/x.png" — так было до 7.240\nfunction renderSentenceTokens(');
  cases.push({ name: "отрицательный контроль: старый адрес в КОММЕНТАРИИ — молчание", ok: (await violationsIn({ ...live, text: commented })).length === 0 });
  await Promise.all(pending);

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:story-player-truth --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

async function main() {
  if (PLANT) return plant();
  const bad = await violationsIn(readAll());
  if (bad.length) {
    console.error("ПЛЕЕР РАССКАЗА СНОВА РАСХОДИТСЯ СО ЗВУКОМ (заход 7.240):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("[check:story-player-truth] шторка гаснет с уходом и pagehide, кнопка слушает элемент, обложка картинкой, знак приклеен к слову, признаки плеера для копии на месте, перемотка по полоске — только намеренный тап или перетаскивание, полоска по времени как шторка, ⏪/⏩ до «▶» — от сохранённого места (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = await main();
