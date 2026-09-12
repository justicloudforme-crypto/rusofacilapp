// iOS-ПОЛОВИНА ПРАВКИ ДОЛГА 109 (долг 110). Послабление транспорта —
// исключение для отладки, а не правило для всех вариантов сборки.
//
// ЧТО БЫЛО. `ios/App/App/Info.plist` нёс
// `NSAppTransportSecurity → NSAllowsArbitraryLoads = true` — послабление
// не под один локальный адрес, а под ЛЮБОЙ незашифрованный. Файл в
// Xcode-проекте был ОДИН на обе конфигурации (`INFOPLIST_FILE = App/Info.plist`
// и в `Debug`, и в `Release`), то есть в магазинный пакет послабление
// уехало бы ровно так же, как на Android уезжал адрес домашней сети
// (7.158 часть 1, замерено на артефакте). Поймало бы это не наша
// проверка, а ревью Apple.
//
// ЧТО СТАЛО. Развилка та же, что на Android, и держится тем же —
// УСТРОЙСТВОМ СБОРКИ, а не договорённостью:
//
//   Release → App/Info.plist        — послабления нет вовсе
//   Debug   → App/Info-Debug.plist  — то же самое плюс один блок ATS
//
// Второй файл — не «ещё одна копия, которая разойдётся»: он обязан быть
// побайтово равен первому после вырезания блока между маркерами
// `ATS-DEBUG-ONLY`. Это правило и есть третья проверка ниже; без него
// пять литералов витринного имени и строка назначения микрофона жили бы
// в двух экземплярах без единой точки.
//
// ЧЕГО ЭТА ПРОВЕРКА НЕ ДЕЛАЕТ И НЕ МОЖЕТ. Она читает ИСХОДНИКИ, а не
// `.ipa`: Xcode на машине нет, собрать пакет нечем (то же ограничение,
// что у 7.154, 7.157 и 7.158). У Android-половины слой пакета есть
// (`check:native-release-safety`, `check:apk-facts`, `check:fgs-types`) —
// здесь его нет, и это записано долгом, а не спрятано. Первая настоящая
// сборка на Mac обязана перепроверить, что `INFOPLIST_FILE` действительно
// развёл конфигурации: `project.pbxproj` здесь разбирается регулярными
// выражениями, а не Xcode.
//
//   node scripts/check-ios-release-safety.mjs          # гейт
//   node scripts/check-ios-release-safety.mjs --plant  # позитивный контроль
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RELEASE_PLIST = "ios/App/App/Info.plist";
const DEBUG_PLIST = "ios/App/App/Info-Debug.plist";
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
const CAPACITOR = "capacitor.config.ts";

const MARK_START = "<!-- ATS-DEBUG-ONLY:start -->";
const MARK_END = "<!-- ATS-DEBUG-ONLY:end -->";

const ATS_KEY = "NSAppTransportSecurity";
const ARBITRARY = "NSAllowsArbitraryLoads";

/** Тот же список, что в `capacitor.config.ts` и в
 *  `check-native-release-safety.mjs`. Объявлен здесь третий раз намеренно:
 *  сторож обязан судить, ничего не импортируя из проверяемого файла. */
function isPrivateHost(host) {
  if (host === "localhost" || host.endsWith(".local")) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/** XML-комментарии выкусываются ДО поиска: объяснение, ПОЧЕМУ послабления
 *  здесь больше нет, называет `NSAppTransportSecurity` по имени, и считать
 *  это объявлением значило бы запретить объяснять правку. Тот же приём, что
 *  у `stripComments` в `check-native-permissions.mjs`. */
export function stripXmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, "");
}

/** Вырезает блок между маркерами вместе с ними, ведущим отступом строки и
 *  одним переводом строки после. Отступ обязателен: без него в остатке
 *  оставался бы осиротевший таб, и побайтовое сличение врало бы. */
