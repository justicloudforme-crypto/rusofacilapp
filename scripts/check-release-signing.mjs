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
// ДВА СЛОЯ, А НЕ ОДИН (долг 139 закрыт 11.09.2026, заход 7.179). Всё,
// что описано выше, — слой ИСХОДНИКОВ. Он не может сказать, подписан ли
// собранный артефакт: `signingConfig` в `build.gradle` — намерение, а
// подпись — свойство файла. Ниже в этом же файле живёт слой ПАКЕТА
// (`judgePackage`): он судит дословный вывод `apksigner verify
// --print-certs` / `jarsigner -verify -certs` / `keytool -printcert` и
// ловит три отказа, невидимых по исходникам, — «не подписан»,
// «подписан отладочным ключом», «подписан ДРУГИМ ключом». Ключ владельца
// создан 11.09.2026, и оба артефакта собраны и проверены им впервые.
//
//   node scripts/check-release-signing.mjs          # слой исходников
//   node scripts/check-release-signing.mjs --plant  # подсадки обоих слоёв
//   node scripts/check-release-signing.mjs \
//     --certs=apk-certs.txt --certs=aab-certs.txt \
//     --expect-sha256=00:07:2D:…                    # слой пакета
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
    // Условие ищется в самом выражении поиска задачи, а не во всём теле
    // хука: текст сообщения об отказе лежит в том же теле и содержит
    // слово «bundleRelease», так что правило по телу целиком проходило бы
    // и на хуке, который ничего не различает.
    const detector = closureAfter(hook, "graph.allTasks.find");
    if (detector === null) {
      bad.push(
        `${GRADLE}: хук gradle.taskGraph.whenReady не ищет задачу в графе — ` +
          "отказывать ему не на чем",
      );
    } else {
      if (!/bundle/.test(detector)) {
        bad.push(
          `${GRADLE}: условие отказа не упоминает задачу bundle*Release — ` +
            "отказ не сработает на том единственном артефакте, который уходит в Play",
        );
      }
      if (!/[Rr]elease/.test(detector)) {
        bad.push(
          `${GRADLE}: условие отказа не различает релизный вариант — ` +
            "отказ сработал бы не на том, на чём нужно",
        );
      }
      // Имя задачи обязано сличаться ЦЕЛИКОМ. Оплачено красным прогоном
      // 12.09.2026: `startsWith('bundle') && contains('release')` ловило
      // внутреннюю задачу AGP `bundleReleaseResources` и роняло обычный
      // `assembleRelease`. Здесь правило требует якорей: без них условие
      // снова станет «по подстроке».
      if (!/\^bundle/.test(detector) || !/Release\$/.test(detector)) {
        bad.push(
          `${GRADLE}: условие отказа сличает имя задачи по подстроке, а не целиком — ` +
            "в граф релизной СБОРКИ APK входит внутренняя задача AGP bundleReleaseResources, " +
            "и такое условие уронит обычный assembleRelease (так и вышло 12.09.2026)",
        );
      }
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
  //
  //    РАЗНИЦА МЕЖДУ ДВУМЯ ВИДАМИ ФАЙЛОВ, ОПЛАЧЕННАЯ СОБРАННЫМ КЛЮЧОМ
  //    11.09.2026. Первая редакция этого правила валила ЛЮБОЕ совпадение
  //    имени — и покраснела в ту же минуту, когда ключ был наконец
  //    создан: `android/keystore.properties` — это ровно то место,
  //    которое `android/app/build.gradle` документирует владельцу
  //    (`rootProject.file('keystore.properties')`), и оно закрыто
  //    `.gitignore`. Сторож, запрещающий файл, без которого подпись не
  //    работает, — не сторож, а тупик: закрыть долг 139 при нём было бы
  //    нельзя вовсе. Поэтому виды разведены:
  //      • само хранилище (`*.jks`, `*.keystore`, `*.p12`, `*.pepk`) —
  //        под деревом репозитория не лежит НИКОГДА, ни в индексе, ни на
  //        диске: один `git add -f` необратим;
  //      • `keystore.properties` — в индексе не лежит никогда, а на диске
  //        разрешён РОВНО в одном месте и только пока git его не видит.
  //    Обе половины проверяются числом, у обеих есть подсадка.
  const PROPERTIES_HOME = "android/keystore.properties";
  for (const { path, where, ignored } of keyFiles) {
    const isProperties = /(^|\/)keystore\.properties$/i.test(path);
    if (!isProperties) {
      bad.push(`файл ключа подписи ${where}: ${path} — в репозитории ему не место`);
      continue;
    }
    if (where !== "на диске") {
      bad.push(
        `файл ключа подписи ${where}: ${path} — пароли к хранилищу в git не кладутся ` +
          "ни при каких условиях",
      );
      continue;
    }
    if (path.replace(/\\/g, "/") !== PROPERTIES_HOME) {
      bad.push(
        `${path}: пароли к хранилищу лежат не там, где их ищет сборка — ` +
          `build.gradle читает только ${PROPERTIES_HOME}`,
      );
      continue;
    }
    if (ignored !== true) {
      bad.push(
        `${path}: файл с паролями к хранилищу НЕ закрыт .gitignore — ` +
          "он попадёт в git первым же `git add -A`",
      );
    }
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

// ─────────────────────────────────────────────────────────────────────
// СЛОЙ ПАКЕТА (долг 139, заход 7.179).
//
// Всё выше читает ИСХОДНИКИ. Ни одно правило оттуда не может сказать,
// подписан ли собранный артефакт и тем ли ключом: `signingConfig` в
// `build.gradle` — это намерение, а подпись — свойство файла. Разница
// не умозрительная, она дважды оплачена красным: долг 109 (адрес
// ноутбука внутри релизного APK, опровергнут первым же собранным
// пакетом) и сам долг 78 (гейт по именам задач Gradle уронил обычный
// `assembleRelease`, и поймал это только собранный артефакт).
//
// ЧТО СУДИТСЯ. Не файл, а ВЫВОД ИНСТРУМЕНТА, который его прочитал:
// `apksigner verify --print-certs` для APK, `jarsigner -verify -certs`
// для AAB (у `.aab` схем v2/v3 не бывает — это обычный jar, и Play
// проверяет у него именно подпись jar), `keytool -printcert` для
// сертификата, вынутого из `META-INF/*.RSA`. Так же устроены соседние
// сторожа этого репозитория (`--badging=` у `check:apk-facts`,
// `--xmltree=` у `check:native-release-safety`): судья ничего не
// запускает сам, поэтому его подсадки — чистый текст, и они гоняются
// в CI, где ни ключа, ни Android SDK может не быть вовсе.
//
//   node scripts/check-release-signing.mjs \
//     --certs=apk-certs.txt --certs=aab-certs.txt \
//     --expect-sha256=00072D34…
//
// ТРИ ОТКАЗА, КОТОРЫЕ ЭТОТ СЛОЙ ДОЛЖЕН ЛОВИТЬ И ЛОВИТ НА НАСТОЯЩИХ
// АРТЕФАКТАХ (11.09.2026, все три собраны, а не выдуманы):
//   • неподписанный `app-release-unsigned.apk` — `apksigner` отвечает
//     «DOES NOT VERIFY / Missing META-INF/MANIFEST.MF», `jarsigner` —
//     «no manifest.»;
//   • `app-debug.apk` — подписан отладочным ключом
//     `C=US, O=Android, CN=Android Debug`, который Play не принимает и
//     который лежит у каждого разработчика мира одинаковый;
//   • подпись НЕ тем ключом — ловится сличением отпечатка SHA-256 с
//     ожидаемым (`--expect-sha256`), а не наличием слова «Verifies».
const DEBUG_DN_RE = /CN\s*=\s*Android Debug/i;

/** Отпечаток к сравнимому виду: `00:07:2D:…` и `00072d34…` — одно и то
 *  же число, записанное двумя инструментами по-разному. */
export function normalizeFingerprint(value) {
  return String(value).replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

/** Каким инструментом получен текст. Судить об этом обязан сам судья:
 *  расширение файла ничего не гарантирует, а вывод `jarsigner`,
 *  принятый за вывод `apksigner`, молча прошёл бы мимо всех правил про
 *  схемы. */
export function certsDialect(text) {
  if (/^\s*(Verifies|DOES NOT VERIFY)\s*$/m.test(text) || /Verified using v\d/.test(text)) {
    return "apksigner";
  }
  if (/\bjar verified\.|\bjar is unsigned|^\s*no manifest\.\s*$/m.test(text)) return "jarsigner";
  if (/^Owner:/m.test(text) && /SHA256:/m.test(text)) return "keytool";
  return null;
}

/** Схемы подписи APK числами: `{ v1: false, v2: true, v3: false }`. */
export function signatureSchemes(text) {
  const out = {};
  const re = /Verified using (v[\d.]+) scheme[^:]*:\s*(true|false)/g;
  let m;
  while ((m = re.exec(text)) !== null) out[m[1]] = m[2] === "true";
  return out;
}

/** Все имена подписантов, какими их напечатал инструмент. */
export function signerNames(text) {
  const out = [];
  const apk = /certificate DN:\s*(.+)/g;
  let m;
  while ((m = apk.exec(text)) !== null) out.push(m[1].trim());
  const jar = /^-?\s*Signed by "([^"]+)"/gm;
  while ((m = jar.exec(text)) !== null) out.push(m[1].trim());
  const kt = /^Owner:\s*(.+)$/gm;
  while ((m = kt.exec(text)) !== null) out.push(m[1].trim());
  return [...new Set(out)];
}

/** Отпечатки SHA-256 сертификатов (не открытых ключей: `apksigner`
 *  печатает и те и другие, а сличать надо сертификат — именно его
 *  отпечаток спрашивает Play Console и несёт `assetlinks.json`). */
export function certificateFingerprints(text) {
  const out = [];
  const apk = /certificate SHA-256 digest:\s*([0-9a-fA-F:]+)/g;
  let m;
  while ((m = apk.exec(text)) !== null) out.push(normalizeFingerprint(m[1]));
  const kt = /^\s*SHA256:\s*([0-9A-Fa-f:]+)\s*$/gm;
  while ((m = kt.exec(text)) !== null) out.push(normalizeFingerprint(m[1]));
  return [...new Set(out)];
}

/**
 * Приговор по СОБРАННЫМ артефактам. `inputs` — список
 * `{ name, text }`, где text — дословный вывод инструмента.
 */
export function judgePackage(inputs, expectSha256) {
  const bad = [];
  const facts = { checked: 0, schemes: {}, signers: [], fingerprints: [] };

  if (inputs.length === 0) {
    bad.push(
      "слою пакета не дали ни одного артефакта: без --certs=<файл> доказывать нечего, " +
        "а «0 проблем» на пустом входе — это не проверка",
    );
    return { bad, facts };
  }

  for (const { name, text } of inputs) {
    const dialect = certsDialect(text);
    if (dialect === null) {
      bad.push(
        `${name}: вывод не опознан ни как apksigner, ни как jarsigner, ни как keytool — ` +
          "судить не о чем, а молчание здесь читалось бы как «подписано»",
      );
      continue;
    }
    facts.checked += 1;

    // 1. Приговор инструмента. Он первый и он же самый частый: именно
    //    так выглядит неподписанный артефакт, который до 11.09.2026
    //    только и умела класть эта сборка.
    if (dialect === "apksigner") {
      if (/DOES NOT VERIFY/.test(text) || !/^\s*Verifies\s*$/m.test(text)) {
        const why = text.match(/^ERROR:.*$/m)?.[0] ?? "apksigner не сказал «Verifies»";
        bad.push(`${name}: артефакт НЕ подписан — ${why}`);
        continue;
      }
    } else if (dialect === "jarsigner") {
      if (!/\bjar verified\./.test(text)) {
        const why = /no manifest\./.test(text)
          ? "no manifest — в пакете нет META-INF/MANIFEST.MF"
          : "jarsigner не сказал «jar verified»";
        bad.push(`${name}: артефакт НЕ подписан — ${why}`);
        continue;
      }
    }

    // 2. Подписан — но кем. Отладочный ключ проходит любую проверку
    //    «подписан ли», лежит у каждого разработчика одинаковый и
    //    Play Console его не принимает.
    const signers = signerNames(text);
    if (signers.length === 0) {
      bad.push(`${name}: инструмент не назвал ни одного подписанта`);
    }
    for (const dn of signers) {
      if (DEBUG_DN_RE.test(dn)) {
        bad.push(
          `${name}: артефакт подписан ОТЛАДОЧНЫМ ключом (${dn}) — этот ключ Gradle ` +
            "заводит сам, он одинаков у всех и в магазин не годится",
        );
      }
    }
    facts.signers.push(...signers);

    // 3. Схемы подписи — числами, а не «подписано». У `.aab` их нет по
    //    построению (это jar), поэтому правило только для apksigner.
    if (dialect === "apksigner") {
      const schemes = signatureSchemes(text);
      Object.assign(facts.schemes, schemes);
      const strong = ["v1", "v2", "v3", "v3.1"].filter((v) => schemes[v] === true);
      if (strong.length === 0) {
        bad.push(
          `${name}: ни одна схема подписи не подтверждена (v1 ${schemes.v1}, v2 ${schemes.v2}, ` +
            `v3 ${schemes.v3}) — одной строки «Verifies» мало, подписью считается схема`,
        );
      }
    }

    facts.fingerprints.push(...certificateFingerprints(text));
  }

  // 4. Тот ли это ключ. Без сличения отпечатка «подписан» означает лишь
  //    «подписан чем угодно» — включая ключ, которого у владельца нет.
  facts.fingerprints = [...new Set(facts.fingerprints)];
  facts.signers = [...new Set(facts.signers)];
  if (expectSha256) {
    const want = normalizeFingerprint(expectSha256);
    if (want.length !== 64) {
      bad.push(`--expect-sha256: «${expectSha256}» не похож на отпечаток SHA-256 (нужно 64 знака)`);
    } else if (facts.fingerprints.length === 0) {
      bad.push(
        "отпечаток сертификата не прочитан ни из одного входа, а сличить его велено — " +
          "дайте вывод apksigner --print-certs или keytool -printcert",
      );
    } else {
      for (const got of facts.fingerprints) {
        if (got !== want) {
          bad.push(
            `отпечаток подписи ${got} не совпал с ожидаемым ${want} — артефакт подписан ` +
              "ДРУГИМ ключом, и обновить им уже опубликованное приложение будет нечем",
          );
        }
      }
    }
  }

  return { bad, facts };
}


// ─────────────────────────────────────────────────────────────────────
// ОБРАЗЦЫ ДЛЯ ПОДСАДОК — ДОСЛОВНЫЙ ВЫВОД ИНСТРУМЕНТОВ ПО НАСТОЯЩИМ
// АРТЕФАКТАМ, СОБРАННЫМ 11.09.2026. Не выдуманы и не сокращены по
// смыслу: сокращён только длинный перечень записей у `jarsigner`.
// Артефакты, с которых они сняты:
//   app-release.apk          14 848 048 Б  (ключ владельца)
//   app-release.aab          14 153 511 Б  (ключ владельца)
//   app-debug.apk            19 479 967 Б  (отладочный ключ Gradle)
//   app-release-unsigned.apk 14 835 760 Б  (тот же исходник БЕЗ ключа)
// Держать их в файле, а не читать с диска, обязательно: подсадки
// гоняются в CI, где ни ключа, ни Android SDK, ни собранного пакета нет.
export const CERTS_SAMPLES = {
  releaseApk: "Verifies\nVerified using v1 scheme (JAR signing): false\nVerified using v2 scheme (APK Signature Scheme v2): true\nVerified using v3 scheme (APK Signature Scheme v3): false\nVerified using v3.1 scheme (APK Signature Scheme v3.1): false\nVerified using v4 scheme (APK Signature Scheme v4): false\nVerified for SourceStamp: false\nNumber of signers: 1\nSigner #1 certificate DN: CN=Vasilii Petrov, L=Tijuana, C=MX\nSigner #1 certificate SHA-256 digest: 00072d34ef64b992818fc20d5ca9e3951c1066b4b307f1ab27e04c507d0ebb82\nSigner #1 certificate SHA-1 digest: e64b2c0a274f071e741d2fa79b8ee1d6d1b14f95\nSigner #1 certificate MD5 digest: 8e1a832c7d6c6e4b284235aef709b6ea\nSigner #1 key algorithm: RSA\nSigner #1 key size (bits): 2048\nSigner #1 public key SHA-256 digest: 5d47f38c9764a09d4a98bab201ad3f13314301857eee5b1e428e88571a183a8f\nSigner #1 public key SHA-1 digest: 79b7a9fae3f2aeef3c5698b7af847a57e9b2e3e8\nSigner #1 public key MD5 digest: 9823a9268572602d1ef0ea0241d24c68\n",
  releaseAab: "      X.509, CN=Vasilii Petrov, L=Tijuana, C=MX\n      Signature algorithm: SHA384withRSA, 2048-bit key\n      X.509, CN=Vasilii Petrov, L=Tijuana, C=MX\n      Signature algorithm: SHA384withRSA, 2048-bit key\n- Signed by \"CN=Vasilii Petrov, L=Tijuana, C=MX\"\n    Signature algorithm: SHA256withRSA, 2048-bit key\njar verified.\nThe signer certificate will expire on 2054-01-27.\n",
  debugApk: "Verifies\nVerified using v1 scheme (JAR signing): false\nVerified using v2 scheme (APK Signature Scheme v2): true\nVerified using v3 scheme (APK Signature Scheme v3): false\nVerified using v3.1 scheme (APK Signature Scheme v3.1): false\nVerified using v4 scheme (APK Signature Scheme v4): false\nVerified for SourceStamp: false\nNumber of signers: 1\nSigner #1 certificate DN: C=US, O=Android, CN=Android Debug\nSigner #1 certificate SHA-256 digest: 2c69c958fcac6492d2ea71a97bfd3f886193128e3b6a99c600c4a3f730ff11a6\nSigner #1 certificate SHA-1 digest: 0bdd433c1933e45321341f4d0477e6d0e5cd9046\nSigner #1 certificate MD5 digest: 46152dace292e2001cb86794c9bb4447\nSigner #1 key algorithm: RSA\nSigner #1 key size (bits): 2048\nSigner #1 public key SHA-256 digest: 8ab21c593c2863403816a19b8d88ad18db2a50a1c260194d73a4b77c64233bb5\nSigner #1 public key SHA-1 digest: 1bcf54dee4e2ebd9a20b3273c757dbfe0a44c5d2\nSigner #1 public key MD5 digest: 7eceac482c1533fea6ee19da976573b3\n",
  unsignedApk: "DOES NOT VERIFY\nERROR: Missing META-INF/MANIFEST.MF\n",
};

/** Отпечаток ключа владельца. Он не секрет — это открытая часть
 *  сертификата, её же несёт `assetlinks.json` (долг 71) и её же
 *  показывает Play Console. Секрет — пароль и сам файл `.jks`. */
export const OWNER_CERT_SHA256 =
  "00:07:2D:34:EF:64:B9:92:81:8F:C2:0D:5C:A9:E3:95:1C:10:66:B4:B3:07:F1:AB:27:E0:4C:50:7D:0E:BB:82";

/** Закрыт ли путь `.gitignore` — спрашивается у самого git, а не
 *  разбором шаблонов: `.gitignore` умеет отрицания, каталоги и вложенные
 *  файлы, и своя реализация тут врала бы ровно там, где это опаснее
 *  всего. Без git (архив исходников) ответ «нет»: неизвестность здесь
 *  трактуется в сторону жалобы. */
function isGitIgnored(path) {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
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
        found.push({ path, where: "на диске", ignored: isGitIgnored(path) });
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
    // НАСТОЯЩИЙ обход, а не пустой список: с 11.09.2026 у владельца есть
    // ключ, и `android/keystore.properties` действительно лежит на диске.
    // Подставить сюда `[]` значило бы гонять отрицательный контроль по
    // выдуманному дереву — то самое «0 проблем» без доказанной поимки.
    keyFiles: findKeyFiles(),
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
      "условие отказа перестало различать AAB (bundle → assemble)",
      () =>
        judgeSigning({
          ...healthy,
          gradle: healthy.gradle.replace(/\^bundle\(/g, "^assemble("),
        }),
    ],
    [
      "имя задачи снова сличается по подстроке — та самая правка, что уронила assembleRelease",
      () =>
        judgeSigning({
          ...healthy,
          gradle: healthy.gradle.replace(
            /task\.name ==~ \/\^bundle\(\[A-Z\]\[A-Za-z0-9\]\*\)\?Release\$\//,
            "task.name.toLowerCase().startsWith('bundle') && task.name.toLowerCase().contains('release')",
          ),
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
      "пароли к хранилищу попали в индекс git",
      () =>
        judgeSigning({
          ...healthy,
          keyFiles: [{ path: "android/keystore.properties", where: "в индексе git" }],
        }),
    ],
    [
      "пароли к хранилищу лежат не там, где их ищет сборка",
      () =>
        judgeSigning({
          ...healthy,
          keyFiles: [{ path: "android/app/keystore.properties", where: "на диске", ignored: true }],
        }),
    ],
    [
      "keystore.properties на диске перестал быть закрыт .gitignore",
      () =>
        judgeSigning({
          ...healthy,
          keyFiles: [{ path: "android/keystore.properties", where: "на диске", ignored: false }],
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

  const pkg = plantPackage();
  return caught === plants.length && quiet && pkg;
}

/** Подсадки СЛОЯ ПАКЕТА. Вход у них — дословный вывод инструментов по
 *  четырём настоящим артефактам (см. CERTS_SAMPLES), поэтому они
 *  гоняются везде, где гоняется node, и ничего не собирают сами. */
function plantPackage() {
  console.log("check:release-signing --plant — слой пакета:");

  // Отрицательный контроль ПЕРВЫМ и на настоящей паре артефактов: APK и
  // AAB, оба подписаны ключом владельца. Молчание здесь — условие того,
  // что все жалобы ниже вызваны подсадкой, а не образцом.
  const healthy = [
    { name: "app-release.apk", text: CERTS_SAMPLES.releaseApk },
    { name: "app-release.aab", text: CERTS_SAMPLES.releaseAab },
  ];
  const clean = judgePackage(healthy, OWNER_CERT_SHA256).bad;
  const isNew = (bad) => bad.some((line) => !clean.includes(line));

  const plants = [
    [
      "неподписанный артефакт (настоящий app-release-unsigned.apk)",
      () => judgePackage([{ name: "app-release-unsigned.apk", text: CERTS_SAMPLES.unsignedApk }], OWNER_CERT_SHA256),
    ],
    [
      "подписан ОТЛАДОЧНЫМ ключом (настоящий app-debug.apk)",
      () => judgePackage([{ name: "app-debug.apk", text: CERTS_SAMPLES.debugApk }], null),
    ],
    [
      // Не отладочным, а именно ЧУЖИМ: имя подписанта приличное, схема
      // подтверждена, «Verifies» на месте — и поймать это можно ровно
      // одним способом, сличением отпечатка. Если бы подсадкой был
      // отладочный ключ, засчиталось бы правило про CN=Android Debug, и
      // правило про отпечаток осталось бы непроверенным.
      "подписан ЧУЖИМ ключом с приличным именем — расходится только отпечаток",
      () =>
        judgePackage(
          [
            {
              name: "app-release.apk",
              text: CERTS_SAMPLES.releaseApk
                .replace(/certificate DN:.*/, "certificate DN: CN=Someone Else, O=Nobody, C=US")
                .replace(
                  /certificate SHA-256 digest:.*/,
                  "certificate SHA-256 digest: " + "ab".repeat(32),
                ),
            },
          ],
          OWNER_CERT_SHA256,
        ),
    ],
    [
      "все схемы подписи выключены, а слово «Verifies» осталось",
      () =>
        judgePackage(
          [{ name: "app-release.apk", text: CERTS_SAMPLES.releaseApk.replace(/: true/g, ": false") }],
          OWNER_CERT_SHA256,
        ),
    ],
    [
      "AAB не подписан вовсе (jarsigner: jar is unsigned)",
      () =>
        judgePackage(
          [{ name: "app-release.aab", text: CERTS_SAMPLES.releaseAab.replace("jar verified.", "jar is unsigned.") }],
          null,
        ),
    ],
    [
      "вывод инструмента подменён чем-то нераспознаваемым",
      () => judgePackage([{ name: "подставной.txt", text: "всё хорошо, честное слово\n" }], null),
    ],
    [
      "слою пакета не дали ни одного артефакта",
      () => judgePackage([], OWNER_CERT_SHA256),
    ],
    [
      "отпечаток ожидается, но прочитать его не из чего",
      () =>
        judgePackage([{ name: "app-release.aab", text: CERTS_SAMPLES.releaseAab }], OWNER_CERT_SHA256.replace("00:07", "11:22")),
    ],
  ];

  let caught = 0;
  for (const [name, run] of plants) {
    const { bad } = run();
    const hit = isNew(bad);
    const line = bad.find((l) => !clean.includes(l));
    console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${name}${hit ? ` → ${line}` : ""}`);
    if (hit) caught += 1;
  }

  const quiet = clean.length === 0;
  const schemes = judgePackage(healthy, OWNER_CERT_SHA256).facts.schemes;
  console.log(
    `  ${quiet ? `отрицательный контроль: настоящие APK и AAB — молчание (схемы: v1 ${schemes.v1}, v2 ${schemes.v2}, v3 ${schemes.v3})` : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН: ${clean.join("; ")}`}`,
  );
  console.log(`  поймано ${caught} из ${plants.length}`);
  return caught === plants.length && quiet;
}

function main() {
  if (process.argv.includes("--plant")) {
    process.exit(plant() ? 0 : 1);
  }

  // СЛОЙ ПАКЕТА. Отдельным входом, а не «заодно»: файлов артефактов на
  // ноутбуке разработчика и в CI может не быть вовсе, а правила по
  // исходникам обязаны гоняться всегда. Зато когда вход дан — молчания
  // «нечего проверять» не бывает: пустой список тоже жалоба.
  const certsArgs = process.argv.filter((a) => a.startsWith("--certs="));
  if (certsArgs.length > 0) {
    const expect =
      process.argv.find((a) => a.startsWith("--expect-sha256="))?.slice("--expect-sha256=".length) ?? null;
    const inputs = [];
    for (const arg of certsArgs) {
      const file = arg.slice("--certs=".length);
      if (!existsSync(file)) {
        console.error(`РАСХОЖДЕНИЕ: ${file} — файла с выводом инструмента нет`);
        process.exit(1);
      }
      inputs.push({ name: file, text: readFileSync(file, "utf-8") });
    }
    const { bad, facts } = judgePackage(inputs, expect);
    if (bad.length > 0) {
      for (const line of bad) console.error(`РАСХОЖДЕНИЕ: ${line}`);
      process.exit(1);
    }
    const schemes = Object.entries(facts.schemes)
      .map(([k, v]) => `${k} ${v ? "да" : "нет"}`)
      .join(", ");
    console.log(
      `check:release-signing (слой пакета) — артефактов прочитано ${facts.checked}, ` +
        `подписант${facts.signers.length === 1 ? "" : "ы"}: ${facts.signers.join(" | ")}, ` +
        `отладочных ключей 0, схемы подписи APK: ${schemes || "у AAB схем нет по построению"}, ` +
        `отпечаток SHA-256 ${facts.fingerprints.join(" ") || "не читался"}` +
        (expect ? " — сличён с ожидаемым, совпал" : " — сличать было не с чем (--expect-sha256 не задан)"),
    );
    process.exit(0);
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
    // Числом, а не словом «чисто»: хранилищ в дереве 0, а файл с
    // паролями либо отсутствует (CI, чужая машина), либо лежит ровно
    // там, где его ищет сборка, и закрыт от git.
    const material = keyFiles.filter((f) => !/keystore\.properties$/i.test(f.path)).length;
    const props = keyFiles.find((f) => /keystore\.properties$/i.test(f.path));
    const propsWord = props
      ? `${props.path} на диске, закрыт .gitignore, в индексе git его нет`
      : "keystore.properties на этой машине нет — сборка релиза здесь неподписанная";
    console.log(
      `check:release-signing — signingConfigs.release объявлен и подключён к релизному ` +
        `варианту, секретов литералом 0, bundleRelease без ключа БРОСАЕТ, хранилищ ключа в ` +
        `дереве репозитория ${material} (искали и в индексе git, и на диске), ${propsWord}, ` +
        `версия одна на две платформы: ` +
        `versionCode ${vc} = CURRENT_PROJECT_VERSION ×${pbxValues(pbx, "CURRENT_PROJECT_VERSION").length}, ` +
        `versionName "${vn}" = MARKETING_VERSION ×${pbxValues(pbx, "MARKETING_VERSION").length}. ` +
        `Это слой ИСХОДНИКОВ; слой пакета — тот же файл с --certs=<вывод apksigner/jarsigner>, ` +
        `его подсадки гоняются в --plant на образцах четырёх настоящих артефактов.`,
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
