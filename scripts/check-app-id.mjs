// Одна личность нативной сборки, во всех местах, где она объявлена.
//
// ПОЧЕМУ ЭТО СУЩЕСТВУЕТ. 08.09.2026 замер окна C нашёл расхождение внутри
// репозитория: `applicationId` в Gradle и `PRODUCT_BUNDLE_IDENTIFIER` в
// Xcode говорили `com.rusofasil.app` — старое написание бренда, — а
// `capacitor.config.ts`, три `productID` в StoreKit, `docs/store-listings.md`
// и `MOBILE.md` говорили `com.rusofacilapp.app`. Побеждают в собранном
// приложении первые два: `cap sync` кладёт свой `appId` только в
// генерируемые `capacitor.config.json` (оба под `.gitignore`) и проектных
// файлов НЕ переписывает. То есть собранная в тот день сборка уехала бы
// под старым идентификатором — а он после первой публикации в App Store
// или Google Play не меняется НИКОГДА: это долг 70.
//
// ПОЧЕМУ ЭТОГО НЕ ЛОВИТ `check:brand`. Тот сторож регистрозависим и
// намеренно не смотрит на строчное `rusofasil`: оно объявлено адресом, а
// не именем, — вместе с ключами `localStorage` и телеграм-хэндлами
// (`scripts/check-brand-name.mjs`, шапка). Решение верное: переименование
// ключей выбросило бы прогресс людей. Следствие — у идентификатора сборки
// не было НИ ОДНОГО сторожа, и это записано в PROGRESS.md как «долг 70
// слеп по построению». Этот файл закрывает ровно ту дыру, и закрывает её
// отдельной проверкой, а не расширением регулярки бренда.
//
// ЧТО ПРОВЕРЯЕТСЯ. Значение ниже пришпилено литералом, а не вычитано из
// какого-то одного файла: если бы канон брался из `capacitor.config.ts`,
// правка ЭТОГО файла молча увела бы за собой всю проверку. Каждое место,
// где личность объявлена, обязано дать ровно его:
//
//   1. `capacitor.config.ts`            — `appId`
//   2. `android/app/build.gradle`       — `namespace`, `applicationId`
//   3. `android/.../values/strings.xml` — `package_name`, `custom_url_scheme`
//   4. `.../java/<путь>/MainActivity.java` — оператор `package` И САМ ПУТЬ
//      каталога (каталог обязан совпадать с пакетом, иначе Gradle не
//      соберёт; правка одной строки без переезда каталога — обычная
//      половинчатая правка, и она здесь падает)
//   5. `ios/App/App.xcodeproj/project.pbxproj` — все `PRODUCT_BUNDLE_IDENTIFIER`
//   6. `ios/App/App/*.storekit`         — каждый `productID` с префиксом
//   7. `docs/store-listings.md`, `MOBILE.md` — то, что уедет в консоли
//
// И сверх поимённого списка — сплошной проход по ОТСЛЕЖИВАЕМЫМ файлам
// нативной поверхности: любое похожее на наш reverse-domain написание,
// не равное канону и не являющееся его продолжением, — падение. Именно
// сплошной проход ловит место, которого в списке выше ещё нет.
//
// СТОРОЖ СМОТРИТ ТОЛЬКО НА ОТСЛЕЖИВАЕМЫЕ ФАЙЛЫ (`git ls-files`). Правило
// оплачено на PR #226: локальный прогон `check:brand` был зелёным, пока
// новый файл не попал в индекс. Прогон до `git add` про новый файл не
// говорит ничего.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

/** Личность приложения. После первой публикации не меняется никогда —
 *  Apple и Google идентификатор изменить не дают, только новое
 *  приложение с нуля. Выбран он не здесь: так уже говорят
 *  `capacitor.config.ts`, три `productID` в StoreKit, `MOBILE.md` и
 *  `docs/store-listings.md`, и он же — reverse-domain реально купленного
 *  rusofacilapp.com. */
const APP_ID = "com.rusofacilapp.app";

/** Похожее на нашу личность написание — то, что сплошной проход обязан
 *  либо признать каноном, либо назвать ошибкой. Строчное и без якорей:
 *  ловит и `com.rusofasil.app`, и `com.rusofacil.app`, и опечатку. */
const LOOKALIKE = /com\.rusof[a-z0-9]*(?:\.[a-z0-9]+)+/g;

/** Нативная поверхность: где личность вообще может быть объявлена. */
const NATIVE_SURFACE = (f) =>
  f.startsWith("android/") || f.startsWith("ios/") || f === "capacitor.config.ts";

function tracked() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

function read(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : null;
}

/** Номер строки по смещению в тексте — чтобы отчёт указывал на место. */
function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

