#!/usr/bin/env node
/**
 * Собирает ИКОНКИ САМОГО ПРИЛОЖЕНИЯ — Android и iOS — из одного
 * источника `resources/icon.png`.
 *
 * ЗАЧЕМ. Долг 177 (заход 7.190): у собранного приложения стояла
 * ДЕФОЛТНАЯ иконка Capacitor — фиолетово-оранжевый градиент со звездой
 * (`#3730a3` в левом верхнем углу, `#d97706` в правом нижнем). Все 24
 * файла `mipmap-*` и единственный файл `AppIcon.appiconset` пришли
 * одним коммитом `848c844` «Add Capacitor scaffolding» и с тех пор не
 * менялись ни разу, тогда как фирменный знак в `resources/icon.png`
 * успел смениться дважды. То есть человек видел в магазине одну
 * матрёшку, а на рабочем столе телефона — чужую звезду.
 *
 * ЧТО ЗДЕСЬ ВАЖНО ЗНАТЬ ПРО АДАПТИВНУЮ ИКОНКУ ANDROID. На экране
 * телефона стоит не `ic_launcher.png`, а склейка ДВУХ слоёв из
 * `mipmap-anydpi-v26/ic_launcher.xml`: фон и передний план, каждый
 * размером 108dp. Система накладывает на склейку маску прошивки — круг,
 * квадрат со скруглением, «каплю» — и срезает ВНЕШНИЕ 18dp с каждой
 * стороны, то есть треть поля. Знак, нарисованный «в обрез», на круглой
 * маске теряет бока; поэтому передний слой здесь — матрёшка на
 * прозрачном фоне, вписанная в круг безопасной зоны, а не заливка на
 * весь слой.
 *
 * Безопасная зона взята СТРОГОЙ: круг диаметром 66dp из 108 (маска
 * прошивки работает по 72dp, 66 — запас Google на «каплю» и на
 * нестандартные маски). Масштаб не выбран на глаз — он посчитан по
 * САМОМУ СИЛУЭТУ знака: берётся самая дальняя от центра непрозрачная
 * точка, и знак ужимается ровно настолько, чтобы она легла на границу
 * круга. Числа печатаются в отчёте прогона.
 *
 * Инструментов сверх имеющихся не добавлено: вся растеризация — в
 * `png-io.mjs` на `node:zlib` (почему не `sharp` — сказано там же и в
 * `png-rgba.mjs`). Chromium сознательно не используется: его
 * растеризация зависит от версии, а сторож `check:app-icons` обязан
 * пересчитывать эталон сам и получать тот же байт на любой машине.
 *
 *   node scripts/store-assets/generate-app-icons.mjs [--check]
 *
 * `--check` ничего не пишет, а только сличает уже лежащие в репозитории
 * файлы с пересчитанным эталоном. Этим и живёт сторож.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { canvas, composite, circleMask, crop, decode, encode, flatten, keyOutBackground, markBounds, resize } from "./png-io.mjs";

export const SOURCE = "resources/icon.png";

const ANDROID_RES = "android/app/src/main/res";
const IOS_ICONSET = "ios/App/App/Assets.xcassets/AppIcon.appiconset";

/** Плотности Android и размеры обоих семейств иконок в пикселях.
 *  Первое число — устаревшая квадратная/круглая иконка (48dp), второе —
 *  слой адаптивной иконки (108dp). Множители плотности: 0,75 / 1 / 1,5 /
 *  2 / 3 / 4. */
export const DENSITIES = [
  { dir: "mipmap-ldpi", legacy: 36, layer: 81 },
  { dir: "mipmap-mdpi", legacy: 48, layer: 108 },
  { dir: "mipmap-hdpi", legacy: 72, layer: 162 },
  { dir: "mipmap-xhdpi", legacy: 96, layer: 216 },
  { dir: "mipmap-xxhdpi", legacy: 144, layer: 324 },
  { dir: "mipmap-xxxhdpi", legacy: 192, layer: 432 },
];

