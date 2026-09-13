/**
 * «Лекарство не заперто болезнью» — сторож долга 152 (заход 7.187).
 *
 * ЧТО БЫЛО. Нативная медиа-сессия (карточка проигрывателя в шторке
 * телефона) была написана ещё в 7.157 и не вызывалась НИ РАЗУ. Замер на
 * живом POCO X6 Pro 5G (Android 16) 12.09.2026: в System WebView, на
 * котором работает оболочка, `'mediaSession' in navigator` → **false**,
 * `MediaMetadata` → `undefined`, `dumpsys media_session` → `have 0
 * sessions`. А все четыре вызова `setNative*` стояли ВНУТРИ эффектов,
 * открытых сторожем `if (!("mediaSession" in navigator)) return;` — то
 * есть за проверкой ровно того API, отсутствие которого они и лечат.
 *
 * ПРАВИЛО, которое здесь заперто, — структурное и одно:
 *
 *   ни один вызов нативной медиа-сессии (`setNative…` из
 *   src/lib/native-media-session.ts) не имеет права стоять внутри блока
 *   `useEffect`, в котором есть сторож по `navigator.mediaSession`.
 *
 * Почему структурой, а не только поведением. Поведение заперто рядом —
 * `src/components/stories/StoryText.media-session.test.tsx` рендерит
 * компонент в jsdom, у которого форма ТА ЖЕ, что у оболочки (проверено
 * первым же тестом того файла), и требует шесть нативных вызовов из
 * шести. Но тест видит ОДИН компонент; правило же обязано пережить
 * появление второго проигрывателя, который про эту ловушку не знает.
 * Поэтому здесь читается весь `src/`.
 *
 * Комментарии и строковые литералы снимаются перед разбором — иначе
 * сторож ругался бы на собственное объяснение выше.
 *
 *   node scripts/check-native-media-session.mjs          # гейт
 *   node scripts/check-native-media-session.mjs --plant  # позитивный и отрицательный контроль
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const PLANT = process.argv.slice(2).includes("--plant");

/** Вызовы нативной половины — по имени экспортов native-media-session.ts. */
const NATIVE_CALL = /\bsetNative(?:ActionHandler|SeekToHandler|MediaMetadata|PlaybackState|PositionState)\s*\(/;
/** Сторож веб-половины в любой из его написанных форм. */
const WEB_GUARD = /["']mediaSession["']\s+in\s+navigator|navigator\s*\.\s*mediaSession/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full) && !/\.(test|spec)\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Снимает комментарии и литералы, сохраняя длину (и потому номера строк). */
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
      // Кавычки оставляем на месте: сторож `"mediaSession" in navigator`
      // ищется по форме, а её содержимое — единственная строка, которую
      // снимать нельзя. Вместо этого вырезаем только НУТРО литерала,
      // если оно не равно "mediaSession".
      if (source.slice(i + 1, j - 1) !== "mediaSession") blank(i + 1, j - 1);
      i = j;
    } else {
      i++;
    }
  }
  return out.join("");
}