/** Все объявления личности, каждое со своим именем и местом. */
function declarations(files) {
  const found = [];
  const miss = [];
  const add = (file, what, value, text, index) =>
    found.push({ file, what, value, line: text ? lineAt(text, index) : 0 });

  /** Одно объявление по регулярке с одной группой. Отсутствие места, где
   *  личность ОБЯЗАНА стоять, — такое же падение, как неверное значение:
   *  исчезнувший `applicationId` собирается под именем пакета Gradle и
   *  тоже уезжает не туда. */
  const one = (file, what, re, { all = false } = {}) => {
    const text = read(file);
    if (text === null) {
      miss.push(`${file} — файла нет, а личность объявлена в нём`);
      return;
    }
    const hits = [...text.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))];
    if (hits.length === 0) {
      miss.push(`${file} — не найдено объявление «${what}» (регулярка ${re})`);
      return;
    }
    for (const h of all ? hits : hits.slice(0, 1)) add(file, what, h[1], text, h.index);
    if (!all && hits.length > 1) {
      for (const h of hits.slice(1)) add(file, `${what} (повтор)`, h[1], text, h.index);
    }
  };

  one("capacitor.config.ts", "appId", /appId:\s*"([^"]+)"/);
  one("android/app/build.gradle", "namespace", /namespace\s*=\s*"([^"]+)"/);
  one("android/app/build.gradle", "applicationId", /applicationId\s+"([^"]+)"/);
  one("android/app/src/main/res/values/strings.xml", "package_name", /<string name="package_name">([^<]+)<\/string>/);
  one("android/app/src/main/res/values/strings.xml", "custom_url_scheme", /<string name="custom_url_scheme">([^<]+)<\/string>/);
  one("ios/App/App.xcodeproj/project.pbxproj", "PRODUCT_BUNDLE_IDENTIFIER", /PRODUCT_BUNDLE_IDENTIFIER = ([^;\s]+);/, { all: true });
  one("docs/store-listings.md", "Bundle ID / Package name", /Bundle ID \/ Package name \| `([^`]+)`/);
  one("MOBILE.md", "объявленный appId", /Установлен как `([^`]+)`/);

  // Java-пакет: строка И каталог. Файл ищется среди отслеживаемых, а не
  // по угаданному пути, — иначе переезд каталога сделал бы проверку
  // «файла нет», то есть зелёной по недосмотру.
  const activities = files.filter((f) => f.endsWith("/MainActivity.java"));
  if (activities.length !== 1) {
    miss.push(
      `MainActivity.java найдено ${activities.length} шт. (${activities.join(", ") || "ни одного"}), ожидалось ровно 1 — ` +
        `забытая копия в старом каталоге пакета собирается вместе с новой`,
    );
  }
  for (const file of activities) {
    const text = read(file);
    const m = text.match(/^\s*package\s+([\w.]+);/m);
    if (!m) miss.push(`${file} — нет оператора package`);
    else add(file, "оператор package", m[1], text, m.index);
    const dir = file.match(/java\/(.+)\/MainActivity\.java$/);
    if (!dir) miss.push(`${file} — путь не лежит под .../java/`);
    else add(file, "каталог пакета (путь файла)", dir[1].replaceAll("/", "."), null, 0);
  }

  return { found, miss };
}

/** `productID` в StoreKit — не сама личность, а её продолжение: Apple
 *  требует, чтобы идентификатор покупки начинался с bundle id. Отдельная
 *  проверка, потому что правило другое — префикс, а не равенство. */
function storekitPrefixes(files) {
  const failures = [];
  const kits = files.filter((f) => f.endsWith(".storekit"));
  if (kits.length === 0) failures.push("ios/App/App/*.storekit — ни одного файла, а покупки объявлены в нём");
  let ids = 0;
  for (const file of kits) {
    const text = read(file);
    for (const m of text.matchAll(/"productID"\s*:\s*"([^"]+)"/g)) {
      ids++;
      if (m[1].startsWith(APP_ID + ".")) continue;
      failures.push(
        `${file}:${lineAt(text, m.index)}  productID «${m[1]}» не начинается с «${APP_ID}.» — ` +
          `App Store Connect такой идентификатор покупки не примет`,
      );
    }
  }
  if (kits.length && ids === 0) failures.push(`${kits.join(", ")} — ни одного productID`);
  return { failures, ids, kits: kits.length };
}

/** Сплошной проход: похожее написание где угодно на нативной поверхности. */
function strays(files) {
  const failures = [];
  let scanned = 0;
  let hits = 0;
  for (const file of files.filter(NATIVE_SURFACE)) {
    const text = read(file);
    if (text === null || text.includes("\0")) continue;
    scanned++;
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(LOOKALIKE)) {
        hits++;
        if (m[0] === APP_ID || m[0].startsWith(APP_ID + ".")) continue;
        failures.push(
          `${file}:${i + 1}  «${m[0]}» — ожидалось «${APP_ID}»\n      ${line.trim().slice(0, 120)}`,
        );
      }
    });
  }
  return { failures, scanned, hits };
}

