/**
 * УХОД СО СТРАНИЦЫ РАССКАЗА ОБНУЛЯЕТ ШКАЛУ ШТОРКИ — СТОРОЖ ЗАХОДА 7.248
 * (Ж.2 аудита 7.241, живая страница).
 *
 * Замер на эмуляторе 28.09.2026 (`dumpsys media_session`): живая «Репка»
 * (полная дорожка 89 с) → живой «Колобок» (фразы по очереди, у него
 * шкалы нет) — сессия «Колобка» стартует с `position=66657`, позиции
 * «Репки». Java-половина плагина хранит длительность и позицию в
 * процессе, а `setPositionState({})` оставляет прежние.
 *
 * Правила:
 *   1) `clearNativeMediaSession` сперва шлёт `setPositionState` с нулями,
 *      и только потом `playbackState: "none"`;
 *   2) `setNativePositionState(null)` означает нули, а не пустой объект;
 *   3) страница рассказа зовёт `clearNativeMediaSession` при `pagehide` и
 *      при размонтировании (иначе правилу 1 нечем сработать).
 * Поведение заперто рядом: `src/lib/native-media-session.test.ts`.
 *
 *   node scripts/check-media-position-reset.mjs          # гейт
 *   node scripts/check-media-position-reset.mjs --plant  # контроль подсадками
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const FILES = {
  lib: "src/lib/native-media-session.ts",
  story: "src/components/stories/StoryText.tsx",
};
const read = () => Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, readFileSync(p, "utf8")]));

function fnBody(code, name) {
  const at = code.indexOf(`function ${name}(`);
  if (at === -1) return "";
  let depth = 0;
  for (let i = code.indexOf("{", at); i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}" && --depth === 0) return code.slice(at, i + 1);
  }
  return "";
}

export function violationsIn(src) {
  const bad = [];
  const zero = /const NO_POSITION = \{ duration: 0, position: 0, playbackRate: 1 \};/.test(src.lib);
  if (!zero) bad.push(`${FILES.lib}: нулевой шкалы NO_POSITION нет — обнулять нечем (Ж.2)`);
  const clear = fnBody(src.lib, "clearNativeMediaSession");
  if (!clear) bad.push(`${FILES.lib}: clearNativeMediaSession не найден — сторож ослеп`);
  else {
    const reset = clear.indexOf("setPositionState(NO_POSITION)");
    const none = clear.indexOf('playbackState: "none"');
    if (reset === -1) bad.push(`${FILES.lib}: уход не обнуляет шкалу плагина — следующий рассказ стартует с чужой позиции (Ж.2)`);
    else if (none === -1 || reset > none) bad.push(`${FILES.lib}: шкала обнуляется ПОСЛЕ «none» или «none» пропал — порядок нарушен (Ж.2)`);
  }
  // Тело до следующего `export`: у параметра свой `{ … }` в типе, и поиск
  // по первой скобке взял бы тип, а не тело.
  const posAt = src.lib.indexOf("function setNativePositionState(");
  const setPos = posAt === -1 ? "" : src.lib.slice(posAt, src.lib.indexOf("\nexport", posAt + 1) >>> 0);
  if (!/options \?\? NO_POSITION/.test(setPos)) {
    bad.push(`${FILES.lib}: setNativePositionState(null) снова шлёт пустой объект — плагин оставит прежнюю шкалу (Ж.2)`);
  }
  if (!/window\.addEventListener\("pagehide", stopEverything\)/.test(src.story) || !/const stopEverything = \(\) => \{[\s\S]*?void clearNativeMediaSession\(\);[\s\S]*?\};/.test(src.story)) {
    bad.push(`${FILES.story}: уход со страницы рассказа больше не зовёт clearNativeMediaSession по pagehide`);
  }
  return bad;
}

function plant() {
  const raw = read();
  const cases = [];
  const planted = (file, from, to, name, expect) => {
    const mutated = { ...raw, [file]: raw[file].replace(from, to) };
    if (mutated[file] === raw[file]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violationsIn(mutated).some((f) => f.includes(expect)) });
  };
  cases.push({ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violationsIn(raw).length === 0 });
  cases.push({ name: "пустой вход — сторож краснеет, а не молчит", ok: violationsIn({ lib: "", story: "" }).length >= 3 });
  planted("lib", "  await nativeOnly(() => MediaSession.setPositionState(NO_POSITION));\n", "", "подсадка: уход без обнуления (как на main a8116b6) — поймано", "не обнуляет шкалу");
  planted(
    "lib",
    '  await nativeOnly(() => MediaSession.setPositionState(NO_POSITION));\n  await nativeOnly(() => MediaSession.setPlaybackState({ playbackState: "none" }));',
    '  await nativeOnly(() => MediaSession.setPlaybackState({ playbackState: "none" }));\n  await nativeOnly(() => MediaSession.setPositionState(NO_POSITION));',
    "подсадка: обнуление после «none» — поймано",
    "порядок нарушен",
  );
  planted("lib", "options ?? NO_POSITION", "options ?? {}", "подсадка: null снова пустой объект — поймано", "пустой объект");
  planted("story", "      void clearNativeMediaSession();\n", "", "подсадка: pagehide не гасит шторку — поймано", "больше не зовёт");

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:media-position-reset --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(read());
  if (bad.length) {
    console.error("ШТОРКА СНОВА БЕРЁТ ЧУЖУЮ ШКАЛУ (Ж.2):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log("[check:media-position-reset] уход со страницы рассказа: шкала плагина в ноль, потом «none»; null — нули (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