export function stripAtsBlock(text) {
  let i = text.indexOf(MARK_START);
  const j = text.indexOf(MARK_END);
  if (i === -1 || j === -1) return { ok: false, rest: text };
  while (i > 0 && (text[i - 1] === "\t" || text[i - 1] === " ")) i -= 1;
  const end = j + MARK_END.length;
  const after = text.slice(end).startsWith("\n") ? end + 1 : end;
  return { ok: true, rest: text.slice(0, i) + text.slice(after) };
}

/** Настройки сборки по конфигурациям цели. Разбирается ровно то, что
 *  нужно: имя конфигурации, `INFOPLIST_FILE` и наличие базового
 *  `.xcconfig`. */
export function parsePbxproj(text) {
  const configs = [];
  for (const m of text.matchAll(/isa = XCBuildConfiguration;([\s\S]*?)name = (\w+);/g)) {
    const body = m[1];
    configs.push({
      name: m[2],
      infoPlist: body.match(/INFOPLIST_FILE = ([^;]+);/)?.[1]?.trim().replace(/^"|"$/g, "") ?? null,
      baseConfig: /baseConfigurationReference = [^;]*debug\.xcconfig/.test(body),
    });
  }
  return configs;
}

/** Единственное место, где принимается решение. */
export function compare(src) {
  const bad = [];

  // 1. В релизном plist послабления нет вовсе.
  if (src.release === null) bad.push(`${RELEASE_PLIST} — файла нет`);
  else {
    const releaseCode = stripXmlComments(src.release);
    if (releaseCode.includes(ATS_KEY) || releaseCode.includes(ARBITRARY)) {
      bad.push(
        `${RELEASE_PLIST} несёт ${ATS_KEY}/${ARBITRARY} — послабление транспорта уедет в магазинный пакет.\n` +
          `      Место такому блоку одно: ${DEBUG_PLIST}, между маркерами ATS-DEBUG-ONLY.`,
      );
    }
    const httpHit = releaseCode.match(/http:\/\/(?!www\.apple\.com|schemas\.)[^<"\s]+/);
    if (httpHit) bad.push(`${RELEASE_PLIST} несёт незашифрованный адрес ${httpHit[0]}`);
  }

  // 2. Отладочный plist существует и послабление в нём ЕСТЬ.
  if (src.debug === null) {
    bad.push(`${DEBUG_PLIST} — файла нет: развилка не построена, обе конфигурации читали бы один plist`);
  } else if (!stripXmlComments(src.debug).includes(ARBITRARY)) {
    bad.push(
      `${DEBUG_PLIST} не несёт ${ARBITRARY} — живой перезапуск по http:// с ноутбука не заработает вовсе.\n` +
        `      iOS блокирует незашифрованный трафик на уровне системы, флаг server.cleartext этого не отменяет.`,
    );
  }

  // 3. Два plist расходятся ТОЛЬКО блоком ATS.
  if (src.release !== null && src.debug !== null) {
    const stripped = stripAtsBlock(src.debug);
    if (!stripped.ok) {
      bad.push(
        `${DEBUG_PLIST}: не найдены маркеры ${MARK_START} … ${MARK_END} — сличить два файла нечем, ` +
          `и любая правка одного из них разойдётся с другим молча`,
      );
    } else if (stripped.rest !== src.release) {
      bad.push(
        `${DEBUG_PLIST} после вырезания блока ATS не совпадает с ${RELEASE_PLIST} побайтово.\n` +
          `      Витринное имя, строка назначения микрофона и версии живут в обоих файлах; ` +
          `разойдясь, они дадут два разных приложения из одного проекта.`,
      );
    }
  }

  // 4. Конфигурации Xcode читают РАЗНЫЕ plist.
  if (src.pbxproj === null) bad.push(`${PBXPROJ} — файла нет`);
  else {
    const withPlist = src.pbxproj.filter((c) => c.infoPlist !== null);
    if (withPlist.length === 0) bad.push(`${PBXPROJ}: INFOPLIST_FILE не задан ни в одной конфигурации`);
    for (const c of withPlist) {
      const want = c.name === "Debug" ? "App/Info-Debug.plist" : "App/Info.plist";
      if (c.infoPlist !== want) {
        bad.push(
          `${PBXPROJ}: конфигурация ${c.name} читает ${c.infoPlist}, а обязана ${want}.\n` +
            `      Развилка держится именно этой строкой — одинаковые значения возвращают долг 110 целиком.`,
        );
      }
    }
    for (const c of src.pbxproj) {
      if (c.name === "Release" && c.baseConfig) {
        bad.push(`${PBXPROJ}: к конфигурации Release подключён debug.xcconfig — отладочные настройки уедут в релиз`);
      }
    }
  }

  // 5. Молчаливый адрес — боевой HTTPS (общая половина с Android).
  if (src.capacitor === null) bad.push(`${CAPACITOR} — файла нет`);
  else {
    const url = src.capacitor.match(/const PRODUCTION_URL = "([^"]+)"/)?.[1] ?? null;
    if (url === null) bad.push(`${CAPACITOR}: PRODUCTION_URL не найден`);
    else {
      let parsed = null;
      try {
        parsed = new URL(url);
      } catch {
        bad.push(`${CAPACITOR}: PRODUCTION_URL не разбирается как адрес: ${url}`);
      }
      if (parsed) {
        if (parsed.protocol !== "https:") bad.push(`${CAPACITOR}: PRODUCTION_URL не HTTPS: ${url}`);
        if (isPrivateHost(parsed.hostname)) bad.push(`${CAPACITOR}: PRODUCTION_URL — адрес частной сети: ${url}`);
      }
    }
  }

  return bad;
}


// ─────────────────────────────────────────────────────────────────────
// СЛОЙ ПАКЕТА (долг 113, заход 7.181).
//
// Всё выше читает ИСХОДНИКИ. Ни одно правило оттуда не может сказать,
// что попало в СОБРАННЫЙ пакет: `project.pbxproj` здесь разбирается
// регулярными выражениями, а не Xcode, и «Xcode читает INFOPLIST_FILE
// так же, как его прочитал сторож» — это было предположение, а не
// замер. Тот же класс, что у долга 109 на Android: там правку «по
// исходнику» опроверг первый же собранный артефакт.
//
// ЧТО СУДИТСЯ. Не файл проекта, а ВЫВОД ИНСТРУМЕНТА, прочитавшего
// готовый пакет: `plutil -p App.app/Info.plist`. Устройство ровно то
// же, что у соседей по репозиторию, и выбрано не по вкусу:
//   --badging=  у check:apk-facts              (aapt2 по APK)
//   --xmltree=  у check:native-release-safety  (aapt2 по манифесту)
//   --certs=    у check:release-signing        (apksigner/jarsigner)
//   --plist=    здесь                          (plutil по App.app)
// Судья ничего не запускает сам, поэтому его подсадки — чистый текст,
// и они гоняются в CI, где нет ни Xcode, ни macOS, ни пакета.
//
//   xcodebuild -project ios/App/App.xcodeproj -scheme App \
//     -configuration Release -sdk iphoneos -derivedDataPath <dd> \
//     CODE_SIGNING_ALLOWED=NO build
//   plutil -p <dd>/Build/Products/Release-iphoneos/App.app/Info.plist > ios-plist.txt
//   node scripts/check-ios-release-safety.mjs --plist=ios-plist.txt
//
// ЧЕГО ЭТОТ СЛОЙ НЕ ДОКАЗЫВАЕТ И НЕ МОЖЕТ. Пакет собран БЕЗ подписи:
// `security find-identity -v -p codesigning` на этой машине отдаёт
// «0 valid identities found» — учётной записи Apple Developer Program
// у проекта пока нет. Значит `.ipa`, подписанный дистрибутивной
// личностью, не собирался и здесь не судится, а долг 140
// (`CODE_SIGN_IDENTITY = "iPhone Developer"`, пустой
// `DEVELOPMENT_TEAM`) этим слоем не закрывается. Эта половина ждёт
// владельца, а не машину, и записана так в таблице долгов.
const BUNDLE_ID = "com.rusofacilapp.app";
const GRADLE = "android/app/build.gradle";

/** Плоские значения из вывода `plutil -p`: `"CFBundleVersion" => "1"`.
 *  Вложенные словари (иконки, сцены) не разбираются намеренно — ни одно
 *  правило ниже о них не спрашивает, а полу-разбор врал бы молча. */
export function parsePlutil(text) {
  const out = {};
  const re = /^\s*"([^"]+)"\s*=>\s*(.*)$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[2].trim();
    if (raw === "{" || raw === "[") continue;
    out[m[1]] = raw.replace(/^"(.*)"$/, "$1");
  }
  return out;
}

