// ОДИН КАРКАС БЕЗ СЕТИ НА САЙТ И НА ПРИЛОЖЕНИЕ (заход 7.228).
//
// Каркас живёт в `public/offline.html`: оттуда его берёт воркер
// (precache, см. `next.config.ts`) и оттуда же он должен попасть В ПАКЕТ
// приложения, потому что внутри оболочки воркер до навигации не
// доезжает вовсе (разбор — в шапке `OfflineShellWebViewClient.java`).
//
// Пакет собирает `npx cap sync android`, а тот копирует ровно `webDir`,
// то есть `capacitor-shell/`. Значит копия обязана лежать там. Копия —
// это всегда риск расхождения, поэтому здесь ровно два действия:
// скопировать и напечатать, что скопировано, а сличает файлы сторож
// `npm run check:offline-fallback` (он же стоит в verify и в CI).
//
//   node scripts/sync-offline-shell.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

export const SOURCE = "public/offline.html";
export const COPY = "capacitor-shell/offline.html";

/** Копия обязана быть ПОБАЙТОВО той же. Никакой приписки «это копия»
 *  сверху быть не может: комментарий ПЕРЕД `<!doctype html>` переводит
 *  документ в режим совместимости, и каркас поехал бы вёрсткой ровно
 *  там, где его только что и починили. Поэтому о копии знают сторож и
 *  PROGRESS.md, а не сам файл. */
export function copyFor(source) {
  return source;
}

export function main() {
  const source = readFileSync(SOURCE, "utf8");
  const copy = copyFor(source);
  writeFileSync(COPY, copy);
  const sha = createHash("sha256").update(copy).digest("hex").slice(0, 16);
  console.log(`sync:offline-shell — ${COPY} ← ${SOURCE} (${copy.length} Б, sha256 ${sha}…)`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith("sync-offline-shell.mjs")) {
  process.exitCode = main();
}
