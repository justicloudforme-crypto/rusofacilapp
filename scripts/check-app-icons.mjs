// Иконка приложения происходит от фирменного знака, и вернуть дефолт Capacitor молча нельзя.
//
// ПОЧЕМУ ЭТОТ ФАЙЛ СУЩЕСТВУЕТ. Долг 177 прожил в проекте от первого
// `npx cap add` до 13.09.2026 и не был виден НИ ОДНОЙ проверке. Все 24
// файла `mipmap-*` и единственная иконка iOS пришли одним коммитом
// `848c844` «Add Capacitor scaffolding» и с тех пор не менялись, тогда
// как `resources/icon.png` сменился дважды. Заметили это не сторожем и
// не глазами, а разбором СОБРАННОГО пакета — то есть случайно и поздно.
// Класс отказа здесь молчаливый по построению: картинка на месте,
// размеры правильные, сборка зелёная, а знак чужой.
//
// ЧТО ПРОВЕРЯЕТСЯ — ОБЕ СТОРОНЫ.
//
//  1. ПРОИСХОЖДЕНИЕ. Каждый из 25 файлов пересчитывается ЗАНОВО из
//     `resources/icon.png` тем же кодом, которым он собран
//     (`generate-app-icons.mjs`), и сличается с лежащим в репозитории
//     побайтово. Эталон не хранится рядом снимком: хранимый снимок —
//     это второй источник правды, который расходится с первым молча.
//     Всё, что нужно для пересчёта, — сам исходник, и он в репозитории.
//
//  2. ДЕФОЛТ CAPACITOR ПОИМЁННО. Отдельная, НЕ выводимая из первой
//     проверка: в углах `ic_launcher_foreground` не должно быть
//     `#3730a3` и `#d97706` — фиолетово-оранжевого градиента заготовки.
//     Она держится, даже если кто-то подменит и `resources/icon.png`
//     тоже: тогда первая проверка сойдётся, а эта — нет. Ровно этот
//     случай и был живым весь 2026 год.
//
//  3. ТРЕБОВАНИЕ APPLE. У иконки iOS не должно быть альфа-канала:
//     пакет с прозрачной иконкой App Store отвергает проверкой при
//     загрузке. Читается colorType записанного файла, а не намерение
//     генератора.
//
//  4. РАЗВОДКА АДАПТИВНОЙ ИКОНКИ. `mipmap-anydpi-v26/*.xml` обязаны
//     ссылаться на оба наших слоя и НЕ обязаны их инсетить: инсет на
//     фоне оставляет прозрачную кромку под круглой маской, а на
//     переднем слое дублирует уже запечённое безопасное поле.
//
//  5. БЕЗОПАСНАЯ ЗОНА, ЧИСЛОМ. Ни один непрозрачный пиксель переднего
//     слоя не лежит вне круга 66dp из 108. Проверяется по САМОМУ PNG,
//     а не по коду, который его собрал.
//
// ЧЕГО ЭТОТ СТОРОЖ НЕ УМЕЕТ, И ЭТО НАЗВАНО, А НЕ СПРЯТАНО: он читает
// ИСХОДНИКИ, а не собранный пакет. Ключа подписи в CI нет, APK там не
// собирается, и слой пакета закрыт отдельным замером из отчёта захода
// (`aapt2 dump badging` плюс сличение слоёв по пикселям). Третий раз
// подряд в этом проекте слой пакета опровергал слой исходника — помнить
// об этом здесь обязательно.
//
//   node scripts/check-app-icons.mjs          # гейт
//   node scripts/check-app-icons.mjs --plant  # позитивный контроль
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { decode, encode, readHeader } from "./store-assets/png-io.mjs";
import { buildIcons, DENSITIES, IOS_ICON, LAYER_DP, SAFE_CIRCLE_DP, SOURCE } from "./store-assets/generate-app-icons.mjs";

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const ANDROID_RES = "android/app/src/main/res";
const ANYDPI = ["ic_launcher.xml", "ic_launcher_round.xml"].map((f) =>
  path.join(ANDROID_RES, "mipmap-anydpi-v26", f),
);

/** Углы дефолтной заготовки Capacitor, замеренные в 7.190 по собранному
 *  пакету. Литералы, а не вычисление: смысл проверки в том, чтобы
 *  назвать чужую картинку по имени. */
const CAPACITOR_DEFAULT_CORNERS = ["#3730a3", "#d97706"];

const hex = (px) => "#" + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join("");

function corners(img) {
  const at = (x, y) => {
    const s = (y * img.width + x) * 4;
    return [img.data[s], img.data[s + 1], img.data[s + 2], img.data[s + 3]];
  };
  return [at(0, 0), at(img.width - 1, 0), at(0, img.height - 1), at(img.width - 1, img.height - 1)];
}

