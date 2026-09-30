// «НАЗАД» ANDROID СНАЧАЛА ЗАКРЫВАЕТ ОТКРЫТОЕ — заход 7.242, долг 347
// (аудит 7.241, Р6).
//
// ОТКУДА. Замер 7.241 на эмуляторе, релиз 1.0.12: меню «≡» на первой
// странице → «Назад» закрывает всё приложение; лист «Este material está
// cerrado» → «Назад» уводит на прошлую страницу, а лист висит поверх неё.
// Обработчик знал только `history.back()` и `exitApp()`.
//
// ЧТО СТЕРЕЖЁТСЯ — ПЕРЕПИСЬЮ, А НЕ СПИСКОМ.
//   1. Обработчик (`NativeBackButtonHandler.tsx`) зовёт `closeTopBackLayer()`
//      и выходит, ПРЕЖДЕ чем дойти до `history.back()` и `exitApp()`.
//   2. КАЖДЫЙ компонент в `src/`, который рисует окно (`aria-modal="true"`)
//      или портал (`createPortal(`), встаёт на учёт (`useBackLayer(`) —
//      кроме названных поимённо слоёв, которые человек не закрывает
//      (у каждого причина). Новое окно без учёта роняет сторож само, без
//      правки этого файла: рукописный список уже стоил проекту долга 184.
//   3. `useBackLayer` действительно ставит слой (`pushBackLayer`) и
//      снимает его в очистке эффекта.
//   4. (заход 7.255, долг 366) «Назад» закрывает слой ЕГО ЖЕ `onClose` —
//      значит, `onClose` любого слоя в `src/` не уводит со страницы
//      (`router.push/replace`, `location.*`). Замер 7.251: лист «¡Puzle
//      resuelto!» с `onClose={backToList}` — «Назад» закрыл лист и увёл
//      с пазла на список. Перепись — по всем `onClose={…}` в `.tsx`,
//      имя разворачивается в тело функции того же файла.
// Поведение самого стека и обработчика (закрыть верхний, остановиться;
// без слоёв — история, без истории — выход) держит юнит-тест
// `src/components/NativeBackButtonHandler.test.tsx`.
//
// Разбор — по тексту без комментариев; подсадки правят текст в памяти.
//
//   node scripts/check-native-back.mjs [--plant]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { repoFiles } from "./repo-files.mjs";

const HANDLER = "src/components/NativeBackButtonHandler.tsx";
const HOOK = "src/lib/useBackLayer.ts";

/** Слои, которые человек не закрывает, — и потому «Назад» их не касается. */
export const NOT_CLOSABLE = new Map([
  ["src/components/ui/Toast.tsx", "всплывающая строка сама гаснет по таймеру, закрывать нечего"],
  ["src/components/celebration/Confetti.tsx", "украшение поверх окна праздника; закрывается вместе с окном, у которого свой учёт"],
]);

function strip(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
}