/** Диаметр строгой безопасной зоны в dp на слое 108dp. */
export const SAFE_CIRCLE_DP = 66;
export const LAYER_DP = 108;

/** Единственная иконка приложения iOS: 1024×1024 без альфы. */
export const IOS_ICON = { file: "AppIcon-512@2x.png", size: 1024 };

/** Читает источник и раскладывает его на то, из чего собираются все иконки. */
export function readSource(root = ".") {
  const src = decode(readFileSync(path.join(root, SOURCE)));
  if (src.width !== src.height) throw new Error(`${SOURCE}: ожидался квадрат, получено ${src.width}×${src.height}`);
  const bg = [src.data[0], src.data[1], src.data[2]];
  const bounds = markBounds(src, bg);
  // Знак без фона: фон становится прозрачным, сглаженная кромка остаётся
  // как есть — она ляжет на фоновый слой ТОГО ЖЕ цвета и сойдётся с
  // исходником точно (подробности в png-io.mjs).
  const mark = crop(keyOutBackground(src, bg), bounds.x0, bounds.y0, bounds.width, bounds.height);

  // Самая дальняя непрозрачная точка от центра рамки знака — по ней и
  // считается масштаб, а не по углам рамки: у матрёшки углы пустые, и
  // мерить по ним значило бы ужать знак сильнее, чем требует маска.
  const cx = bounds.width / 2;
  const cy = bounds.height / 2;
  let maxRadius = 0;
  for (let y = 0; y < mark.height; y++) {
    for (let x = 0; x < mark.width; x++) {
      if (mark.data[(y * mark.width + x) * 4 + 3] === 0) continue;
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (r > maxRadius) maxRadius = r;
    }
  }
  return { src, bg, bounds, mark, maxRadius };
}

/** Радиус строгой безопасной зоны в пикселях на слое стороной `layer`. */
export const safeRadius = (layer) => (layer * SAFE_CIRCLE_DP) / LAYER_DP / 2;

/** Дальняя от центра непрозрачная точка картинки, в пикселях. */
export function silhouetteRadius(img) {
  const cx = img.width / 2;
  const cy = img.height / 2;
  let max = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (r > max) max = r;
    }
  }
  return max;
}

/**
 * Передний слой адаптивной иконки: знак на прозрачном поле, вписанный в
 * круг безопасной зоны.
 *
 * Размер НЕ берётся формулой и НЕ берётся на глаз — он подбирается и
 * ПРОВЕРЯЕТСЯ по готовому полотну, шагом в один пиксель вниз. Это стоило
 * двух прогонов сторожа, и причина того стоит: после уменьшения кромка
 * получает частичную альфу и уходит примерно на полпикселя дальше
 * идеального силуэта, а центрирование округляется ещё на полпикселя.
 * Расчётный масштаб давал «ровно по границе», и знак вылезал за круг на
 * 0,2…1 px то на трёх плотностях, то на всех шести — в зависимости от
 * того, куда легло округление. «Вписан по формуле» и «вписан» — разные
 * утверждения, и второе проверяется только замером результата.
 */
export function foregroundLayer(mark, bounds, maxRadius, layer) {
  const limit = safeRadius(layer);
  let h = Math.round((bounds.height * (limit - 1)) / maxRadius);
  for (; h > 0; h--) {
    const w = Math.max(1, Math.round((bounds.width * h) / bounds.height));
    const out = canvas(layer, layer);
    composite(out, resize(mark, w, h), Math.round((layer - w) / 2), Math.round((layer - h) / 2));
    if (silhouetteRadius(out) <= limit) return out;
  }
  throw new Error(`знак не удалось вписать в круг ${SAFE_CIRCLE_DP}dp на слое ${layer} px`);
}

/**
 * Все файлы иконок как пары «путь → байты PNG». Ничего не пишет на диск:
 * тем же вызовом пользуется и генератор, и сторож, поэтому эталон у них
 * ровно один, а не два похожих.
 */
