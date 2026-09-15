#!/usr/bin/env node
/**
 * ЗАСТАВКА ПРИЛОЖЕНИЯ — из того же источника, что и иконка.
 *
 * ЗАЧЕМ (заход 7.197, замер владельца 15.09.2026). От нажатия на иконку
 * до первой картинки на POCO X6 Pro проходит 5,9 с, и всё это время
 * экран пустой и светлый: ни знака, ни фирменного фона, ни полосы
 * загрузки. Человек, открывший приложение впервые, читает это как
 * поломку.
 *
 * ПРИЧИНА У НЕЁ ДВЕ, И ОБЕ НАЗВАНЫ ФАЙЛОМ.
 *
 *   1. `android/app/src/main/res/values/styles.xml`: тема запуска
 *      `AppTheme.NoActionBarLaunch` ставила ровно одно свойство —
 *      `android:background="@drawable/splash"`. Начиная с Android 12
 *      системная заставка это свойство НЕ ЧИТАЕТ: она читает
 *      `windowSplashScreenBackground` и `windowSplashScreenAnimatedIcon`,
 *      а их в теме не было ни одного. Телефон владельца — Android 16.
 *
 *   2. Сами файлы `drawable…/splash.png` — ДЕФОЛТ CAPACITOR:
 *      фиолетово-оранжевый градиент с белой звездой, пришедший одним
 *      коммитом со скаффолдингом. Та же семья, что долг 177, только там
 *      это была иконка.
 *
 * ЧТО СОБИРАЕТ ЭТОТ ФАЙЛ.
 *
 *   * `drawable…/splash.png` — 26 файлов прежних размеров: фирменный фон
 *     и знак по центру. Они на пути только у Android 11 и старше (и у
 *     запасного пути плагина), но дефолт чужого бренда внутри пакета —
 *     это дефект сам по себе.
 *   * `drawable-…/splash_icon.png` — знак на ПРОЗРАЧНОМ поле для
 *     системной заставки Android 12+. Фон там красит тема, а не
 *     картинка; непрозрачная подложка дала бы квадрат внутри круглой
 *     маски системы.
 *
 * РАЗМЕР ЗНАКА НЕ ВЗЯТ НА ГЛАЗ. Системная заставка рисует значок в поле
 * 288dp и обрезает его круглой маской диаметром 192dp (документированные
 * числа Android). Поэтому знак вписывается в круг 192dp из 288 тем же
 * способом, что и передний слой адаптивной иконки: по САМОЙ ДАЛЬНЕЙ от
 * центра непрозрачной точке силуэта, с проверкой результата, а не по
 * формуле (почему именно так — см. `foregroundLayer` в
 * generate-app-icons.mjs, там это стоило двух прогонов).
 *
 *   node scripts/store-assets/generate-splash.mjs [--check]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { canvas, composite, encode, resize } from "./png-io.mjs";
import { readSource, silhouetteRadius } from "./generate-app-icons.mjs";

const ANDROID_RES = "android/app/src/main/res";

/** Поле значка системной заставки и диаметр круга, которым она его
 *  обрезает, в dp. Числа платформы, не наши. */
export const SPLASH_ICON_DP = 288;
export const SPLASH_ICON_SAFE_DP = 192;

/** Плотности для значка заставки: сторона поля 288dp в пикселях. */
export const ICON_DENSITIES = [
  { dir: "drawable-mdpi", side: 288 },
  { dir: "drawable-hdpi", side: 432 },
  { dir: "drawable-xhdpi", side: 576 },
  { dir: "drawable-xxhdpi", side: 864 },
  { dir: "drawable-xxxhdpi", side: 1152 },
];

/**
 * Полноэкранные заставки: те же каталоги и те же размеры, что лежат в
 * репозитории с самого скаффолдинга. Размер не выдумывается — менять его
 * незачем, меняется только содержимое.
 */
export const FULL_SCREEN = [
  ["drawable", 320, 480],
  ["drawable-night", 320, 240],
  ["drawable-land-ldpi", 320, 240],
  ["drawable-land-mdpi", 480, 320],
  ["drawable-land-hdpi", 800, 480],
  ["drawable-land-xhdpi", 1280, 720],
  ["drawable-land-xxhdpi", 1600, 960],
  ["drawable-land-xxxhdpi", 1920, 1280],
  ["drawable-land-night-ldpi", 320, 240],
  ["drawable-land-night-mdpi", 480, 320],
  ["drawable-land-night-hdpi", 800, 480],
  ["drawable-land-night-xhdpi", 1280, 720],
  ["drawable-land-night-xxhdpi", 1600, 960],
  ["drawable-land-night-xxxhdpi", 1920, 1280],
  ["drawable-port-ldpi", 240, 320],
  ["drawable-port-mdpi", 320, 480],
  ["drawable-port-hdpi", 480, 800],
  ["drawable-port-xhdpi", 720, 1280],
  ["drawable-port-xxhdpi", 960, 1600],
  ["drawable-port-xxxhdpi", 1280, 1920],
  ["drawable-port-night-ldpi", 240, 320],
  ["drawable-port-night-mdpi", 320, 480],
  ["drawable-port-night-hdpi", 480, 800],
  ["drawable-port-night-xhdpi", 720, 1280],
  ["drawable-port-night-xxhdpi", 960, 1600],
  ["drawable-port-night-xxxhdpi", 1280, 1920],
];