export function scan() {
  const failures = [];
  const notes = [];

  // 1. Происхождение: пересчёт из источника и побайтовое сличение.
  let expected;
  try {
    expected = buildIcons();
  } catch (e) {
    return { failures: [`${SOURCE}: пересчёт эталона не удался — ${e.message}`], notes, checked: 0 };
  }
  let same = 0;
  for (const [rel, want] of expected) {
    let got;
    try {
      got = readFileSync(rel);
    } catch {
      failures.push(`${rel}: файла нет, а он обязан быть собран из ${SOURCE}`);
      continue;
    }
    if (got.equals(want)) same++;
    else
      failures.push(
        `${rel}: не совпадает с пересчитанным из ${SOURCE} (${got.length} б против ${want.length} б). ` +
          `Пересоберите: npm run store:app-icons`,
      );
  }
  notes.push(`происхождение от ${SOURCE}: совпало ${same} из ${expected.size}`);

  // 2. Дефолт Capacitor поимённо — по каждому переднему слою.
  let checkedCorners = 0;
  for (const d of DENSITIES) {
    const rel = path.join(ANDROID_RES, d.dir, "ic_launcher_foreground.png");
    let img;
    try {
      img = decode(readFileSync(rel));
    } catch {
      continue; // о пропаже уже сказано выше
    }
    checkedCorners++;
    for (const px of corners(img)) {
      if (px[3] !== 0 && CAPACITOR_DEFAULT_CORNERS.includes(hex(px))) {
        failures.push(
          `${rel}: в углу ${hex(px)} — это дефолтная заготовка Capacitor (долг 177), а не фирменный знак`,
        );
      }
    }
  }
  // …и по самому источнику. Без этой строки подмена `resources/icon.png`
  // на дефолт Capacitor прошла бы молча: пересчёт сошёлся бы с ним же, а
  // в переднем слое углы прозрачны (фон выбит) и сравнивать было бы не с
  // чем. Проверка происхождения без проверки ИСТОЧНИКА — половина правила.
  try {
    const src = decode(readFileSync(SOURCE));
    for (const px of corners(src)) {
      if (CAPACITOR_DEFAULT_CORNERS.includes(hex(px))) {
        failures.push(`${SOURCE}: в углу ${hex(px)} — фирменный знак подменён дефолтом Capacitor (долг 177)`);
      }
    }
  } catch (e) {
    failures.push(`${SOURCE}: не читается — ${e.message}`);
  }

  const iosRel = path.join("ios/App/App/Assets.xcassets/AppIcon.appiconset", IOS_ICON.file);
  try {
    const img = decode(readFileSync(iosRel));
    for (const px of corners(img)) {
      if (CAPACITOR_DEFAULT_CORNERS.includes(hex(px))) {
        failures.push(`${iosRel}: в углу ${hex(px)} — дефолтная заготовка Capacitor (долг 177)`);
      }
    }
  } catch {
    /* о пропаже уже сказано выше */
  }
  notes.push(`углы против дефолта Capacitor: проверено слоёв ${checkedCorners} + iOS`);

  // 3. Требование Apple: у иконки App Store альфы быть не должно.
  try {
    const head = readHeader(readFileSync(iosRel));
    if (head.colorType !== 2) {
      failures.push(
        `${iosRel}: colorType ${head.colorType}, а Apple не принимает иконку с альфа-каналом — нужен 2 (RGB без альфы)`,
      );
    }
    if (head.width !== IOS_ICON.size || head.height !== IOS_ICON.size) {
      failures.push(`${iosRel}: ${head.width}×${head.height}, а App Store требует ${IOS_ICON.size}×${IOS_ICON.size}`);
    }
    notes.push(`iOS: ${head.width}×${head.height}, colorType ${head.colorType} (альфы нет)`);
  } catch (e) {
    failures.push(`${iosRel}: заголовок не читается — ${e.message}`);
  }

  // 4. Разводка адаптивной иконки.
  for (const rel of ANYDPI) {
    let xml;
    try {
      xml = readFileSync(rel, "utf-8");
    } catch {
      failures.push(`${rel}: файла нет, а без него Android 8+ не знает про наши слои`);
      continue;
    }
    // Комментарии снимаются, и это не мелочь: шапка этих файлов ОБЪЯСНЯЕТ,
    // почему инсета больше нет, и цитирует его дословно. Проверка «есть
    // ли слово в файле» ловила собственное объяснение — тот же класс, что
    // и сторож, зелёный на закомментированной строке (7.178, 7.181).
    const code = xml.replace(/<!--[\s\S]*?-->/g, "");
    for (const layer of ["ic_launcher_background", "ic_launcher_foreground"]) {
      if (!code.includes(`@mipmap/${layer}`)) failures.push(`${rel}: слой @mipmap/${layer} не подключён`);
    }
    if (/android:inset/.test(code)) {
      failures.push(
        `${rel}: остался android:inset. На фоне он открывает прозрачную кромку под круглой маской, ` +
          `на переднем слое дублирует безопасное поле, уже запечённое в PNG`,
      );
    }
  }
  notes.push(`разводка адаптивной иконки: файлов ${ANYDPI.length}`);

  // 5. Безопасная зона — по самому PNG.
  let worst = 0;
  for (const d of DENSITIES) {
    const rel = path.join(ANDROID_RES, d.dir, "ic_launcher_foreground.png");
    let img;
    try {
      img = decode(readFileSync(rel));
    } catch {
      continue;
    }
    if (img.width !== d.layer || img.height !== d.layer) {
      failures.push(`${rel}: ${img.width}×${img.height}, а слой адаптивной иконки этой плотности — ${d.layer}`);
      continue;
    }
    const limit = (img.width * SAFE_CIRCLE_DP) / LAYER_DP / 2;
    const cx = img.width / 2;
    const cy = img.height / 2;
    let maxR = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
        const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (r > maxR) maxR = r;
      }
    }
    const share = maxR / limit;
    if (share > worst) worst = share;
    if (maxR > limit) {
      failures.push(
        `${rel}: знак выходит за безопасную зону — дальняя точка ${maxR.toFixed(1)} px при пределе ${limit.toFixed(1)} px ` +
          `(круг ${SAFE_CIRCLE_DP}dp из ${LAYER_DP}dp). На круглой маске его срежет`,
      );
    }
  }
  notes.push(`безопасная зона: занято ${(worst * 100).toFixed(1)} % круга ${SAFE_CIRCLE_DP}dp`);

  return { failures, notes, checked: expected.size };
}