function scan() {
  const files = tracked();
  const { found, miss } = declarations(files);
  const failures = [...miss];
  for (const d of found) {
    if (d.value === APP_ID) continue;
    failures.push(
      `${d.file}${d.line ? ":" + d.line : ""}  ${d.what} = «${d.value}» — ожидалось «${APP_ID}»`,
    );
  }
  const kit = storekitPrefixes(files);
  failures.push(...kit.failures);
  const stray = strays(files);
  failures.push(...stray.failures);
  return { failures, declared: found.length, kitIds: kit.ids, strayScanned: stray.scanned, strayHits: stray.hits };
}

function report(r) {
  if (r.failures.length) {
    console.error("check:app-id — FAILED\n");
    for (const f of r.failures) console.error(`  ${f}\n`);
    console.error(
      `Личность приложения обязана быть одна и та же везде: «${APP_ID}». ` +
        `После первой публикации она не меняется никогда.`,
    );
    return false;
  }
  console.log(
    `check:app-id — одна личность везде: «${APP_ID}». ` +
      `${r.declared} объявлений сошлись, ${r.kitIds} productID несут её префиксом, ` +
      `сплошной проход по ${r.strayScanned} отслеживаемым файлам нативной поверхности: ` +
      `${r.strayHits} похожих написаний, все каноничные.`,
  );
  return true;
}

// `--plant` — позитивный контроль. Проверка, которую никто не видел
// красной, ничего не доказывает: каждая подсадка ниже — это ровно та
// половинчатая правка, из-за которой долг 70 и появился.
function plantControls() {
  const swap = (file, from, to) => {
    const before = read(file);
    if (before === null || !before.includes(from)) {
      throw new Error(`подсадка не легла: в ${file} нет «${from}»`);
    }
    writeFileSync(file, before.replace(from, to));
    return () => writeFileSync(file, before);
  };

  const WRONG = "com.rusofasil.app";
  const controls = [
    {
      name: "Gradle applicationId уехал на старое написание",
      plant: () => swap("android/app/build.gradle", `applicationId "${APP_ID}"`, `applicationId "${WRONG}"`),
      expect: (r) => r.failures.some((m) => m.startsWith("android/app/build.gradle") && m.includes("applicationId")),
    },
    {
      name: "Xcode PRODUCT_BUNDLE_IDENTIFIER уехал (только одна из двух конфигураций)",
      plant: () =>
        swap(
          "ios/App/App.xcodeproj/project.pbxproj",
          `PRODUCT_BUNDLE_IDENTIFIER = ${APP_ID};`,
          `PRODUCT_BUNDLE_IDENTIFIER = ${WRONG};`,
        ),
      expect: (r) => r.failures.some((m) => m.includes("PRODUCT_BUNDLE_IDENTIFIER")),
    },
    {
      name: "strings.xml package_name разошёлся с остальными",
      plant: () =>
        swap(
          "android/app/src/main/res/values/strings.xml",
          `<string name="package_name">${APP_ID}</string>`,
          `<string name="package_name">${WRONG}</string>`,
        ),
      expect: (r) => r.failures.some((m) => m.includes("package_name")),
    },
    {
      name: "оператор package правлен, а каталог не переехал",
      plant: () => {
        const file = tracked().find((f) => f.endsWith("/MainActivity.java"));
        return swap(file, `package ${APP_ID};`, `package ${WRONG};`);
      },
      expect: (r) => r.failures.some((m) => m.includes("оператор package")),
    },
    {
      name: "productID в StoreKit потерял префикс bundle id",
      // Файл ищется, а не пишется literal'ом: его ИМЯ несёт бренд, а
      // `check:brand` роняет всякое написание имени вне своего списка
      // исключений — включая написанное здесь. Поймано этим сторожем на
      // первом же прогоне.
      plant: () => {
        const kit = tracked().find((f) => f.endsWith(".storekit"));
        return swap(kit, `"productID" : "${APP_ID}.pro.lifetime"`, `"productID" : "${WRONG}.pro.lifetime"`);
      },
      expect: (r) => r.failures.some((m) => m.includes("productID") && m.includes("pro.lifetime")),
    },
    {
      name: "appId в capacitor.config.ts разошёлся с нативными проектами",
      plant: () => swap("capacitor.config.ts", `appId: "${APP_ID}"`, `appId: "${WRONG}"`),
      expect: (r) => r.failures.some((m) => m.startsWith("capacitor.config.ts") && m.includes("appId")),
    },
    {
      name: "личность объявлена в файле, которого нет в поимённом списке",
      plant: () =>
        swap(
          "android/app/src/main/AndroidManifest.xml",
          "<uses-permission",
          `<!-- ${WRONG} -->\n    <uses-permission`,
        ),
      expect: (r) => r.failures.some((m) => m.startsWith("android/app/src/main/AndroidManifest.xml")),
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
  console.log(ok ? `check:app-id --plant — ${n} из ${n}` : "check:app-id --plant — FAILED");
  return ok;
}

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report(scan());
  process.exitCode = ok ? 0 : 1;
}