/** Похоже ли это вообще на вывод `plutil -p`. Отдельным вопросом, а не
 *  «ключей не нашлось»: пустой разбор чужого текста дал бы «расхождений
 *  0» на любом файле, и молчание читалось бы как «в пакете чисто». */
export function isPlutilOutput(text) {
  return /^\s*\{/.test(text) && /"CFBundle\w+"\s*=>/.test(text);
}

/**
 * Приговор по СОБРАННОМУ пакету. `inputs` — список `{ name, text }`,
 * где text — дословный вывод `plutil -p`. `versions` — то, что стоит в
 * `android/app/build.gradle`: у одного релиза номер обязан быть один на
 * оба магазина, и проверяется это на пакете, а не на файле проекта.
 */
export function judgeBundle(inputs, versions) {
  const bad = [];
  const facts = { checked: 0, identifiers: [], shortVersions: [], versions: [] };

  if (inputs.length === 0) {
    bad.push(
      "слою пакета не дали ни одного plist: без --plist=<файл> доказывать нечего, " +
        "а «расхождений 0» на пустом входе — это не проверка",
    );
    return { bad, facts };
  }

  for (const { name, text } of inputs) {
    if (!isPlutilOutput(text)) {
      bad.push(
        `${name}: это не вывод plutil -p — судить не о чем, а молчание здесь читалось бы ` +
          "как «в собранном пакете чисто»",
      );
      continue;
    }
    facts.checked += 1;

    // 1. Послабления транспорта в ПАКЕТЕ нет. Ровно то, что на исходниках
    //    доказать было нельзя: Info-Debug.plist лежит рядом, и вопрос был
    //    в том, какой из двух файлов возьмёт Xcode.
    if (new RegExp(`"?(${ATS_KEY}|${ARBITRARY})"?`).test(text)) {
      bad.push(
        `${name}: в собранном пакете есть ${ATS_KEY}/${ARBITRARY} — послабление транспорта ` +
          "доехало до магазинного артефакта, и поймало бы это ревью Apple, а не мы",
      );
    }

    const kv = parsePlutil(text);

    // 2. Тот ли это пакет. Идентификатор — то единственное, что
    //    связывает артефакт с записью в App Store Connect и с
    //    `apple-app-site-association` (долг 71); разойдясь, он даёт
    //    загрузку «не в то приложение».
    const id = kv.CFBundleIdentifier ?? null;
    if (id === null) bad.push(`${name}: CFBundleIdentifier в пакете не прочитан`);
    else {
      facts.identifiers.push(id);
      if (id !== BUNDLE_ID) {
        bad.push(
          `${name}: CFBundleIdentifier = ${id}, а обязан ${BUNDLE_ID} — ` +
            "артефакт уехал бы не в то приложение App Store Connect",
        );
      }
    }

    // 3. Версия одна на две платформы, и сличается она с Android по
    //    ПАКЕТУ. Слой исходников сличает pbxproj с build.gradle; здесь
    //    проверяется, что Xcode действительно положил в пакет то самое.
    const short = kv.CFBundleShortVersionString ?? null;
    const build = kv.CFBundleVersion ?? null;
    if (short === null) bad.push(`${name}: CFBundleShortVersionString в пакете не прочитан`);
    else {
      facts.shortVersions.push(short);
      if (versions?.versionName && short !== versions.versionName) {
        bad.push(
          `${name}: CFBundleShortVersionString = ${short}, а versionName в ${GRADLE} = ` +
            `"${versions.versionName}" — у одного релиза две разные витринные версии`,
        );
      }
    }
    if (build === null) bad.push(`${name}: CFBundleVersion в пакете не прочитан`);
    else {
      facts.versions.push(build);
      if (versions?.versionCode && build !== versions.versionCode) {
        bad.push(
          `${name}: CFBundleVersion = ${build}, а versionCode в ${GRADLE} = ` +
            `${versions.versionCode} — у одного релиза два разных номера сборки`,
        );
      }
    }
  }

  return { bad, facts };
}

/** ОБРАЗЕЦ ДЛЯ ПОДСАДОК — ДОСЛОВНЫЙ ВЫВОД `plutil -p` ПО НАСТОЯЩЕМУ
 *  ПАКЕТУ, СОБРАННОМУ 11.09.2026. Не выдуман и не сокращён.
 *  Артефакт: Release-iphoneos/App.app, 31 МБ, Info.plist внутри 2 154 Б,
 *  собран `xcodebuild -configuration Release -sdk iphoneos` за 1 мин 57 с,
 *  BUILD SUCCEEDED, без подписи (личностей для подписи на машине 0).
 *  Держать образец в файле, а не читать с диска, обязательно: подсадки
 *  гоняются в CI, где ни Xcode, ни macOS, ни пакета нет. */
export const BUNDLE_PLIST_SAMPLE = "{\n  \"BuildMachineOSBuild\" => \"24G90\"\n  \"CAPACITOR_DEBUG\" => \"\"\n  \"CFBundleDevelopmentRegion\" => \"en\"\n  \"CFBundleDisplayName\" => \"RusoFácil\"\n  \"CFBundleExecutable\" => \"App\"\n  \"CFBundleIcons\" => {\n    \"CFBundlePrimaryIcon\" => {\n      \"CFBundleIconFiles\" => [\n        0 => \"AppIcon60x60\"\n      ]\n      \"CFBundleIconName\" => \"AppIcon\"\n    }\n  }\n  \"CFBundleIcons~ipad\" => {\n    \"CFBundlePrimaryIcon\" => {\n      \"CFBundleIconFiles\" => [\n        0 => \"AppIcon60x60\"\n        1 => \"AppIcon76x76\"\n      ]\n      \"CFBundleIconName\" => \"AppIcon\"\n    }\n  }\n  \"CFBundleIdentifier\" => \"com.rusofacilapp.app\"\n  \"CFBundleInfoDictionaryVersion\" => \"6.0\"\n  \"CFBundleName\" => \"RusoFácil\"\n  \"CFBundlePackageType\" => \"APPL\"\n  \"CFBundleShortVersionString\" => \"1.0\"\n  \"CFBundleSupportedPlatforms\" => [\n    0 => \"iPhoneOS\"\n  ]\n  \"CFBundleVersion\" => \"1\"\n  \"DTCompiler\" => \"com.apple.compilers.llvm.clang.1_0\"\n  \"DTPlatformBuild\" => \"22F76\"\n  \"DTPlatformName\" => \"iphoneos\"\n  \"DTPlatformVersion\" => \"18.5\"\n  \"DTSDKBuild\" => \"22F76\"\n  \"DTSDKName\" => \"iphoneos18.5\"\n  \"DTXcode\" => \"1640\"\n  \"DTXcodeBuild\" => \"16F6\"\n  \"LSRequiresIPhoneOS\" => 1\n  \"MinimumOSVersion\" => \"15.0\"\n  \"NSMicrophoneUsageDescription\" => \"RusoFácilapp usa el micrófono para grabar tu pronunciación en los ejercicios de lectura y vocabulario y reproducírtela enseguida, para que puedas compararla con la del hablante nativo.\"\n  \"UIApplicationSceneManifest\" => {\n    \"UIApplicationSupportsMultipleScenes\" => 0\n    \"UISceneConfigurations\" => {\n      \"UIWindowSceneSessionRoleApplication\" => [\n        0 => {\n          \"UISceneConfigurationName\" => \"Default Configuration\"\n          \"UISceneDelegateClassName\" => \"App.SceneDelegate\"\n          \"UISceneStoryboardFile\" => \"Main\"\n        }\n      ]\n    }\n  }\n  \"UIBackgroundModes\" => [\n    0 => \"audio\"\n  ]\n  \"UIDeviceFamily\" => [\n    0 => 1\n    1 => 2\n  ]\n  \"UILaunchStoryboardName\" => \"LaunchScreen\"\n  \"UIMainStoryboardFile\" => \"Main\"\n  \"UIRequiredDeviceCapabilities\" => [\n    0 => \"arm64\"\n  ]\n  \"UISupportedInterfaceOrientations\" => [\n    0 => \"UIInterfaceOrientationPortrait\"\n    1 => \"UIInterfaceOrientationLandscapeLeft\"\n    2 => \"UIInterfaceOrientationLandscapeRight\"\n  ]\n  \"UISupportedInterfaceOrientations~ipad\" => [\n    0 => \"UIInterfaceOrientationPortrait\"\n    1 => \"UIInterfaceOrientationPortraitUpsideDown\"\n    2 => \"UIInterfaceOrientationLandscapeLeft\"\n    3 => \"UIInterfaceOrientationLandscapeRight\"\n  ]\n  \"UIViewControllerBasedStatusBarAppearance\" => 1\n}\n";

/** versionCode и versionName из build.gradle — те же два числа, что
 *  сличает `check:release-signing` на слое исходников. Читаются здесь
 *  заново, а не импортируются: сторож обязан судить, ничего не
 *  импортируя из проверяемого. */
export function androidVersions(gradle) {
  return {
    versionCode: gradle?.match(/^\s*versionCode\s+(\d+)/m)?.[1] ?? null,
    versionName: gradle?.match(/^\s*versionName\s+"([^"]+)"/m)?.[1] ?? null,
  };
}

