// Что код просит у устройства — то и объявлено в нативных манифестах. И
// ничего сверх того.
//
// ПОЧЕМУ ЭТО СУЩЕСТВУЕТ (долг 72). `VoiceRecorder.tsx` зовёт
// `navigator.mediaDevices.getUserMedia({ audio: true })`, а разрешение на
// микрофон не было объявлено НИ НА ОДНОЙ платформе: в
// `ios/App/App/Info.plist` не было ни одного ключа `*UsageDescription`
// вовсе, в `AndroidManifest.xml` стояло ровно одно разрешение — INTERNET.
// Цена разная и обе плохие: на iOS отсутствие строки назначения — это не
// отказ, а ЗАВЕРШЕНИЕ ПРОЦЕССА по правилу системы (приложение падает на
// первом нажатии «записать»), на Android `getUserMedia` отказывает молча
// и студент видит «доступ запрещён» без единого запроса.
//
// НА ВЕБЕ ЭТОТ ДЕФЕКТ НЕ ВОСПРОИЗВОДИТСЯ И НИКОГДА НЕ ВОСПРОИЗВЁЛСЯ БЫ:
// там разрешение спрашивает браузер, а наши манифесты не участвуют. Ни
// один прогон Playwright не мог его увидеть — поэтому сторож статический
// и читает манифесты, а не страницу.
//
// ОТДЕЛЬНО ПРО ANDROID, И ЭТО НЕ ТО, ЧТО ГОВОРИТ ФОРМУЛИРОВКА ДОЛГА.
// Одного `RECORD_AUDIO` не хватает. `BridgeWebChromeClient.onPermissionRequest`
// из `@capacitor/android` на запрос `android.webkit.resource.AUDIO_CAPTURE`
// просит СРАЗУ ДВА разрешения — `MODIFY_AUDIO_SETTINGS` и `RECORD_AUDIO`, —
// а его колбэк считает выдачу успешной, только если разрешены ВСЕ
// запрошенные (`granted = false` при первом же false в карте ответов).
// Разрешение, не объявленное в манифесте, система возвращает как
// отказанное молча, без диалога. То есть объявить одно `RECORD_AUDIO`
// значило бы починить долг наполовину и оставить рекордер сломанным.
// Проверено чтением исходника плагина в `node_modules/@capacitor/android`.
//
// ЧТО ПРОВЕРЯЕТСЯ — РАВЕНСТВО В ОБЕ СТОРОНЫ:
//
//   использует код  →  объявлено на iOS И на Android
//   объявлено       →  код это использует
//
// Вторая половина не украшение: анкета App Privacy и форма «Безопасность
// данных» в Play Console спрашивают про КАЖДОЕ объявленное разрешение, и
// лишнее приходится либо объяснять, либо получать отказ ревью. Лишнее
// разрешение — такое же падение, как недостающее.
//
// Плюс качество строки назначения на iOS: пустую или шаблонную
// (`$(...)`) строку Apple отклоняет, а короткую отбивает на ревью
// требованием объяснить, ЗАЧЕМ.
//
// СЛЕПОТА, ОПЛАЧЕННАЯ 09.09.2026 (долг 107). Всё, что описано выше,
// читало НАШ манифест — а Play Console спрашивает про каждое разрешение
// В ЗАГРУЖЕННОМ ПАКЕТЕ. Первая же настоящая сборка (7.157) показала цену:
// наш манифест объявлял ТРИ разрешения, собранный APK нёс ДВЕНАДЦАТЬ.
// Девять приносило слияние манифестов библиотек, и этот сторож не мог
// увидеть их ПО ПОСТРОЕНИЮ — он смотрел не туда, куда смотрит анкета.
//
// Поэтому у него теперь два входа, и правило у обоих одно:
//
//   без флагов          — множество разрешений берётся из
//                         `android/app/src/main/AndroidManifest.xml`
//                         (страховка: гоняется где угодно, инструментов
//                         не требует)
//   --badging=<файл>    — множество берётся из СОБРАННОГО APK
//                         (`aapt2 dump badging`), то есть ровно то, что
//                         увидит Play Console. Гоняется в
//                         `.github/workflows/android-debug.yml`.
//
// Во втором режиме к `ALWAYS_ALLOWED` добавляется список разрешений,
// принесённых библиотеками. Он не переписан сюда руками, а ИМПОРТИРОВАН
// из `scripts/check-apk-facts.mjs`: два списка одного и того же разошлись
// бы на первой же смене зависимости, и второй экземпляр начал бы врать.
//
// Сторож смотрит только на ОТСЛЕЖИВАЕМЫЕ файлы (`git ls-files`) — по той
// же причине, что и `check:brand`: прогон до `git add` про новый файл не
// говорит ничего (оплачено на PR #226).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ALLOWED_MERGED, parseBadging, splitPermissions } from "./check-apk-facts.mjs";

