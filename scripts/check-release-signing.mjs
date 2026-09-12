// Релизная сборка не уходит в магазин неподписанной, а ключ подписи не
// уходит в репозиторий.
//
// ЧТО ЗДЕСЬ ЗАКРЫВАЕТСЯ (долг 78, замер 11.09.2026). Формулировка долга
// называла пять бед разом; три из них к этому дню уже были закрыты
// чужими заходами и проверены числом: `usesCleartextTraffic` в наборе
// `main` — 0 вхождений (долг 109, живёт только в наборе `debug`),
// `NSAppTransportSecurity` в релизном `Info.plist` — 0 ключей (долг 110,
// живёт только в `Info-Debug.plist`), молчаливый `server.url` — уже
// `https://rusofacilapp.com`. Четвёртая («`versionCode 1`») дефектом не
// является: для ПЕРВОЙ подачи единица — законное значение, а Play
// отказывает только тому пакету, чей `versionCode` уже занят
// опубликованным. Осталась одна настоящая: во всём каталоге `android/`
// слово `signingConfig` не встречалось НИ РАЗУ.
//
// ЧЕМ ЭТО ПЛОХО ИМЕННО ТАК. `./gradlew assembleRelease` без
// `signingConfig` не падает и не предупреждает — он отдаёт
// `app-release-unsigned.apk`, файл с нормальным именем и нормальным
// размером. Это тот же класс отказа, что и долг 109: сборка молчит, а
// беда обнаруживается на той стороне, где её уже видит чужой человек.
// Поэтому правка — не «добавить блок», а сделать молчание невозможным:
// артефакт, который уходит в Play (`bundleRelease`, AAB), без ключа
// теперь БРОСАЕТ, а не собирается неподписанным. `assembleRelease`
// без ключа по-прежнему собирается — на нём стоит `check:apk-facts` и
// `check:native-release-safety` в `.github/workflows/android-debug.yml`,
// и для чтения манифеста подпись не нужна.
//
// ВТОРАЯ ПОЛОВИНА — САМ КЛЮЧ. Хранилище ключей Android нельзя ни
// перевыпустить, ни отозвать: приложение, подписанное потерянным
// ключом, обновлять больше нечем. Ключ, однажды попавший в git, из
// истории не убирается. Поэтому здесь три правила разом: пароли не
// пишутся в `build.gradle` литералом, файлы ключей закрыты
// `.gitignore`, и ни одного такого файла нет ни в индексе git, ни на
// диске под `android/`.
//
// ПОЧЕМУ ДВЕ ПРОВЕРКИ НА ОТСУТСТВИЕ КЛЮЧА, А НЕ ОДНА. Урок прошлых
// заходов: сторож, который смотрит только в `git ls-files`, зелен до
// `git add` и краснеет в CI — и наоборот, сторож, который смотрит
// только на диск, слеп к файлу, уже лежащему в индексе на другой
// ветке. Обе половины считаются.
//
// ЧЕГО ЭТОТ СТОРОЖ НЕ ДОКАЗЫВАЕТ. Он читает исходники. Что собранный
// AAB действительно подписан и именно тем ключом — доказывается только
// сборкой с настоящим хранилищем, которого у агента нет и не может
// быть: ключ для боевого аккаунта создаёт владелец. Слой пакета здесь
// отсутствует намеренно, и это записано долгом, а не умолчанием.
//
//   node scripts/check-release-signing.mjs          # гейт
//   node scripts/check-release-signing.mjs --plant  # позитивный контроль
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const GRADLE = "android/app/build.gradle";
const GITIGNORE = ".gitignore";
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";

/** Имена, под которыми лежит хранилище ключей и файл с паролями к нему.
 *  Любой из них внутри репозитория — авария, а не неопрятность. */
const KEY_FILE_RE = /(^|\/)(keystore\.properties|[^/]+\.(jks|keystore|p12|pepk))$/i;

/** Четыре значения, без которых подпись не собирается. Порядок важен
 *  только для читаемости сообщения. */