export function report(result) {
  for (const n of result.notes) console.log(`  ${n}`);
  for (const f of result.failures) console.log(`  ПРОВАЛ: ${f}`);
  const ok = result.failures.length === 0;
  console.log(ok ? `[check:app-icons] PASS — файлов ${result.checked}` : `[check:app-icons] FAIL — ${result.failures.length}`);
  return ok;
}

/** Подменяет файл на время одной подсадки и возвращает откат. */
function swapFile(rel, bytes) {
  const before = readFileSync(rel);
  writeFileSync(rel, bytes);
  return () => writeFileSync(rel, before);
}

function swapText(rel, from, to) {
  const before = readFileSync(rel, "utf-8");
  if (!before.includes(from)) throw new Error(`подсадка не нашла «${from}» в ${rel}`);
  writeFileSync(rel, before.replace(from, to));
  return () => writeFileSync(rel, before);
}

/** Заливка одним цветом того же размера, что и файл по пути. */
function solidLike(rel, rgba) {
  const img = decode(readFileSync(rel));
  const data = Buffer.alloc(img.width * img.height * 4);
  for (let i = 0; i < img.width * img.height; i++) {
    data[i * 4] = rgba[0];
    data[i * 4 + 1] = rgba[1];
    data[i * 4 + 2] = rgba[2];
    data[i * 4 + 3] = rgba[3];
  }
  return { width: img.width, height: img.height, data };
}

/**
 * Подделка дефолта Capacitor того же размера, что файл по пути: диагональ
 * от `#3730a3` к `#d97706` и светлое пятно в середине.
 *
 * Пятно тут обязательно, и это выяснилось подсадкой: РОВНАЯ заливка
 * знаком не является вовсе — пересчёт эталона на ней бросает «на
 * картинке нет ничего, кроме фона» и возвращает ОДНУ жалобу вместо
 * двадцати шести. Подсадка, падающая не на том месте, на котором должна,
 * — это не контроль, а совпадение.
 */
function capacitorDefaultLike(rel) {
  const { width, height } = decode(readFileSync(rel));
  const data = Buffer.alloc(width * height * 4);
  const from = [0x37, 0x30, 0xa3];
  const to = [0xd9, 0x77, 0x06];
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 5;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const t = (x / (width - 1) + y / (height - 1)) / 2;
      const star = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
      for (let k = 0; k < 3; k++) data[s + k] = star ? 0xff : Math.round(from[k] + (to[k] - from[k]) * t);
      data[s + 3] = 255;
    }
  }
  return { width, height, data };
}