const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

const PLIST = "ios/App/App/Info.plist";
const MANIFEST = "android/app/src/main/AndroidManifest.xml";

/** Минимальная длина строки назначения на iOS. Apple не публикует числа,
 *  но отклоняет строки вида «Need mic»: строка обязана назвать, ЧТО
 *  приложение делает. 40 знаков — это примерно одно осмысленное
 *  предложение по-испански и заведомо больше любой отписки. */
const MIN_PURPOSE = 40;

/** Каждая способность: чем она видна в коде, и чем объявляется на каждой
 *  платформе. Список закрытый — способность, которой здесь нет, сторож не
 *  видит, и это записано, а не подразумевается. */
const CAPABILITIES = [
  {
    id: "микрофон",
    // `{ audio: true }` внутри вызова getUserMedia. Ищется именно вызов, а
    // не слово: проверка наличия (`if (!navigator.mediaDevices?.getUserMedia)`)
    // способность не использует.
    used: /getUserMedia\s*\(\s*\{[^)}]*\baudio\s*:\s*(?:true|\{)/,
    ios: "NSMicrophoneUsageDescription",
    // Оба, а не одно: см. абзац про Capacitor в шапке.
    android: ["android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS"],
  },
  {
    id: "камера",
    used: /getUserMedia\s*\(\s*\{[^)}]*\bvideo\s*:\s*(?:true|\{)/,
    ios: "NSCameraUsageDescription",
    android: ["android.permission.CAMERA"],
  },
  {
    id: "геопозиция",
    used: /navigator\.geolocation\b/,
    ios: "NSLocationWhenInUseUsageDescription",
    android: ["android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"],
  },
  {
    id: "фотоплёнка",
    used: /navigator\.mediaDevices\.getDisplayMedia|@capacitor\/camera/,
    ios: "NSPhotoLibraryUsageDescription",
    android: ["android.permission.READ_MEDIA_IMAGES"],
  },
];

/** СВЯЗКА ДВУХ ПОЛОВИН ОДНОЙ ПРАВКИ (долг 107, 09.09.2026).
 *
 *  `SCHEDULE_EXACT_ALARM` вычеркнут из пакета `tools:node="remove"`. Это
 *  безопасно ровно до тех пор, пока код НЕ просит точный будильник:
 *  `isExactNotification` у @capacitor/local-notifications по умолчанию
 *  `true`, и при невыданном праве плагин ОТКРЫВАЕТ системный экран
 *  «Alarms & reminders» на каждом `schedule()` — то есть на каждом запуске
 *  приложения (`NativeNotifications.tsx`).
 *
 *  Две половины лежат в разных файлах и разных языках, поэтому связать их
 *  может только правило. Уберут `isExactNotification: false` — сторож
 *  скажет об этом здесь, а не ученик системными настройками в лицо. */
const EXACT_ALARM = "android.permission.SCHEDULE_EXACT_ALARM";
const NOTIFICATIONS_SOURCE = "src/lib/notifications.ts";

function exactAlarmCoupling(manifestText) {
  const { removedPermissions } = splitPermissions(manifestText);
  if (!removedPermissions.has(EXACT_ALARM)) return null;
  const code = read(NOTIFICATIONS_SOURCE);
  if (code === null) return `${NOTIFICATIONS_SOURCE} — файла нет, а ${EXACT_ALARM} вычеркнут из пакета`;
  if (/isExactNotification\s*:\s*false/.test(stripComments(code))) return null;
  return (
    `${EXACT_ALARM} вычеркнут из пакета tools:node="remove", но в ${NOTIFICATIONS_SOURCE} нет ` +
    `isExactNotification: false.\n      Умолчание плагина — true: при невыданном праве он открывает ` +
    `системный экран «Alarms & reminders» на КАЖДОМ запуске приложения.`
  );
}

/** Разрешения, которые объявлены не ради способности из таблицы выше, а
 *  потому что без них приложение не работает вовсе. Каждое — с причиной. */
const ALWAYS_ALLOWED = new Map([
  ["android.permission.INTERNET", "оболочка грузит удалённый URL — без сети приложения нет вовсе"],
]);

function tracked() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
}

const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : null);