const read = (f) => (existsSync(f) ? readFileSync(f, "utf-8") : null);

function readSources() {
  const pbx = read(PBXPROJ);
  return {
    release: read(RELEASE_PLIST),
    debug: read(DEBUG_PLIST),
    pbxproj: pbx === null ? null : parsePbxproj(pbx),
    capacitor: read(CAPACITOR),
  };
}

/** Подсадки СЛОЯ ПАКЕТА. Вход у них — дословный вывод `plutil -p` по
 *  настоящему собранному App.app, поэтому они гоняются везде, где
 *  гоняется node, и ничего не собирают сами. */
function plantBundle() {
  console.log("check:ios-release-safety --plant — слой пакета:");

  const versions = { versionCode: "1", versionName: "1.0" };
  const healthy = [{ name: "App.app/Info.plist", text: BUNDLE_PLIST_SAMPLE }];
  // Отрицательный контроль ПЕРВЫМ и на настоящем пакете: молчание здесь —
  // условие того, что все жалобы ниже вызваны подсадкой, а не образцом.
  const clean = judgeBundle(healthy, versions).bad;
  const isNew = (bad) => bad.some((line) => !clean.includes(line));

  const plants = [
    [
      // РОВНО ДОЛГ 110, но на СОБРАННОМ пакете: до этого слоя доказать,
      // что послабление не доехало, было нечем.
      "послабление транспорта доехало до пакета",
      () =>
        judgeBundle(
          [
            {
              name: "App.app/Info.plist",
              text: BUNDLE_PLIST_SAMPLE.replace(
                '  "CFBundleIdentifier"',
                '  "NSAppTransportSecurity" => {\n    "NSAllowsArbitraryLoads" => 1\n  }\n  "CFBundleIdentifier"',
              ),
            },
          ],
          versions,
        ),
    ],
    [
      "в пакете ЧУЖОЙ идентификатор",
      () =>
        judgeBundle(
          [
            {
              name: "App.app/Info.plist",
              text: BUNDLE_PLIST_SAMPLE.replace(BUNDLE_ID, "com.example.someoneelse"),
            },
          ],
          versions,
        ),
    ],
    [
      "витринная версия пакета разошлась с versionName Android",
      () =>
        judgeBundle(
          [
            {
              name: "App.app/Info.plist",
              text: BUNDLE_PLIST_SAMPLE.replace('"CFBundleShortVersionString" => "1.0"', '"CFBundleShortVersionString" => "2.5"'),
            },
          ],
          versions,
        ),
    ],
    [
      "номер сборки пакета разошёлся с versionCode Android",
      () =>
        judgeBundle(
          [
            {
              name: "App.app/Info.plist",
              text: BUNDLE_PLIST_SAMPLE.replace('"CFBundleVersion" => "1"', '"CFBundleVersion" => "42"'),
            },
          ],
          versions,
        ),
    ],
    [
      "идентификатор из пакета пропал вовсе",
      () =>
        judgeBundle(
          [
            {
              name: "App.app/Info.plist",
              text: BUNDLE_PLIST_SAMPLE.replace(/^\s*"CFBundleIdentifier".*$/m, ""),
            },
          ],
          versions,
        ),
    ],
    [
      "вместо вывода plutil подсунут чужой текст",
      () => judgeBundle([{ name: "подставной.txt", text: "всё хорошо, честное слово\n" }], versions),
    ],
    [
      "слою пакета не дали ни одного plist",
      () => judgeBundle([], versions),
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
  const f = judgeBundle(healthy, versions).facts;
  console.log(
    `  ${quiet ? `отрицательный контроль: настоящий App.app — молчание (${f.identifiers[0]}, ${f.shortVersions[0]}/${f.versions[0]}, ${ATS_KEY} в пакете 0)` : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН: ${clean.join("; ")}`}`,
  );
  console.log(`  поймано ${caught} из ${plants.length}`);
  return caught === plants.length && quiet;
}

function main() {
  const src = readSources();

  // СЛОЙ ПАКЕТА. Отдельным входом, а не «заодно»: собранного App.app на
  // машине разработчика и в CI может не быть вовсе (для него нужен macOS
  // с Xcode), а правила по исходникам обязаны гоняться всегда. Зато
  // когда вход дан — молчания «нечего проверять» не бывает: пустой
  // список тоже жалоба.
  const plistArgs = process.argv.filter((a) => a.startsWith("--plist="));
  if (plistArgs.length > 0) {
    const inputs = [];
    for (const arg of plistArgs) {
      const file = arg.slice("--plist=".length);
      if (!existsSync(file)) {
        console.error(`РАСХОЖДЕНИЕ: ${file} — файла с выводом plutil -p нет`);
        process.exit(1);
      }
      inputs.push({ name: file, text: readFileSync(file, "utf-8") });
    }
    const versions = androidVersions(read(GRADLE));
    const { bad, facts } = judgeBundle(inputs, versions);
    if (bad.length > 0) {
      for (const line of bad) console.error(`РАСХОЖДЕНИЕ: ${line}`);
      process.exit(1);
    }
    console.log(
      `check:ios-release-safety (слой пакета) — пакетов прочитано ${facts.checked}, ` +
        `${ATS_KEY} в пакете 0, CFBundleIdentifier ${facts.identifiers.join(" ")}, ` +
        `CFBundleShortVersionString ${facts.shortVersions.join(" ")} = versionName "${versions.versionName}", ` +
        `CFBundleVersion ${facts.versions.join(" ")} = versionCode ${versions.versionCode} (${GRADLE}).`,
    );
    process.exit(0);
  }

  if (process.argv.includes("--plant")) {
    console.log("check:ios-release-safety --plant");
    const pbxRaw = read(PBXPROJ) ?? "";
    const plants = [
      [
        "ровно долг 110: послабление ATS вернулось в релизный plist",
        { ...src, release: (src.release ?? "").replace("</dict>\n</plist>", `\t<key>${ATS_KEY}</key>\n\t<dict>\n\t\t<key>${ARBITRARY}</key>\n\t\t<true/>\n\t</dict>\n</dict>\n</plist>`) },
      ],
      [
        "отладочного plist нет — обе конфигурации читают один файл",
        { ...src, debug: null },
      ],
      [
        "послабление пропало из отладочного plist — живой перезапуск мёртв",
        // Именно `<key>…</key>`, а не первое вхождение слова: слово стоит
        // и в объяснении правки, скопированном из `Info.plist`, и подмена
        // там сломала бы побайтовое сличение вместо правила 2.
        { ...src, debug: (src.debug ?? "").replace(`<key>${ARBITRARY}</key>`, "<key>NSAllowsLocalNetworking</key>") },
      ],
      [
        // Значение подсадки — незаполненный шаблон, а НЕ опечатка имени:
        // опечатку запрещает `check:brand`, и она уронила бы `verify` из
        // самого текста этого файла (поймано им же 09.09.2026, как и
        // раньше в `check-apk-facts.mjs`). Смысл подсадки тот же: два
        // plist разошлись витринным именем.
        "два plist разошлись витринным именем",
        {
          ...src,
          debug: (src.debug ?? "").replace(
            "<key>CFBundleName</key>\n\t<string>",
            "<key>CFBundleName</key>\n\t<string>$(PRODUCT_NAME)</string>\n\t<string>",
          ),
        },
      ],
      [
        "маркеры вырезания стёрты — сличать нечем",
        { ...src, debug: (src.debug ?? "").replace(MARK_START, "<!-- было -->") },
      ],
      [
        "конфигурация Debug вернулась на общий Info.plist",
        { ...src, pbxproj: parsePbxproj(pbxRaw.replace("INFOPLIST_FILE = App/Info-Debug.plist;", "INFOPLIST_FILE = App/Info.plist;")) },
      ],
      [
        "к Release подключён debug.xcconfig",
        {
          ...src,
          pbxproj: (src.pbxproj ?? []).map((c) => (c.name === "Release" ? { ...c, baseConfig: true } : c)),
        },
      ],
      [
        "молчаливый адрес снова из домашней сети",
        { ...src, capacitor: (src.capacitor ?? "").replace(/const PRODUCTION_URL = "[^"]+"/, 'const PRODUCTION_URL = "http://192.168.1.69:3000"') },
      ],
    ];
    // Подсадка засчитывается, только если она добавила жалобу, которой на
    // ЧИСТЫХ исходниках нет. Иначе одна застарелая краснота засчитала бы
    // за пойманное всё подряд — ровно это и случилось на первом прогоне
    // этого файла 09.09.2026.
    const cleanBad = compare(src);
    const cleanSet = new Set(cleanBad);
    let caught = 0;
    for (const [name, mutated] of plants) {
      const fresh = compare(mutated).filter((b) => !cleanSet.has(b));
      const hit = fresh.length > 0;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${name}${hit ? ` → ${fresh[0].split("\n")[0]}` : ""}`);
      if (hit) caught += 1;
    }
    const quiet = cleanBad.length === 0;
    console.log(
      `  ${quiet ? "отрицательный контроль: настоящие исходники — молчание" : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН: ${cleanBad.join("; ")}`}`,
    );
    console.log(`  поймано ${caught} из ${plants.length}`);
    const pkg = plantBundle();
    process.exit(caught === plants.length && quiet && pkg ? 0 : 1);
  }

  const bad = compare(src);
  const configs = (src.pbxproj ?? []).filter((c) => c.infoPlist !== null);
  for (const c of configs) console.log(`Xcode: конфигурация ${c.name} → ${c.infoPlist}`);
  console.log(`${RELEASE_PLIST}: ${ATS_KEY} ${src.release?.includes(ATS_KEY) ? "ЕСТЬ" : "нет"}`);
  console.log(`${DEBUG_PLIST}: ${ARBITRARY} ${src.debug?.includes(ARBITRARY) ? "есть" : "НЕТ"}`);

  if (bad.length === 0) {
    console.log(
      "check:ios-release-safety — послабление транспорта живёт только в отладочном plist, " +
        "два файла расходятся ровно одним блоком, конфигурации разведены, молчаливый адрес — боевой HTTPS; расхождений 0.\n" +
        "  ЧИТАЕТ ИСХОДНИКИ, А НЕ .ipa: слоя пакета у iOS нет — Xcode на машине нет (долг 110 в этой части остаётся).",
    );
    process.exit(0);
  }
  for (const line of bad) console.error(`РАСХОЖДЕНИЕ: ${line}`);
  process.exit(1);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) main();