function plantControls() {
  const fgXxxhdpi = path.join(ANDROID_RES, "mipmap-xxxhdpi/ic_launcher_foreground.png");
  const legacyMdpi = path.join(ANDROID_RES, "mipmap-mdpi/ic_launcher.png");
  const roundMdpi = path.join(ANDROID_RES, "mipmap-mdpi/ic_launcher_round.png");
  const iosRel = path.join("ios/App/App/Assets.xcassets/AppIcon.appiconset", IOS_ICON.file);

  const controls = [
    {
      name: "вернули дефолтный фиолетовый Capacitor в передний слой",
      plant: () => swapFile(fgXxxhdpi, encode(solidLike(fgXxxhdpi, [0x37, 0x30, 0xa3, 0xff]))),
      expect: (r) => r.failures.some((m) => m.includes("#3730a3") && m.includes("Capacitor")),
    },
    {
      name: "вернули дефолтный оранжевый Capacitor в иконку iOS",
      plant: () => swapFile(iosRel, encode(solidLike(iosRel, [0xd9, 0x77, 0x06, 0xff]), { alpha: false })),
      expect: (r) => r.failures.some((m) => m.includes(iosRel) && m.includes("#d97706")),
    },
    {
      name: "иконка iOS записана с альфа-каналом",
      plant: () => swapFile(iosRel, encode(decode(readFileSync(iosRel)))),
      expect: (r) => r.failures.some((m) => m.includes(iosRel) && m.includes("альфа")),
    },
    {
      name: "круглая иконка mdpi пропала (ровно тот файл, который 7.190 счёл выброшенным)",
      plant: () => {
        const before = readFileSync(roundMdpi);
        writeFileSync(roundMdpi, Buffer.alloc(0));
        return () => writeFileSync(roundMdpi, before);
      },
      expect: (r) => r.failures.some((m) => m.includes(roundMdpi)),
    },
    {
      name: "одну плотность собрали из чужой картинки",
      plant: () => swapFile(legacyMdpi, encode(solidLike(legacyMdpi, [0x11, 0x22, 0x33, 0xff]))),
      expect: (r) => r.failures.some((m) => m.includes(legacyMdpi) && m.includes("не совпадает")),
    },
    {
      name: "знак раздут за пределы безопасной зоны",
      plant: () => {
        const img = decode(readFileSync(fgXxxhdpi));
        const data = Buffer.from(img.data);
        // Непрозрачная точка в самом углу слоя — это заведомо вне круга.
        data[3] = 255;
        return swapFile(fgXxxhdpi, encode({ width: img.width, height: img.height, data }));
      },
      expect: (r) => r.failures.some((m) => m.includes("безопасную зону")),
    },
    {
      name: "инсет вернулся в разводку адаптивной иконки",
      plant: () =>
        swapText(
          ANYDPI[0],
          '<background android:drawable="@mipmap/ic_launcher_background" />',
          '<background><inset android:drawable="@mipmap/ic_launcher_background" android:inset="16.7%" /></background>',
        ),
      expect: (r) => r.failures.some((m) => m.includes("android:inset")),
    },
    {
      name: "подменён САМ источник — дефолт Capacitor выдан за фирменный знак",
      // Обратное направление правила: иконки остаются на месте и
      // согласованы между собой, а происхождение у них уже чужое. Первая
      // проверка при этом падает на всех 25 файлах, вторая — на источнике.
      plant: () => swapFile(SOURCE, encode(capacitorDefaultLike(SOURCE), { alpha: false })),
      expect: (r) =>
        r.failures.some((m) => m.startsWith(SOURCE) && m.includes("#3730a3")) &&
        r.failures.filter((m) => m.includes("не совпадает")).length === 25,
    },
    {
      name: "передний слой отвязан от адаптивной иконки",
      plant: () => swapText(ANYDPI[1], "@mipmap/ic_launcher_foreground", "@mipmap/ic_launcher_background"),
      expect: (r) => r.failures.some((m) => m.includes("ic_launcher_foreground") && m.includes("не подключён")),
    },
  ];

  let ok = true;
  for (const control of controls) {
    const undo = control.plant();
    let caught;
    try {
      caught = control.expect(scan());
    } finally {
      undo();
    }
    console.log(`  ${caught ? "поймано" : "ПРОПУЩЕНО"} — ${control.name}`);
    ok &&= caught;
  }
  const clean = scan().failures.length === 0;
  console.log(`  ${clean ? "чисто" : "ВСЁ ЕЩЁ ГРЯЗНО"} — после отката всех ${controls.length} подсадок`);
  ok &&= clean;
  const n = controls.length + 1;
  console.log(ok ? `check:app-icons --plant — ${n} из ${n}` : "check:app-icons --plant — FAILED");
  return ok;
}

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report(scan());
  process.exitCode = ok ? 0 : 1;
}
