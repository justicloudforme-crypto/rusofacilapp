#!/usr/bin/env node
/**
 * Снимает `feature-graphic.html` в баннер витрины Google Play.
 *
 * Ровно 1024×500, deviceScaleFactor 1 — шаблон уже свёрстан в целевых
 * пикселях, масштабировать нечего. Формат — JPEG, и это не вкус: Play
 * принимает у баннера JPEG или 24-битный PNG, то есть картинку БЕЗ
 * альфа-канала, а Playwright пишет PNG только 32-битным (RGBA). JPEG у
 * него альфы не имеет по устройству формата, поэтому требование
 * выполняется самим выбором формата, а не постобработкой в чужой
 * библиотеке. `chromaSubsampling` не трогаем: качество 92 на плашечных
 * цветах и крупном тексте артефактов не даёт (проверено глазами).
 *
 *   node scripts/store-assets/render-feature-graphic.mjs [--out=DIR]
 */
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  }),
);
const OUT = args.get("out") ?? path.join(process.env.HOME, "Desktop/rusofacil-store-assets");
const SIZE = { width: 1024, height: 500 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(HERE, "feature-graphic.html")).href, {
  waitUntil: "networkidle",
});
await page.waitForTimeout(300);

await mkdir(OUT, { recursive: true });
const out = path.join(OUT, "play-feature-graphic-1024x500.jpg");
await page.screenshot({
  path: out,
  type: "jpeg",
  quality: 92,
  omitBackground: false,
  clip: { x: 0, y: 0, ...SIZE },
});
await browser.close();

const s = await stat(out);
console.log(`${path.basename(out)}  ${SIZE.width}×${SIZE.height}  jpeg (без альфы)  ${s.size} байт`);
