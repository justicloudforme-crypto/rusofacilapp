/**
 * СНИМКИ ЭКРАНА ДЛЯ КАРТОЧКИ УСТАНОВКИ — ДОЛГ 83 (заход 7.217).
 *
 * Chrome показывает расширенную карточку установки PWA только тогда, когда
 * в манифесте есть `screenshots` И среди них есть обе формы — `narrow` и
 * `wide`. Без них карточка выглядит обрезанной; ровно это и записано в
 * строке долга.
 *
 * СНИМАЕТСЯ ЖИВОЙ ПРОДАКШН, а не макет и не рисунок: карточка обещает
 * человеку то, что он увидит, и рисованный снимок — обещание, которого
 * никто не проверял. Запрос один на форму, только GET.
 *
 * Размеры зашиты и совпадают с объявленными в `src/lib/pwa-manifest.ts`;
 * расхождение ловит `check:pwa-manifest`, который читает сами файлы.
 *
 *   node scripts/build-pwa-screenshots.mjs
 *   node scripts/build-pwa-screenshots.mjs --base=http://localhost:3123
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = arg("base", "https://rusofacilapp.com").replace(/\/$/, "");
const OUT = join(process.cwd(), "public", "screenshots");

export const SHOTS = [
  { file: "home-narrow.png", path: "/es", width: 390, height: 844 },
  { file: "home-wide.png", path: "/es", width: 1280, height: 800 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      const context = await browser.newContext({
        viewport: { width: shot.width, height: shot.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.goto(`${BASE}${shot.path}`, { waitUntil: "load", timeout: 60_000 });
      // Гидрация: до неё страница нарисована, но органы управления ещё
      // приглушены (см. HydrationMarker и globals.css) — снимок вышел бы
      // с серыми кнопками.
      await page
        .waitForFunction(() => !document.documentElement.hasAttribute("data-hydrating"), null, { timeout: 30_000 })
        .catch(() => {});
      await page.screenshot({ path: join(OUT, shot.file), fullPage: false });
      console.log(`  снят ${shot.file} — ${shot.width}×${shot.height} с ${BASE}${shot.path}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`store:screenshots — снимков ${SHOTS.length}, каталог public/screenshots`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
