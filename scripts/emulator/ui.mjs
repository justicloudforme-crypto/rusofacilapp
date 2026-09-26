#!/usr/bin/env node
// Нажатие по тексту на экране эмулятора — не вслепую, а по координатам из
// `uiautomator dump`. Заход 7.234.
//
//   node scripts/emulator/ui.mjs list [фильтр]     # все узлы с текстом и их рамки
//   node scripts/emulator/ui.mjs find <регулярка>  # первый узел: центр x y
//   node scripts/emulator/ui.mjs tap <регулярка>   # найти и нажать
//
// Регулярка ищется в `text` и `content-desc` без учёта регистра. Содержимое
// WebView попадает в дамп через дерево доступности, поэтому кнопки сайта
// («Descargar», «Guardado») находятся так же, как нативные.
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const sdk = process.env.ANDROID_HOME || join(homedir(), "Library/Android/sdk");
const adb = join(sdk, "platform-tools/adb");
const run = (args) => execFileSync(adb, args, { encoding: "utf8" });

function dump() {
  run(["shell", "uiautomator", "dump", "/sdcard/rf-ui.xml"]);
  return run(["exec-out", "cat", "/sdcard/rf-ui.xml"]);
}

function nodes(xml) {
  const out = [];
  for (const m of xml.matchAll(/<node\b[^>]*>/g)) {
    const tag = m[0];
    const attr = (name) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1] || "";
    const b = attr("bounds").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!b) continue;
    const [x1, y1, x2, y2] = b.slice(1).map(Number);
    const label = [attr("text"), attr("content-desc")].filter(Boolean).join(" | ");
    out.push({ label, clickable: attr("clickable") === "true", x1, y1, x2, y2,
      cx: Math.round((x1 + x2) / 2), cy: Math.round((y1 + y2) / 2) });
  }
  return out;
}

// Сразу после холодного старта дерево доступности WebView бывает ещё пустым
// (замечено на каркасе без сети, 7.234) — дамп повторяется, пока в нём не
// появится хоть один узел с текстом.
function labelled() {
  for (let attempt = 1; ; attempt++) {
    const found = nodes(dump()).filter((n) => n.label && n.x2 > n.x1 && n.y2 > n.y1);
    if (found.length > 0 || attempt >= 4) return found;
    execFileSync("sleep", ["1.5"]);
  }
}

const [mode, pattern = ""] = process.argv.slice(2);
const all = labelled();
const re = new RegExp(pattern, "i");

if (mode === "list") {
  for (const n of all.filter((n) => re.test(n.label))) {
    console.log(`${n.cx}\t${n.cy}\t${n.clickable ? "click" : "-"}\t${n.label}`);
  }
} else if (mode === "find" || mode === "tap") {
  const hit = all.find((n) => re.test(n.label));
  if (!hit) {
    console.error(`на экране нет узла /${pattern}/i (узлов с текстом: ${all.length})`);
    process.exit(1);
  }
  console.log(`${hit.cx} ${hit.cy}\t${hit.label}`);
  if (mode === "tap") run(["shell", "input", "tap", String(hit.cx), String(hit.cy)]);
} else {
  console.error("ui.mjs list|find|tap <регулярка>");
  process.exit(2);
}