/** Все блоки `useEffect(` файла — от скобки до парной ей. */
function effectBlocks(code) {
  const blocks = [];
  const marker = /\buseEffect\s*\(/g;
  let m;
  while ((m = marker.exec(code)) !== null) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < code.length; i++) {
      if (code[i] === "(") depth++;
      else if (code[i] === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = code.slice(m.index, i + 1);
    blocks.push({ start: m.index, line: code.slice(0, m.index).split("\n").length, body });
    marker.lastIndex = i + 1;
  }
  return blocks;
}

/** Находки в одном разобранном файле. */
export function violationsIn(code, path) {
  const hits = [];
  for (const block of effectBlocks(code)) {
    if (!NATIVE_CALL.test(block.body)) continue;
    if (!WEB_GUARD.test(block.body)) continue;
    hits.push({ path, line: block.line });
  }
  return hits;
}

function scan() {
  const files = walk(join(ROOT, "src"));
  const hits = [];
  let withNative = 0;
  for (const f of files) {
    const raw = readFileSync(f, "utf8");
    if (!NATIVE_CALL.test(raw)) continue;
    withNative++;
    hits.push(...violationsIn(stripCommentsAndStrings(raw), relative(ROOT, f)));
  }
  return { files: files.length, withNative, hits };
}

const OLD_SHAPE = `
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", play);
    void setNativeActionHandler("play", play);
  }, [x]);
`;
const NEW_SHAPE = `
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", play);
  }, [x]);

  useEffect(() => {
    void setNativeActionHandler("play", play);
  }, [x]);
`;

function plant() {
  const cases = [];
  cases.push({
    name: "подсадка: НАСТОЯЩИЙ старый код (нативный вызов за веб-сторожем) — пойман",
    ok: violationsIn(stripCommentsAndStrings(OLD_SHAPE), "x.tsx").length === 1,
  });
  cases.push({
    name: "отрицательный контроль: разведённые эффекты — 0 находок",
    ok: violationsIn(stripCommentsAndStrings(NEW_SHAPE), "x.tsx").length === 0,
  });
  cases.push({
    name: "отрицательный контроль: веб-эффект БЕЗ нативных вызовов — 0 находок",
    ok:
      violationsIn(
        stripCommentsAndStrings(`useEffect(() => { if (!("mediaSession" in navigator)) return; ms.setActionHandler("play", p); }, []);`),
        "x.tsx",
      ).length === 0,
  });
  cases.push({
    name: "отрицательный контроль: объяснение в комментарии нарушением не считается",
    ok:
      violationsIn(
        stripCommentsAndStrings(`useEffect(() => {\n  // "mediaSession" in navigator тут больше не спрашивается\n  void setNativePlaybackState(p);\n}, []);`),
        "x.tsx",
      ).length === 0,
  });
  cases.push({
    name: "подсадка: другая форма сторожа (navigator.mediaSession &&) — тоже поймана",
    ok:
      violationsIn(
        stripCommentsAndStrings(`useEffect(() => { if (!navigator.mediaSession) return; void setNativeMediaMetadata(m); }, []);`),
        "x.tsx",
      ).length === 1,
  });
  cases.push({
    name: "подсадка на ЖИВОМ файле: вернуть вызов в веб-эффект StoryText.tsx — поймано",
    ok: (() => {
      const raw = readFileSync(join(ROOT, "src/components/stories/StoryText.tsx"), "utf8");
      const planted = raw.replace(
        'ms.setActionHandler("play", play);',
        'ms.setActionHandler("play", play);\n    void setNativeActionHandler("play", play);',
      );
      if (planted === raw) return false; // якорь подсадки уехал — это тоже отказ
      return violationsIn(stripCommentsAndStrings(planted), "StoryText.tsx").length === 1;
    })(),
  });
  cases.push({
    name: "живой файл сегодня чист",
    ok: scan().hits.length === 0,
  });
  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:native-media-session --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const { files, withNative, hits } = scan();
  if (files === 0) {
    console.error("проверять нечего: в src/ не нашлось ни одного файла — пустое множество результатом не считается");
    return 1;
  }
  if (withNative === 0) {
    console.error(
      "в src/ нет НИ ОДНОГО вызова нативной медиа-сессии: либо проигрыватель потерял нативную половину,\n" +
        "либо её переименовали и сторож ослеп. Пустое множество результатом не считается.",
    );
    return 1;
  }
  console.log(`[check:native-media-session] файлов просмотрено: ${files}, из них с нативными вызовами: ${withNative}`);
  if (hits.length) {
    console.error("\nНАТИВНАЯ МЕДИА-СЕССИЯ СНОВА ЗАПЕРТА ВЕБ-СТОРОЖЕМ (долг 152):");
    for (const h of hits) console.error(`  ${h.path}: useEffect со строки ${h.line}`);
    return 1;
  }
  console.log("нативных вызовов за сторожем navigator.mediaSession: 0 (контроль — --plant).");
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