export function judge(files) {
  const bad = [];
  const handler = strip(files[HANDLER] ?? "");
  const closeAt = handler.indexOf("if (closeTopBackLayer()) return;");
  const backAt = handler.indexOf("window.history.back()");
  const exitAt = handler.indexOf("App.exitApp()");
  if (closeAt < 0) bad.push(`${HANDLER}: «Назад» не закрывает открытый слой (нет «if (closeTopBackLayer()) return;»)`);
  else if ((backAt >= 0 && backAt < closeAt) || (exitAt >= 0 && exitAt < closeAt)) {
    bad.push(`${HANDLER}: закрытие слоя стоит ПОСЛЕ history.back()/exitApp() — лист останется висеть, а приложение уйдёт`);
  }
  const hook = strip(files[HOOK] ?? "");
  if (!/return pushBackLayer\(/.test(hook)) bad.push(`${HOOK}: хук не ставит слой на учёт (или не снимает его в очистке эффекта)`);

  const NAV = /router\.(push|replace)\(|location\.(assign|replace)\(|location\.href\s*=/;
  for (const [file, raw] of Object.entries(files)) {
    if (!file.endsWith(".tsx") || file.includes(".test.")) continue;
    const src = strip(raw);
    for (const m of src.matchAll(/<(\w+)\b[^<>]*?\bonClose=\{([^}]*)\}/g)) {
      const expr = m[2].trim();
      let body = expr;
      if (/^\w+$/.test(expr)) {
        const def = new RegExp(`function\\s+${expr}\\s*\\(|const\\s+${expr}\\s*=`).exec(src);
        body = def ? src.slice(def.index, src.indexOf("}", def.index) + 1) : "";
      }
      if (NAV.test(body)) {
        bad.push(`${file}: <${m[1]} onClose={${expr}}> уводит со страницы — «Назад» Android закрывает слой этим же onClose и уйдёт вместе с ним (долг 366)`);
      }
    }
  }

  let layers = 0;
  for (const [file, raw] of Object.entries(files)) {
    if (!file.endsWith(".tsx") || file.includes(".test.")) continue;
    const src = strip(raw);
    if (!/aria-modal="true"|createPortal\(/.test(src)) continue;
    layers++;
    if (NOT_CLOSABLE.has(file)) continue;
    if (!/useBackLayer\(/.test(src)) {
      bad.push(`${file}: рисует окно или портал, но не стоит на учёте «Назад» (useBackLayer) — «Назад» Android уйдёт со страницы или закроет приложение, а слой останется`);
    }
  }
  return { bad, layers };
}

function readAll() {
  const out = {};
  for (const f of repoFiles(["src"])) {
    if (!/\.(tsx|ts)$/.test(f)) continue;
    try {
      out[f] = readFileSync(f, "utf8");
    } catch {
      /* удалён в рабочем дереве */
    }
  }
  return out;
}

function main() {
  const files = readAll();
  if (process.argv.includes("--plant")) {
    let ok = judge(files).bad.length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие исходники`);
    const edit = (file, from, to) => {
      const next = files[file].replace(from, to);
      return next === files[file] ? null : { ...files, [file]: next };
    };
    const cases = [
      ["обработчик снова не знает про слои (как до 7.242)", edit(HANDLER, "if (closeTopBackLayer()) return;", ""), "не закрывает открытый слой"],
      ["закрытие слоя перенесено после history.back()", edit(HANDLER, /if \(closeTopBackLayer\(\)\) return;([\s\S]*?window\.history\.back\(\);)/, "$1\n      if (closeTopBackLayer()) return;"), "ПОСЛЕ history.back()"],
      ["меню «≡» снято с учёта", edit("src/components/MobileMenu.tsx", /useBackLayer\([^;]*;/, ""), "MobileMenu.tsx"],
      ["общий Modal (лист замка, поиск) снят с учёта", edit("src/components/ui/Modal.tsx", /useBackLayer\([^;]*;/, ""), "ui/Modal.tsx"],
      ["новое окно без учёта — перепись находит его сама", { ...files, "src/components/__plant__/NewSheet.tsx": 'export default function S(){return <div role="dialog" aria-modal="true" />}' }, "__plant__/NewSheet.tsx"],
      ["учёт закомментирован (класс 7.182)", edit("src/components/subscription/PaywallModal.tsx", /useBackLayer\(/, "// useBackLayer("), "PaywallModal.tsx"],
      ["хук перестал ставить слой", edit(HOOK, "return pushBackLayer(", "void pushBackLayer("), "хук не ставит"],
      ["НАСТОЯЩИЙ старый лист итога пазла: onClose={backToList} (как до 7.255)", edit("src/components/word-games/WordGamePlayer.tsx", "onClose={closeResult}", "onClose={backToList}"), "WordGamePlayer.tsx: <GameResultPanel onClose={backToList}>"],
      ["закрытие стрелкой уводит со страницы", edit("src/components/profile/DownloadsPanel.tsx", "onClose={() => setConfirmAll(false)}", "onClose={() => router.push(\"/es\")}"), "DownloadsPanel.tsx"],
    ];
    let caught = 0;
    for (const [name, patched, expect] of cases) {
      if (!patched) {
        console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name}`);
        ok = false;
        continue;
      }
      const hit = judge(patched).bad.some((m) => m.includes(expect));
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    ok &&= caught === cases.length;
    console.log(ok ? `check:native-back --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:native-back --plant — FAILED");
    return ok ? 0 : 1;
  }
  const { bad, layers } = judge(files);
  if (bad.length) {
    console.error("check:native-back — ОТКАЗ:");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(
    `check:native-back — «Назад» закрывает верхний слой до истории и выхода; окон и порталов в src/ ${layers}, ` +
      `на учёте ${layers - NOT_CLOSABLE.size}, не закрываемых человеком ${NOT_CLOSABLE.size} (с причиной). Контроль — --plant.`,
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
