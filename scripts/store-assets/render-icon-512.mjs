#!/usr/bin/env node
/**
 * Снимает `icon-512.html` в иконку витрины Google Play.
 *
 * 512×512, PNG 32-bit с альфа-каналом — так требует Play. Одним снимком
 * это НЕ получается: Chromium выбрасывает альфу, когда все пиксели
 * непрозрачны, и пишет 24-битный RGB. Поэтому снимок прогоняется через
 * `png-rgba.mjs`, который дописывает канал на `node:zlib`, без внешних
 * библиотек (почему не `sharp` — сказано там же). Итог проверяется
 * чтением IHDR, а не доверием: colorType обязан быть 6.
 *
 *   node scripts/store-assets/render-icon-512.mjs [--out=DIR]
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

import { toRgba } from "./png-rgba.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  }),
);
const OUT = args.get("out") ?? path.join(process.env.HOME, "Desktop/rusofacil-store-assets");
const SIZE = { width: 512, height: 512 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(HERE, "icon-512.html")).href, { waitUntil: "networkidle" });
await page.waitForTimeout(200);

await mkdir(OUT, { recursive: true });
const out = path.join(OUT, "play-icon-512.png");
await page.screenshot({ path: out, omitBackground: false, clip: { x: 0, y: 0, ...SIZE } });
await browser.close();

const { png, converted, width, height } = toRgba(await readFile(out));
await writeFile(out, png);

// Позитивный контроль на самого себя: читаем заголовок записанного файла
// и падаем, если он не тот, — иначе «готово» ничего не значит.
const head = png.subarray(16, 29);
const colorType = head[9];
if (head.readUInt32BE(0) !== SIZE.width || head.readUInt32BE(4) !== SIZE.height || head[8] !== 8 || colorType !== 6) {
  throw new Error(`получился не 512×512 PNG-32: ${head.readUInt32BE(0)}×${head.readUInt32BE(4)}, depth ${head[8]}, colorType ${colorType}`);
}

const s = await stat(out);
console.log(
  `${path.basename(out)}  ${width}×${height}  png 8 бит, colorType 6 (RGBA, 32-bit)  альфа дописана: ${converted ? "да" : "не потребовалось"}  ${s.size} байт`,
);