const SIGNING_FIELDS = ["storeFile", "storePassword", "keyAlias", "keyPassword"];

/** Тело блока `name { ... }` со счётом скобок. Наивный `[\s\S]*?}`
 *  обрывается на первой же вложенной скобке — в `buildTypes.release`
 *  такая есть (`getDefaultProguardFile(...)` не в счёт, а вот
 *  `signingConfigs { release { ... } }` вложен по-настоящему). */
export function blockBody(source, name) {
  const open = source.search(new RegExp(`(^|[^\\w.])${name}\\s*\\{`, "m"));
  if (open === -1) return null;
  const start = source.indexOf("{", open);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
}

/** Тело замыкания, открытого сразу за маркером: `gradle.taskGraph.whenReady
 *  { graph -> … }`. `blockBody` здесь не годится — там имя блока стоит
 *  вплотную к скобке, а тут между ними параметр замыкания. */
export function closureAfter(source, marker) {
  const at = source.indexOf(marker);
  if (at === -1) return null;
  const start = source.indexOf("{", at);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
}

/** Все значения ключа настройки Xcode во ВСЕХ конфигурациях. Возвращает
 *  список, а не первое совпадение: `project.pbxproj` держит по паре
 *  `Debug`/`Release` на каждый уровень, и расходятся они именно парами. */
export function pbxValues(pbxproj, key) {
  const out = [];
  const re = new RegExp(`^\\s*${key}\\s*=\\s*([^;]+);`, "gm");
  let m;
  while ((m = re.exec(pbxproj)) !== null) out.push(m[1].trim().replace(/^"|"$/g, ""));
  return out;
}

/**
 * Приговор по исходникам. Восемь правил; каждое возвращает строку, в
 * которой названо место, а не «что-то не так».
 */