/** Знак на прозрачном поле `side`×`side`, вписанный в круг безопасной
 *  зоны. Подбор — шагом вниз с проверкой готового полотна, ровно как у
 *  переднего слоя иконки: расчётный масштаб даёт «ровно по границе», и
 *  сглаженная кромка после уменьшения уходит за неё на доли пикселя. */
export function iconOnTransparent(mark, bounds, maxRadius, side) {
  const limit = (side * SPLASH_ICON_SAFE_DP) / SPLASH_ICON_DP / 2;
  // Ресемплер в png-io.mjs только УМЕНЬШАЕТ, и это не ограничение, а
  // правило: растянутый растр — это мыло, которого на заставке видно
  // больше, чем где-либо ещё. Поэтому знак никогда не крупнее
  // исходника; на xxxhdpi он занимает меньше круга безопасной зоны, и
  // это печатается числом, а не умалчивается.
  let h = Math.min(bounds.height, Math.round((bounds.height * (limit - 1)) / maxRadius));
  for (; h > 0; h--) {
    const w = Math.max(1, Math.round((bounds.width * h) / bounds.height));
    const out = canvas(side, side);
    composite(out, resize(mark, w, h), Math.round((side - w) / 2), Math.round((side - h) / 2));
    if (silhouetteRadius(out) <= limit) return out;
  }
  throw new Error(`знак не удалось вписать в круг ${SPLASH_ICON_SAFE_DP}dp на поле ${side} px`);
}

/** Полноэкранная заставка: фирменный фон и знак по центру.
 *  Знак занимает треть КОРОТКОЙ стороны — на вытянутом экране мерить по
 *  длинной значило бы получить знак во весь экран в портрете. */
export function fullScreenSplash(mark, bounds, bg, width, height) {
  const out = canvas(width, height, [bg[0], bg[1], bg[2], 255]);
  const h = Math.min(bounds.height, Math.round(Math.min(width, height) / 3));
  const w = Math.max(1, Math.round((bounds.width * h) / bounds.height));
  composite(out, resize(mark, w, h), Math.round((width - w) / 2), Math.round((height - h) / 2));
  return out;
}

/** Все файлы заставки как пары «путь → байты PNG». Ничего не пишет:
 *  один и тот же эталон читают и генератор, и сторож. */
export function buildSplash(root = ".") {
  const { bg, bounds, mark, maxRadius } = readSource(root);
  const files = new Map();

  for (const [dir, width, height] of FULL_SCREEN) {
    files.set(path.join(ANDROID_RES, dir, "splash.png"), encode(fullScreenSplash(mark, bounds, bg, width, height)));
  }
  for (const { dir, side } of ICON_DENSITIES) {
    files.set(path.join(ANDROID_RES, dir, "splash_icon.png"), encode(iconOnTransparent(mark, bounds, maxRadius, side)));
  }
  return files;
}

/** Фон заставки — тот же, что у иконки, то есть фон `resources/icon.png`.
 *  Он же `theme_color` сайта (`src/app/manifest.ts`) и он же
 *  `backgroundColor` в `capacitor.config.ts`. Ни одного нового цвета. */
export function splashBackgroundHex(root = ".") {
  const { bg } = readSource(root);
  return "#" + bg.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function main() {
  const check = process.argv.includes("--check");
  const files = buildSplash();
  console.log(`фон заставки ${splashBackgroundHex()} — взят из фона resources/icon.png, нового цвета не заведено`);
  const big = ICON_DENSITIES[ICON_DENSITIES.length - 1];
  const { bounds, mark, maxRadius } = readSource();
  const icon = iconOnTransparent(mark, bounds, maxRadius, big.side);
  console.log(
    `значок системной заставки: поле ${SPLASH_ICON_DP}dp, круг ${SPLASH_ICON_SAFE_DP}dp; ` +
      `дальняя точка силуэта ${silhouetteRadius(icon).toFixed(1)} px при пределе ` +
      `${((big.side * SPLASH_ICON_SAFE_DP) / SPLASH_ICON_DP / 2).toFixed(1)} px (поле ${big.side} px)`,
  );

  let differing = 0;
  for (const [rel, buf] of files) {
    let same = false;
    try {
      same = readFileSync(rel).equals(buf);
    } catch {
      same = false;
    }
    if (!same) differing++;
    if (!check && !same) {
      // Каталоги плотностей для значка заставки в скаффолдинге Capacitor
      // не заводились вовсе — там есть только `drawable-port-*` и
      // `drawable-land-*`. Создаём их сами, иначе первый же прогон падает
      // на ENOENT, а `--check` отчитывается «разошлись 5 файлов» вместо
      // «каталога нет».
      mkdirSync(path.dirname(rel), { recursive: true });
      writeFileSync(rel, buf);
    }
    console.log(`${same ? "=" : check ? "≠" : "+"} ${rel}  ${buf.length} б`);
  }

  if (check && differing > 0) {
    console.error(
      `\n[splash] ПРОВАЛ: файлов, разошедшихся с эталоном из resources/icon.png: ${differing} из ${files.size}. ` +
        `Пересоберите их: npm run store:splash`,
    );
    process.exit(1);
  }
  console.log(`\nфайлов ${files.size}, ${check ? "совпало с эталоном все" : `перезаписано ${differing}`}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