export function buildIcons(root = ".") {
  const { src, bg, bounds, mark, maxRadius } = readSource(root);
  const files = new Map();

  for (const d of DENSITIES) {
    // Устаревшие иконки (до Android 8) — знак «в обрез», как в источнике:
    // маски там нет, поле режет сама прошивка иконкой ярлыка.
    const square = resize(src, d.legacy, d.legacy);
    files.set(path.join(ANDROID_RES, d.dir, "ic_launcher.png"), encode(square));
    files.set(path.join(ANDROID_RES, d.dir, "ic_launcher_round.png"), encode(circleMask(square)));

    // Фоновый слой адаптивной иконки: ровная заливка фирменным синим на
    // ВЕСЬ слой. Не инсет и не скругление — то и другое рисует маска
    // прошивки, а подложка обязана доходить до края, иначе на круглой
    // маске по кромке видна прозрачность.
    files.set(
      path.join(ANDROID_RES, d.dir, "ic_launcher_background.png"),
      encode(canvas(d.layer, d.layer, [bg[0], bg[1], bg[2], 255])),
    );

    // Передний слой: матрёшка на прозрачном, вписанная в круг 66dp.
    files.set(
      path.join(ANDROID_RES, d.dir, "ic_launcher_foreground.png"),
      encode(foregroundLayer(mark, bounds, maxRadius, d.layer)),
    );
  }

  // iOS. Альфа-канала быть не должно: пакет с прозрачной иконкой App
  // Store отвергает проверкой при загрузке, а не замечанием ревьюера.
  // Поэтому картинка сводится на непрозрачный фон и пишется colorType 2.
  files.set(
    path.join(IOS_ICONSET, IOS_ICON.file),
    encode(flatten(resize(src, IOS_ICON.size, IOS_ICON.size), bg), { alpha: false }),
  );

  return files;
}

export const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function main() {
  const check = process.argv.includes("--check");
  const { src, bounds, maxRadius, bg } = readSource();
  const files = buildIcons();

  const hex = "#" + bg.map((v) => v.toString(16).padStart(2, "0")).join("");
  const side = src.width;
  console.log(
    `источник ${SOURCE}: ${side}×${side}, фон ${hex}, рамка знака ${bounds.width}×${bounds.height} px — ` +
      `${((100 * bounds.width) / side).toFixed(1)} % ширины поля и ${((100 * bounds.height) / side).toFixed(1)} % высоты`,
  );
  const big = DENSITIES[DENSITIES.length - 1];
  const layer = foregroundLayer(readSource().mark, bounds, maxRadius, big.layer);
  let bx0 = layer.width;
  let by0 = layer.height;
  let bx1 = -1;
  let by1 = -1;
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      if (layer.data[(y * layer.width + x) * 4 + 3] === 0) continue;
      if (x < bx0) bx0 = x;
      if (y < by0) by0 = y;
      if (x > bx1) bx1 = x;
      if (y > by1) by1 = y;
    }
  }
  const box = { width: bx1 - bx0 + 1, height: by1 - by0 + 1 };
  console.log(
    `безопасная зона: круг ${SAFE_CIRCLE_DP}dp из ${LAYER_DP}dp; дальняя точка силуэта ${silhouetteRadius(layer).toFixed(1)} px ` +
      `при пределе ${safeRadius(big.layer).toFixed(1)} px (слой ${big.layer} px). ` +
      `На слое знак занимает ${((100 * box.height) / big.layer).toFixed(1)} % высоты и ${((100 * box.width) / big.layer).toFixed(1)} % ширины`,
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
    if (!check && !same) writeFileSync(rel, buf);
    console.log(`${same ? "=" : check ? "≠" : "+"} ${rel}  ${buf.length} б`);
  }

  if (check && differing > 0) {
    console.error(
      `\n[app-icons] ПРОВАЛ: файлов, разошедшихся с эталоном из ${SOURCE}: ${differing} из ${files.size}. ` +
        `Пересоберите их: npm run store:app-icons`,
    );
    process.exit(1);
  }
  console.log(`\nфайлов ${files.size}, ${check ? "совпало с эталоном все" : `перезаписано ${differing}`}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