export function judgeSigning({ gradle, gitignore, keyFiles, pbxproj }) {
  const bad = [];

  // 1. Подписной конфиг вообще объявлен.
  const signingConfigs = blockBody(gradle, "signingConfigs");
  const releaseSigning = signingConfigs === null ? null : blockBody(signingConfigs, "release");
  if (releaseSigning === null) {
    bad.push(
      `${GRADLE}: нет signingConfigs.release — ./gradlew assembleRelease молча отдаёт ` +
        "app-release-unsigned.apk, а неподписанный артефакт Play Console не принимает вовсе",
    );
  }

  // 2. Релизный вариант на него ссылается. Объявить конфиг и забыть его
  //    подключить — ровно тот же неподписанный пакет, только с алиби.
  const buildTypes = blockBody(gradle, "buildTypes");
  const releaseBuild = buildTypes === null ? null : blockBody(buildTypes, "release");
  if (releaseBuild === null) {
    bad.push(`${GRADLE}: не читается блок buildTypes.release`);
  } else {
    if (!/\bsigningConfig\b/.test(releaseBuild)) {
      bad.push(
        `${GRADLE}: buildTypes.release не упоминает signingConfig — подписной конфиг, ` +
          "который не подключён к релизному варианту, не подписывает ничего",
      );
    }
    // 8. `minifyEnabled` объявлен явно. Формулировка долга 78 утверждала,
    //    что его нет; замер 11.09.2026 показал обратное — строка стояла.
    //    Правило держит её на месте: молчание здесь означает «как решит
    //    AGP», а это разные ответы в разных версиях.
    if (!/\bminifyEnabled\b/.test(releaseBuild)) {
      bad.push(`${GRADLE}: buildTypes.release не объявляет minifyEnabled явно`);
    }
  }

  // 3. Ни одного пароля литералом. Ищется КАВЫЧКА сразу за именем поля:
  //    `storePassword keystoreProperties.getProperty('storePassword')` —
  //    это чтение, а `storePassword "hunter2"` — утечка.
  for (const field of SIGNING_FIELDS) {
    const re = new RegExp(`\\b${field}\\s+["']`);
    if (re.test(gradle)) {
      bad.push(
        `${GRADLE}: ${field} задан строковым литералом — секрет подписи попал бы в git ` +
          "вместе с файлом сборки",
      );
    }
  }

  // 4. Отказ громкий, а не «предупреждение», и он смотрит именно на тот
  //    артефакт, который уходит в магазин. Три условия, а не одно: первая
  //    редакция этого правила искала в файле подстроку — и подсадка
  //    «упоминание bundleRelease убрано вовсе» её ПРОПУСТИЛА, потому что
  //    та же подстрока нашлась в соседнем выражении. Рассуждать надо о
  //    теле хука, а не о файле целиком.
  const hook = closureAfter(gradle, "gradle.taskGraph.whenReady");
  if (hook === null) {
    bad.push(
      `${GRADLE}: нет хука gradle.taskGraph.whenReady — релизный AAB без ключа подписи ` +
        "собрался бы молча, и Play Console отказал бы уже на загрузке",
    );
  } else {
    if (!/\bbundle\b|bundleRelease/.test(hook)) {
      bad.push(
        `${GRADLE}: хук gradle.taskGraph.whenReady не различает задачу bundle*Release — ` +
          "отказ не сработает на том единственном артефакте, который уходит в Play",
      );
    }
    if (!/\brelease\b/i.test(hook)) {
      bad.push(
        `${GRADLE}: хук gradle.taskGraph.whenReady не различает релизный вариант — ` +
          "отказ сработал бы не на том, на чём нужно",
      );
    }
    if (!/throw\s+new\s+GradleException/.test(hook)) {
      bad.push(
        `${GRADLE}: в хуке gradle.taskGraph.whenReady нет throw new GradleException — ` +
          "правило не гейт, а пожелание",
      );
    }
  }

  // 5. `.gitignore` закрывает всё, чем может оказаться ключ.
  const ignoreLines = gitignore
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  for (const needed of ["keystore.properties", "*.jks", "*.keystore"]) {
    if (!ignoreLines.some((l) => l === needed || l.endsWith(`/${needed}`))) {
      bad.push(
        `${GITIGNORE}: не закрыт «${needed}» — потерянный ключ подписи Android не ` +
          "перевыпускается, а попавший в историю git из неё не убирается",
      );
    }
  }

  // 6. И ни одного такого файла на самом деле. Обе половины считаются:
  //    индекс git и диск (см. шапку).
  for (const { path, where } of keyFiles) {
    bad.push(`файл ключа подписи ${where}: ${path} — в репозитории ему не место`);
  }

  // 7. Версия у двух платформ одна. Расхождение здесь не ломает сборку, а
  //    даёт двум магазинам разные номера у одного релиза.
  const versionCode = gradle.match(/\bversionCode\s+(\d+)/);
  const versionName = gradle.match(/\bversionName\s+"([^"]+)"/);
  if (!versionCode) bad.push(`${GRADLE}: versionCode не читается`);
  if (!versionName) bad.push(`${GRADLE}: versionName не читается`);
  if (versionCode && Number(versionCode[1]) < 1) {
    bad.push(`${GRADLE}: versionCode ${versionCode[1]} — Play принимает только целое ≥ 1`);
  }
  const projectVersions = pbxValues(pbxproj, "CURRENT_PROJECT_VERSION");
  const marketingVersions = pbxValues(pbxproj, "MARKETING_VERSION");
  if (projectVersions.length === 0 || marketingVersions.length === 0) {
    bad.push(`${PBXPROJ}: не читаются CURRENT_PROJECT_VERSION / MARKETING_VERSION`);
  }
  if (versionCode) {
    for (const v of projectVersions) {
      if (v !== versionCode[1]) {
        bad.push(
          `${PBXPROJ}: CURRENT_PROJECT_VERSION = ${v}, а versionCode в ${GRADLE} = ` +
            `${versionCode[1]} — у одного релиза два разных номера сборки`,
        );
      }
    }
  }
  if (versionName) {
    for (const v of marketingVersions) {
      if (v !== versionName[1]) {
        bad.push(
          `${PBXPROJ}: MARKETING_VERSION = ${v}, а versionName в ${GRADLE} = ` +
            `"${versionName[1]}" — у одного релиза две разные витринные версии`,
        );
      }
    }
  }

  return bad;
}