/** Комментарии выкусываются ДО поиска: упоминание `navigator.geolocation`
 *  в объяснении, почему мы его не зовём, — это не вызов, и требовать под
 *  него разрешение было бы ложной краснотой. */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Что код действительно просит у устройства. */
function usage(files) {
  const sources = files.filter((f) => f.startsWith("src/") && /\.(ts|tsx|js|jsx|mjs)$/.test(f));
  const hits = new Map(CAPABILITIES.map((c) => [c.id, []]));
  for (const file of sources) {
    const code = stripComments(read(file) ?? "");
    for (const cap of CAPABILITIES) {
      const m = code.match(cap.used);
      if (m) hits.get(cap.id).push(file);
    }
  }
  return { hits, scanned: sources.length };
}

/** Что объявлено на iOS: ключ → строка назначения. */
function iosDeclared() {
  const text = read(PLIST);
  if (text === null) return null;
  const out = new Map();
  for (const m of text.matchAll(/<key>(NS\w*UsageDescription)<\/key>\s*<string>([\s\S]*?)<\/string>/g)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** Что объявлено на Android — по НАШЕМУ манифесту.
 *
 *  Строки с `tools:node="remove"` сюда не попадают: они не объявляют
 *  разрешение, а вычёркивают принесённое библиотекой (долг 107). */
function androidDeclared() {
  const text = read(MANIFEST);
  if (text === null) return null;
  return splitPermissions(text).permissions;
}

/** Что лежит В СОБРАННОМ ПАКЕТЕ. Именно это множество видит Play Console.
 *
 *  Подстановка `${applicationId}`: `androidx.core` объявляет своё
 *  разрешение через неё, и в пакете оно уже развёрнуто. Сравнивать надо
 *  развёрнутые имена с развёрнутыми. */
function androidInApk(badgingText, applicationId) {
  return parseBadging(badgingText).permissions;
}

/** Разрешения, принесённые библиотеками, — список ОДИН на два сторожа:
 *  импортирован из check-apk-facts.mjs, а не переписан. */
function mergedAllowances(applicationId) {
  const out = new Map();
  for (const [name, from] of ALLOWED_MERGED) {
    out.set(name.replace("${applicationId}", applicationId), `принесено библиотекой ${from}`);
  }
  return out;
}

function scan(apk = null) {
  const files = tracked();
  const failures = [];
  const { hits, scanned } = usage(files);
  const ios = iosDeclared();
  const android = apk ? androidInApk(apk.badging, apk.applicationId) : androidDeclared();
  const extraAllowed = apk ? mergedAllowances(apk.applicationId) : new Map();

  if (ios === null) return { failures: [`${PLIST} — файла нет`], scanned, rows: [] };
  if (android === null) return { failures: [`${MANIFEST} — файла нет`], scanned, rows: [] };

  const rows = [];
  for (const cap of CAPABILITIES) {
    const users = hits.get(cap.id);
    const used = users.length > 0;
    const iosHas = ios.has(cap.ios);
    const androidHas = cap.android.filter((p) => android.has(p));

    rows.push({ id: cap.id, used, users, iosHas, androidHas: androidHas.length, androidNeeds: cap.android.length });

    if (used && !iosHas) {
      failures.push(
        `iOS: способность «${cap.id}» используется (${users.join(", ")}), а ключ ${cap.ios} в ${PLIST} отсутствует.\n` +
          `      Это не отказ, а завершение процесса: система убивает приложение при первом обращении.`,
      );
    }
    if (used && androidHas.length < cap.android.length) {
      const gone = cap.android.filter((p) => !android.has(p));
      failures.push(
        `Android: способность «${cap.id}» используется (${users.join(", ")}), а в ${MANIFEST} нет ${gone.join(", ")}.\n` +
          `      Необъявленное разрешение система возвращает отказанным БЕЗ диалога, и getUserMedia отказывает молча.`,
      );
    }
    if (!used && iosHas) {
      failures.push(
        `iOS: ключ ${cap.ios} объявлен, а способность «${cap.id}» кодом не используется.\n` +
          `      Лишнее разрешение придётся объяснять в анкете App Privacy — уберите ключ или назовите вызов.`,
      );
    }
    if (!used && androidHas.length) {
      failures.push(
        `Android: объявлено ${androidHas.join(", ")}, а способность «${cap.id}» кодом не используется.\n` +
          `      Лишнее разрешение спрашивает форма «Безопасность данных» в Play Console.`,
      );
    }
    if (iosHas) {
      const purpose = ios.get(cap.ios);
      if (!purpose) {
        failures.push(`iOS: строка назначения у ${cap.ios} пуста — Apple такую сборку отклоняет на загрузке.`);
      } else if (/^\$\(.*\)$/.test(purpose)) {
        failures.push(`iOS: строка назначения у ${cap.ios} — незаполненный шаблон «${purpose}».`);
      } else if (purpose.length < MIN_PURPOSE) {
        failures.push(
          `iOS: строка назначения у ${cap.ios} — ${purpose.length} знаков, нужно не меньше ${MIN_PURPOSE}: «${purpose}».\n` +
            `      Строка обязана назвать, ЧТО приложение делает с доступом, а не просто попросить его.`,
        );
      }
    }
  }

  // Разрешения Android, не относящиеся ни к одной способности из таблицы
  // и не названные в ALWAYS_ALLOWED: таблица закрытая, и молчать о том,
  // чего она не знает, — то же самое, что не проверять.
  const known = new Set(CAPABILITIES.flatMap((c) => c.android));
  for (const p of android) {
    if (known.has(p) || ALWAYS_ALLOWED.has(p) || extraAllowed.has(p)) continue;
    failures.push(
      `Android: разрешение ${p} ${apk ? "лежит в СОБРАННОМ ПАКЕТЕ" : "объявлено"}, но не относится ни к одной способности из таблицы сторожа.\n` +
        `      Либо заведите способность в CAPABILITIES, либо причину в ALWAYS_ALLOWED, либо уберите разрешение.` +
        (apk ? "\n      Разрешение, приехавшее с новой зависимостью, спросит анкета «Безопасность данных» в Play Console." : ""),
    );
  }
  // То же для iOS.
  const knownIos = new Set(CAPABILITIES.map((c) => c.ios));
  for (const k of ios.keys()) {
    if (knownIos.has(k)) continue;
    failures.push(`iOS: ключ ${k} объявлен, но не относится ни к одной способности из таблицы сторожа.`);
  }

  const coupling = exactAlarmCoupling(read(MANIFEST) ?? "");
  if (coupling) failures.push(`Android: ${coupling}`);

  return { failures, scanned, rows, fromApk: Boolean(apk), androidCount: android.size };
}

function report(r) {
  if (r.failures.length) {
    console.error("check:native-permissions — FAILED\n");
    for (const f of r.failures) console.error(`  ${f}\n`);
    return false;
  }
  const used = r.rows.filter((x) => x.used);
  console.log(
    `check:native-permissions — ${r.scanned} файлов кода прочитано; ` +
      `способностей в таблице ${r.rows.length}, используется ${used.length} ` +
      `(${used.map((x) => x.id).join(", ") || "ни одной"}), ` +
      `и каждая объявлена на обеих платформах; лишних разрешений нет ни на одной. ` +
      (r.fromApk
        ? `Разрешения Android взяты ИЗ СОБРАННОГО APK: ${r.androidCount} — то самое множество, про которое спрашивает Play Console.`
        : `Разрешения Android взяты из нашего манифеста: ${r.androidCount}. Слой пакета — в .github/workflows/android-debug.yml.`),
  );
  return true;
}

// `--plant` — позитивный контроль, и он бьёт в обе стороны правила.
function plantControls() {
  const swap = (file, from, to) => {
    const before = read(file);
    if (before === null || !before.includes(from)) throw new Error(`подсадка не легла: в ${file} нет «${from}»`);
    writeFileSync(file, before.replace(from, to));
    return () => writeFileSync(file, before);
  };

  const PLANTED = "src/__native-permission-plant__.generated.ts";
  const controls = [
    {
      name: "iOS: ключ микрофона убран, а рекордер остался",
      plant: () => {
        const text = read(PLIST);
        const m = text.match(/\t*<key>NSMicrophoneUsageDescription<\/key>\n\t*<string>[\s\S]*?<\/string>\n/);
        if (!m) throw new Error("подсадка не легла: в Info.plist нет NSMicrophoneUsageDescription");
        writeFileSync(PLIST, text.replace(m[0], ""));
        return () => writeFileSync(PLIST, text);
      },
      expect: (r) =>
        r.failures.some(
          (m) => m.startsWith("iOS:") && m.includes("NSMicrophoneUsageDescription") && m.includes("отсутствует"),
        ),
    },
    {
      name: "Android: RECORD_AUDIO убран, а рекордер остался",
      plant: () =>
        swap(MANIFEST, '<uses-permission android:name="android.permission.RECORD_AUDIO" />', ""),
      expect: (r) => r.failures.some((m) => m.startsWith("Android:") && m.includes("RECORD_AUDIO")),
    },
    {
      name: "Android: убран только MODIFY_AUDIO_SETTINGS — половинчатая правка долга 72",
      plant: () =>
        swap(MANIFEST, '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />', ""),
      expect: (r) => r.failures.some((m) => m.includes("MODIFY_AUDIO_SETTINGS")),
    },
    {
      name: "iOS: строка назначения заменена отпиской в три слова",
      plant: () => {
        const text = read(PLIST);
        const m = text.match(/(<key>NSMicrophoneUsageDescription<\/key>\s*<string>)([\s\S]*?)(<\/string>)/);
        writeFileSync(PLIST, text.replace(m[0], `${m[1]}Necesitamos el micrófono${m[3]}`));
        return () => writeFileSync(PLIST, text);
      },
      expect: (r) => r.failures.some((m) => m.includes("знаков, нужно не меньше")),
    },
    {
      name: "iOS: строка назначения оставлена шаблоном Capacitor",
      plant: () => {
        const text = read(PLIST);
        const m = text.match(/(<key>NSMicrophoneUsageDescription<\/key>\s*<string>)([\s\S]*?)(<\/string>)/);
        writeFileSync(PLIST, text.replace(m[0], `${m[1]}$(MIC_PURPOSE)${m[3]}`));
        return () => writeFileSync(PLIST, text);
      },
      expect: (r) => r.failures.some((m) => m.includes("незаполненный шаблон")),
    },
    {
      name: "новая способность в коде без единого объявления (геопозиция)",
      plant: () => {
        writeFileSync(PLANTED, "export const where = () => navigator.geolocation.getCurrentPosition(() => {});\n");
        execFileSync("git", ["add", "-N", PLANTED]);
        return () => {
          execFileSync("git", ["rm", "-q", "--cached", PLANTED]);
          execFileSync("rm", ["-f", PLANTED]);
        };
      },
      expect: (r) =>
        r.failures.some((m) => m.startsWith("iOS:") && m.includes("геопозиция")) &&
        r.failures.some((m) => m.startsWith("Android:") && m.includes("геопозиция")),
    },
    {
      name: "лишнее разрешение: камера объявлена, кодом не используется",
      plant: () =>
        swap(
          MANIFEST,
          '<uses-permission android:name="android.permission.INTERNET" />',
          '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />',
        ),
      expect: (r) => r.failures.some((m) => m.includes("CAMERA") && m.includes("не используется")),
    },
    {
      name: "разрешение, о котором таблица сторожа не знает вовсе",
      plant: () =>
        swap(
          MANIFEST,
          '<uses-permission android:name="android.permission.INTERNET" />',
          '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.READ_CONTACTS" />',
        ),
      expect: (r) => r.failures.some((m) => m.includes("READ_CONTACTS") && m.includes("не относится ни к одной")),
    },
    {
      name: "связка долга 107: isExactNotification: false убран из кода",
      plant: () =>
        swap("src/lib/notifications.ts", "isExactNotification: false,", "isExactNotification: true,"),
      expect: (r) => r.failures.some((m) => m.includes("Alarms & reminders")),
    },
    {
      name: "связка долга 107: разрешение перестали вычёркивать из пакета",
      plant: () => swap(MANIFEST, 'tools:node="remove"', 'tools:node="merge"'),
      // Правило молчит: вычеркивания нет — связывать нечего. Это НЕ дыра,
      // а граница правила, и она проверена, а не подразумевается.
      negative: true,
      expect: (r) => !r.failures.some((m) => m.includes("Alarms & reminders")),
    },
    {
      name: "вызов спрятан за комментарий — ложной красноты быть не должно",
      plant: () => {
        writeFileSync(PLANTED, "// navigator.geolocation.getCurrentPosition — мы этого НЕ делаем\nexport {};\n");
        execFileSync("git", ["add", "-N", PLANTED]);
        return () => {
          execFileSync("git", ["rm", "-q", "--cached", PLANTED]);
          execFileSync("rm", ["-f", PLANTED]);
        };
      },
      // Отрицательный контроль: подсадка НЕ должна ловиться.
      negative: true,
      expect: (r) => r.failures.length === 0,
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
    const word = control.negative ? (caught ? "промолчал" : "ЛОЖНАЯ КРАСНОТА") : caught ? "поймано" : "ПРОПУЩЕНО";
    console.log(`  ${word} — ${control.name}`);
    ok &&= caught;
  }
  const clean = scan().failures.length === 0;
  console.log(`  ${clean ? "чисто" : "ВСЁ ЕЩЁ ГРЯЗНО"} — после отката всех ${controls.length} подсадок`);
  ok &&= clean;
  const n = controls.length + 1;
  console.log(ok ? `check:native-permissions --plant — ${n} из ${n}` : "check:native-permissions --plant — FAILED");
  return ok;
}

/** Подсадки СЛОЯ ПАКЕТА (долг 107). Файла APK им не нужно: заведомо
 *  здоровый дамп строится из наших же исходников и списка принесённых
 *  библиотеками, а потом портится. Поэтому они гоняются на ноутбуке и в
 *  `ci.yml`, где никакого Android SDK нет. */
function plantApkControls() {
  const applicationId = readFileSync("android/app/build.gradle", "utf8").match(
    /applicationId\s+"([^"]+)"/,
  )[1];
  const ours = androidDeclared();
  const merged = [...ALLOWED_MERGED.keys()].map((n) => n.replace("${applicationId}", applicationId));
  const healthy = [
    `package: name='${applicationId}' versionCode='1' versionName='1.0'`,
    ...[...ours, ...merged].map((p) => `uses-permission: name='${p}'`),
  ].join("\n");

  const run = (badging) => scan({ badging, applicationId });
  const controls = [
    [
      "в ПАКЕТЕ нет микрофона, хотя рекордер в коде есть",
      () => run(healthy.replace(/^uses-permission: name='android\.permission\.RECORD_AUDIO'\n/m, "")),
      (r) => r.failures.some((m) => m.startsWith("Android:") && m.includes("RECORD_AUDIO")),
    ],
    [
      "в ПАКЕТЕ камера, которой в коде нет — приехала с новой зависимостью",
      () => run(`${healthy}\nuses-permission: name='android.permission.CAMERA'`),
      (r) => r.failures.some((m) => m.includes("CAMERA") && m.includes("не используется")),
    ],
    [
      "в ПАКЕТЕ разрешение, о котором не знает ни таблица, ни список принесённых",
      () => run(`${healthy}\nuses-permission: name='android.permission.READ_CONTACTS'`),
      (r) =>
        r.failures.some(
          (m) => m.includes("READ_CONTACTS") && m.includes("лежит в СОБРАННОМ ПАКЕТЕ"),
        ),
    ],
    [
      "в ПАКЕТЕ ограниченное SCHEDULE_EXACT_ALARM, вычеркнутое из манифеста",
      () => run(`${healthy}\nuses-permission: name='android.permission.SCHEDULE_EXACT_ALARM'`),
      (r) => r.failures.some((m) => m.includes("SCHEDULE_EXACT_ALARM")),
    ],
    [
      "в ПАКЕТЕ пропал MODIFY_AUDIO_SETTINGS — половинчатая правка долга 72",
      () =>
        run(healthy.replace(/^uses-permission: name='android\.permission\.MODIFY_AUDIO_SETTINGS'\n/m, "")),
      (r) => r.failures.some((m) => m.includes("MODIFY_AUDIO_SETTINGS")),
    ],
  ];

  let ok = true;
  let caught = 0;
  for (const [name, make, expect] of controls) {
    const hit = expect(make());
    console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    if (hit) caught += 1;
    ok &&= hit;
  }
  // Отрицательный контроль: настоящий здоровый пакет обязан молчать.
  const clean = run(healthy).failures.length === 0;
  console.log(`  ${clean ? "отрицательный контроль: здоровый пакет — молчание" : "ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН"}`);
  console.log(`  слой пакета: поймано ${caught} из ${controls.length}`);
  return ok && clean;
}

function main() {
  if (process.argv.includes("--plant")) {
    const a = plantControls();
    console.log("check:native-permissions --plant — слой пакета (долг 107):");
    const b = plantApkControls();
    return a && b;
  }
  const arg = process.argv.find((x) => x.startsWith("--badging="));
  if (arg) {
    const applicationId = readFileSync("android/app/build.gradle", "utf8").match(
      /applicationId\s+"([^"]+)"/,
    )[1];
    return report(scan({ badging: readFileSync(arg.slice("--badging=".length), "utf8"), applicationId }));
  }
  return report(scan());
}

if (IS_ENTRY_POINT) {
  process.exitCode = main() ? 0 : 1;
}