/** Файлы ключей, найденные ДВУМЯ независимыми способами. */
function findKeyFiles() {
  const found = [];
  let tracked = [];
  try {
    tracked = execFileSync("git", ["ls-files"], { encoding: "utf-8" }).split("\n");
  } catch {
    // Без git (архив исходников) остаётся половина с диском — она ниже.
  }
  for (const path of tracked) {
    if (path && KEY_FILE_RE.test(path)) found.push({ path, where: "в индексе git" });
  }
  const walk = (dir) => {
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const path = join(dir, name);
      let st;
      try {
        st = statSync(path);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (name === "build" || name === ".gradle" || name === "node_modules") continue;
        walk(path);
      } else if (KEY_FILE_RE.test(path) && !found.some((f) => f.path === path)) {
        found.push({ path, where: "на диске" });
      }
    }
  };
  for (const dir of ["android", "ios"]) if (existsSync(dir)) walk(dir);
  return found;
}

function plant() {
  console.log("check:release-signing --plant — подсадки:");
  const healthy = {
    gradle: readFileSync(GRADLE, "utf-8"),
    gitignore: readFileSync(GITIGNORE, "utf-8"),
    keyFiles: [],
    pbxproj: readFileSync(PBXPROJ, "utf-8"),
  };

  // Отрицательный контроль СНАЧАЛА: подсадка засчитывается только тем,
  // что ДОБАВИЛА жалобу, которой на чистых исходниках нет. Урок 7.159 —
  // при красном чистом прогоне счёт «N из N» был бы враньём.
  const clean = judgeSigning(healthy);
  const isNew = (bad) => bad.some((line) => !clean.includes(line));

  const plants = [
    [
      "signingConfigs.release убран целиком",
      () =>
        judgeSigning({
          ...healthy,
          gradle: healthy.gradle.replace(/signingConfigs\s*\{/, "signingConfigsDisabled {"),
        }),
    ],
    [
      "конфиг объявлен, но релизный вариант его не подключает",
      () =>
        judgeSigning({
          ...healthy,
          gradle: healthy.gradle.replace(/^(\s*)signingConfig\s+.*$/m, "$1// снято подсадкой"),
        }),
    ],
    [
      "minifyEnabled снова не объявлен",
      () => judgeSigning({ ...healthy, gradle: healthy.gradle.replace(/\bminifyEnabled\b/g, "// minify") }),
    ],
    [
      "пароль хранилища вписан литералом",
      () =>
        judgeSigning({
          ...healthy,
          gradle: healthy.gradle.replace(
            /storePassword\s+\S.*$/m,
            `storePassword ${JSON.stringify("PLANTED-SECRET")}`,
          ),
        }),
    ],
    [
      "отказ на релизный AAB перестал быть отказом (throw убран)",
      () =>
        judgeSigning({
          ...healthy,
          gradle: healthy.gradle.replace(/throw\s+new\s+GradleException/g, "logger.warn"),
        }),
    ],
    [
      "хук whenReady убран целиком",
      () =>
        judgeSigning({
          ...healthy,
          gradle: healthy.gradle.replace(/gradle\.taskGraph\.whenReady/g, "gradle.taskGraph.ignored"),
        }),
    ],
    [
      "хук перестал различать релизный AAB (bundle → assemble)",
      () =>
        judgeSigning({
          ...healthy,
          gradle: healthy.gradle
            .replace(/startsWith\('bundle'\)/g, "startsWith('assemble')")
            .replace(/bundleRelease/g, "someTask")
            .replace(/bundle\*Release/g, "someTask"),
        }),
    ],
    [
      ".gitignore перестал закрывать *.jks",
      () =>
        judgeSigning({
          ...healthy,
          gitignore: healthy.gitignore
            .split("\n")
            .filter((l) => l.trim() !== "*.jks")
            .join("\n"),
        }),
    ],
    [
      ".gitignore перестал закрывать keystore.properties",
      () =>
        judgeSigning({
          ...healthy,
          gitignore: healthy.gitignore
            .split("\n")
            .filter((l) => l.trim() !== "keystore.properties")
            .join("\n"),
        }),
    ],
    [
      "хранилище ключей лежит в индексе git",
      () =>
        judgeSigning({
          ...healthy,
          keyFiles: [{ path: "android/app/release.jks", where: "в индексе git" }],
        }),
    ],
    [
      "versionCode у Android и iOS разошлись",
      () =>
        judgeSigning({
          ...healthy,
          pbxproj: healthy.pbxproj.replace(/CURRENT_PROJECT_VERSION = \d+;/, "CURRENT_PROJECT_VERSION = 42;"),
        }),
    ],
    [
      "витринная версия у Android и iOS разошлась",
      () =>
        judgeSigning({
          ...healthy,
          pbxproj: healthy.pbxproj.replace(/MARKETING_VERSION = [^;]+;/, "MARKETING_VERSION = 2.5;"),
        }),
    ],
    [
      "versionCode стал нулём",
      () => judgeSigning({ ...healthy, gradle: healthy.gradle.replace(/versionCode\s+\d+/, "versionCode 0") }),
    ],
  ];

  let caught = 0;
  for (const [name, run] of plants) {
    const bad = run();
    const hit = isNew(bad);
    const line = bad.find((l) => !clean.includes(l));
    console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${name}${hit ? ` → ${line}` : ""}`);
    if (hit) caught += 1;
  }

  const quiet = clean.length === 0;
  console.log(
    `  ${quiet ? "отрицательный контроль: настоящие исходники — молчание" : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН: ${clean.join("; ")}`}`,
  );
  console.log(`  поймано ${caught} из ${plants.length}`);
  return caught === plants.length && quiet;
}

function main() {
  if (process.argv.includes("--plant")) {
    process.exit(plant() ? 0 : 1);
  }

  const keyFiles = findKeyFiles();
  const bad = judgeSigning({
    gradle: readFileSync(GRADLE, "utf-8"),
    gitignore: readFileSync(GITIGNORE, "utf-8"),
    keyFiles,
    pbxproj: readFileSync(PBXPROJ, "utf-8"),
  });

  if (bad.length === 0) {
    const gradle = readFileSync(GRADLE, "utf-8");
    const vc = gradle.match(/\bversionCode\s+(\d+)/)?.[1];
    const vn = gradle.match(/\bversionName\s+"([^"]+)"/)?.[1];
    const pbx = readFileSync(PBXPROJ, "utf-8");
    console.log(
      `check:release-signing — signingConfigs.release объявлен и подключён к релизному ` +
        `варианту, секретов литералом 0, bundleRelease без ключа БРОСАЕТ, файлов ключа в ` +
        `репозитории 0 (искали и в индексе git, и на диске), версия одна на две платформы: ` +
        `versionCode ${vc} = CURRENT_PROJECT_VERSION ×${pbxValues(pbx, "CURRENT_PROJECT_VERSION").length}, ` +
        `versionName "${vn}" = MARKETING_VERSION ×${pbxValues(pbx, "MARKETING_VERSION").length}. ` +
        `Слоя пакета у этого сторожа НЕТ: что AAB действительно подписан, доказывается только ` +
        `сборкой с настоящим хранилищем (долг владельца).`,
    );
    process.exit(0);
  }
  for (const line of bad) console.error(`РАСХОЖДЕНИЕ: ${line}`);
  process.exit(1);
}

// Ничего при импорте: этот файл читает `src/lib/entry-point.test.ts`.
const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) main();
