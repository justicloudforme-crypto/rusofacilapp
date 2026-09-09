// Политика обязана совпадать с кодом — механически, а не по памяти.
//
// ЗАЧЕМ. 30.08.2026 (7.49) запись голоса перестала уходить на сервер:
// маршрут загрузки и запись в объектное хранилище удалены из кода целиком,
// клип живёт в IndexedDB браузера. Текст политики и условий об этом не
// узнал и продолжал в ВОСЬМИ утверждениях обещать хранение «включая сами
// аудиофайлы на сервере» (долг 73). Ровно этот класс расхождения —
// заявленное магазину против написанного на своём сайте — Apple и Google
// проверяют на ревью. Тем же заходом выяснилось, что список обработчиков
// в политике отстал от package.json: Sentry, RevenueCat и три продукта
// Vercel не были названы (долг 74).
//
// Оба долга — правки текста. Правка текста стареет ровно так же, как
// состарилась предыдущая. Поэтому здесь стоит не правка, а проверка.
//
// ЧТО ПРОВЕРЯЕТСЯ — два направления, и оба обязаны краснеть.
//
// 1. ГОЛОС. Считается число сетевых вызовов (`fetch`, `XMLHttpRequest`,
//    `sendBeacon`, `FormData`) в модулях пути записи и число маршрутов
//    `src/app/api/**`, чьё имя говорит о голосе. Отдельно считается число
//    утверждений политики и условий, которые обещают хранение записи у
//    нас. Правило двустороннее:
//      — отправок 0, а утверждений > 0  → политика обещает то, чего нет;
//      — отправок > 0, а утверждений 0  → код отправляет то, о чём
//        политика молчит (это хуже: так выглядит незаявленный сбор).
//
// 2. ОБРАБОТЧИКИ. Из `package.json` берутся зависимости, из `src/` —
//    какие из них ДЕЙСТВИТЕЛЬНО импортируются. Каждая такая зависимость
//    обязана быть названа в разделе обработчиков ОБЕИХ локалей — под
//    именем из таблицы ниже. Появится завтра новый внешний обработчик и
//    не будет назван — сборка покраснеет.
//
// Контроль: `node scripts/check-legal-truth.mjs --plant`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

const LEGAL = "src/lib/legal/content.ts";

/** Модули пути записи голоса. Список поимённый, а не по маске: маска
 * молча пропустила бы переименование, а поимённый список на него
 * краснеет — файл исчез, значит путь перестроили и посмотреть надо
 * глазами. */
const VOICE_PATH = [
  "src/lib/voice-recordings-store.ts",
  "src/lib/voice-storage.ts",
  "src/lib/voice-formats.ts",
  "src/lib/recordings-owner.ts",
  "src/components/lesson/VoiceRecorder.tsx",
  "src/components/lesson/PronunciationPractice.tsx",
  "src/components/profile/VoiceRecordingsPanel.tsx",
];

/** Настоящая отправка наружу. `postReliably` — общая обёртка проекта над
 * keepalive+маячком, она тоже считается отправкой. */
const NETWORK = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new FormData|postReliably\s*\(/g;

/** Утверждения о хранении записи У НАС. Ищутся по смыслу, а не по
 * строке: пары «глагол хранения + слово о записи» в одном абзаце. */
const STORAGE_VERB_ES = /(almacenamos|guardamos|conservamos|almacenarlas|guardados en el servidor|nos concedes una licencia)/i;
const STORAGE_VERB_RU = /(мы сохраняем|мы храним|хранение и воспроизведение|аудиофайлы на сервере|лицензию на их хранение)/i;
const VOICE_WORD = /(grabaci[oó]n|grabaciones|аудиозапис|записи произношения|запись произношения)/i;

/**
 * Отрицание в том же абзаце. Абзац, который прямо говорит, что записи у
 * нас НЕТ, — это не обещание хранения, а его опровержение, и считать его
 * утверждением значило бы требовать от текста молчания о голосе вовсе.
 * Ловушка была настоящая: абзац об удалении аккаунта называет и «храним»,
 * и «аудиозаписи» в одном предложении — ровно затем, чтобы сказать, что
 * вторых в первом нет. Поймано первым же прогоном сторожа, а не глазами.
 */
const DENIAL = /(no se sube|nunca (salieron|estuvieron|las recibimos)|NO las recogemos|no entran en ese borrado|no aparecen en esa lista|никогда их не получаем|никуда не загружаются|НЕ собираем|никогда не покидали|не входят|в этом списке нет|на сервер она не уходит|не попадают)/i;

/**
 * npm-зависимость → как обработчик обязан быть назван в тексте.
 * Только те, кто ВИДИТ данные пользователя. Библиотеки разметки,
 * форматирования и нативные обёртки Capacitor сюда не входят и названы
 * в SKIP с причиной.
 */
const PROCESSORS = new Map([
  ["stripe", "Stripe"],
  ["resend", "Resend"],
  ["@libsql/client", "Turso"],
  ["@prisma/adapter-libsql", "Turso"],
  ["@upstash/redis", "Upstash"],
  ["@sentry/nextjs", "Sentry"],
  ["@revenuecat/purchases-capacitor", "RevenueCat"],
  ["@revenuecat/purchases-capacitor-ui", "RevenueCat"],
  ["@vercel/analytics", "Vercel"],
  ["@vercel/speed-insights", "Vercel"],
  ["@vercel/blob", "Vercel"],
]);

/** Зависимости, которые данных наружу не отдают, каждая с причиной. */
const SKIP = new Map([
  ["next", "фреймворк, исполняется на нашем же хостинге"],
  ["react", "библиотека разметки, сети не касается"],
  ["react-dom", "то же"],
  ["serwist", "service worker, целиком в браузере пользователя"],
  ["@serwist/next", "сборка того же service worker"],
  ["bcryptjs", "хэширование пароля, локально в нашем процессе"],
  ["music-metadata", "чтение тегов аудиофайла, локально"],
  ["@react-pdf/renderer", "сборка PDF, локально"],
  ["@prisma/client", "драйвер базы; сам адрес базы — Turso, он назван"],
  ["@prisma/adapter-better-sqlite3", "локальный файл базы разработчика"],
  ["prisma", "инструмент сборки схемы"],
  ["@capacitor/core", "нативная оболочка, своего сервера не имеет"],
  ["@capacitor/app", "то же"],
  ["@capacitor/haptics", "то же"],
  ["@capacitor/local-notifications", "локальные уведомления, наружу не ходят"],
  ["@capacitor/preferences", "хранилище на устройстве"],
  ["@capacitor/splash-screen", "нативная оболочка"],
  ["@capacitor/status-bar", "нативная оболочка"],
  ["@capgo/capacitor-media-session", "нативный проигрыватель, локально"],
]);

/** Названы в политике, но npm-зависимостью не являются, каждый с
 * причиной — иначе список обработчиков нельзя было бы объяснить. */
const NAMED_WITHOUT_DEPENDENCY = new Map([
  ["OpenAI", "озвучка сгенерирована заранее; в исполняемом коде вызова нет — это стережёт src/lib/no-runtime-tts.test.ts"],
  ["YouTube", "встроенный проигрыватель, подключается тегом iframe, а не пакетом"],
  ["Google", "то же, через YouTube"],
]);

function readLegal() {
  return readFileSync(LEGAL, "utf8");
}

/** Раздел обработчиков каждой локали — по заголовку, а не по номеру
 * строки: номера уезжают при любой правке выше. */
function processorSections(text) {
  const out = {};
  for (const [locale, heading] of [
    ["es", "4. Con quién compartimos datos"],
    ["ru", "4. С кем мы делимся данными"],
  ]) {
    const i = text.indexOf(heading);
    if (i < 0) {
      out[locale] = null;
      continue;
    }
    const end = text.indexOf("heading:", i + heading.length);
    out[locale] = text.slice(i, end < 0 ? text.length : end);
  }
  return out;
}

function scan() {
  const failures = [];
  const text = readLegal();

  // --- 1. голос ---------------------------------------------------------
  let sends = 0;
  const missingModules = [];
  for (const file of VOICE_PATH) {
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      missingModules.push(file);
      continue;
    }
    sends += (src.match(NETWORK) ?? []).length;
  }
  if (missingModules.length) {
    failures.push(
      `путь записи голоса перестроен: нет ${missingModules.join(", ")}. ` +
        `Список модулей поимённый нарочно — пересоберите его глазами и перечитайте политику.`,
    );
  }

  const apiDirs = readdirSync("src/app/api", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const voiceRoutes = apiDirs.filter((d) => /voice|recording|pronunciation/i.test(d));

  const claims = [];
  text.split("\n").forEach((line, i) => {
    if (!VOICE_WORD.test(line)) return;
    if (DENIAL.test(line)) return;
    if (STORAGE_VERB_ES.test(line) || STORAGE_VERB_RU.test(line)) {
      claims.push({ line: i + 1, text: line.trim().slice(0, 110) });
    }
  });

  const uploads = sends + voiceRoutes.length;
  if (uploads === 0 && claims.length > 0) {
    failures.push(
      `политика обещает хранение записи голоса у нас в ${claims.length} утверждении(ях), ` +
        `а код её никуда не отправляет (сетевых вызовов в ${VOICE_PATH.length} модулях пути записи — 0, ` +
        `маршрутов о голосе среди ${apiDirs.length} каталогов src/app/api — 0):\n` +
        claims.map((c) => `        ${LEGAL}:${c.line}  ${c.text}`).join("\n"),
    );
  }
  if (uploads > 0 && claims.length === 0) {
    failures.push(
      `код отправляет запись голоса наружу (сетевых вызовов ${sends}, маршрутов ${voiceRoutes.length}: ` +
        `${voiceRoutes.join(", ") || "—"}), а политика об этом МОЛЧИТ. ` +
        `Незаявленный сбор — худшее из двух расхождений: сначала впишите его в ${LEGAL}.`,
    );
  }

  // --- 2. обработчики ---------------------------------------------------
  const deps = Object.keys(JSON.parse(readFileSync("package.json", "utf8")).dependencies ?? {});
  const srcFiles = execFileSync("git", ["ls-files", "-z", "src"], { encoding: "utf8" })
    .split("\0")
    .filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !/\.test\./.test(f));
  const bodies = srcFiles.map((f) => {
    try {
      return readFileSync(f, "utf8");
    } catch {
      return "";
    }
  });
  const imported = deps.filter((d) =>
    bodies.some(
      (s) =>
        s.includes(`from "${d}"`) ||
        s.includes(`from "${d}/`) ||
        s.includes(`import("${d}`) ||
        s.includes(`require("${d}`),
    ),
  );

  const sections = processorSections(text);
  for (const [locale, body] of Object.entries(sections)) {
    if (body) continue;
    failures.push(`раздел обработчиков локали ${locale} не найден в ${LEGAL} — заголовок переименован?`);
  }

  const unknown = imported.filter((d) => !PROCESSORS.has(d) && !SKIP.has(d));
  for (const d of unknown) {
    failures.push(
      `«${d}» импортируется из src/, но таблица сторожа о нём не знает.\n` +
        `        Новая зависимость — это либо новый обработчик данных (впишите его в PROCESSORS ` +
        `И в раздел обработчиков ОБЕИХ локалей ${LEGAL}), либо не обработчик (впишите в SKIP с причиной). ` +
        `Молча — нельзя: именно так политика и отстала от кода.`,
    );
  }

  const namedOk = [];
  for (const d of imported) {
    const label = PROCESSORS.get(d);
    if (!label) continue;
    for (const [locale, body] of Object.entries(sections)) {
      if (!body) continue;
      if (body.includes(label)) continue;
      failures.push(
        `обработчик «${label}» (пакет ${d}) импортируется из src/, но НЕ НАЗВАН в разделе ` +
          `обработчиков локали ${locale}. Магазины сверяют этот список с анкетой App Privacy / Data safety.`,
      );
    }
    namedOk.push(label);
  }

  // --- 3. дата --------------------------------------------------------
  const dates = [...text.matchAll(/const (TERMS|PRIVACY)_LAST_UPDATED = "(\d{4}-\d{2}-\d{2})";/g)];
  if (dates.length !== 2) {
    failures.push(
      `дат последнего изменения найдено ${dates.length}, а нужно две (TERMS_LAST_UPDATED и PRIVACY_LAST_UPDATED), ` +
        `и обе — написанные рукой ISO-строки, а не время сборки.`,
    );
  }
  for (const bad of text.matchAll(/LAST_UPDATED = (?!")/g)) {
    failures.push(
      `дата последнего изменения вычисляется, а не написана рукой (${bad[0].trim()}…). ` +
        `Время сборки идёт при каждом деплое и датой решения не является — это долг класса 39/40.`,
    );
  }
  const labels = (text.match(/lastUpdatedLabel: "/g) ?? []).length;
  if (labels !== 4) {
    failures.push(`подписей к дате ${labels}, а документов четыре (условия и политика × две локали).`);
  }

  return {
    failures,
    sends,
    voiceRoutes,
    apiDirs: apiDirs.length,
    claims,
    imported,
    processors: [...new Set(namedOk)],
    unknown,
    dates: dates.map((d) => `${d[1]}=${d[2]}`),
  };
}

function report(r) {
  if (r.failures.length) {
    console.error("check:legal-truth — ОТКАЗ\n");
    for (const f of r.failures) console.error(`  ${f}\n`);
    return false;
  }
  console.log("check:legal-truth — заявленное совпадает с фактическим.");
  console.log(
    `  голос: ${VOICE_PATH.length} модулей пути записи, сетевых вызовов ${r.sends}; ` +
      `каталогов src/app/api ${r.apiDirs}, из них о голосе ${r.voiceRoutes.length}; ` +
      `утверждений о хранении записи у нас ${r.claims.length}`,
  );
  console.log(
    `  обработчики: зависимостей, импортируемых из src/, ${r.imported.length}; ` +
      `из них обработчиков данных ${r.processors.length} (${r.processors.join(", ")}), ` +
      `остальные — в SKIP с причиной; названы в обеих локалях все`,
  );
  console.log(
    `  названы без зависимости: ${[...NAMED_WITHOUT_DEPENDENCY.keys().toArray?.() ?? NAMED_WITHOUT_DEPENDENCY.keys()].join(", ")}`,
  );
  console.log(`  даты последнего изменения: ${r.dates.join(", ")}, обе написаны рукой`);
  return true;
}

function plantControls() {
  const swap = (file, from, to) => {
    const before = readFileSync(file, "utf8");
    if (!before.includes(from)) throw new Error(`подсадка не нашла «${from.slice(0, 50)}» в ${file}`);
    writeFileSync(file, before.replace(from, to));
    return () => writeFileSync(file, before);
  };
  /** Заменяет СТРОКУ ЦЕЛИКОМ, а не кусок. Первая версия подсадок правила
   * кусок, и три из них «пропустило»: остаток того же абзаца по-прежнему
   * нёс и отрицание, и имя обработчика, то есть подсадка не была
   * подсадкой. Поймано первым прогоном контроля. */
  const swapLine = (file, needle, replacement) => {
    const before = readFileSync(file, "utf8");
    const lines = before.split("\n");
    const i = lines.findIndex((l) => l.includes(needle));
    if (i < 0) throw new Error(`подсадка не нашла строку «${needle.slice(0, 40)}» в ${file}`);
    lines[i] = replacement;
    writeFileSync(file, lines.join("\n"));
    return () => writeFileSync(file, before);
  };
  const PLANTED = "src/lib/__legal-plant__.generated.ts";

  const controls = [
    {
      name: "политика снова обещает хранение записи на сервере, а кода для этого нет",
      plant: () => swapLine(LEGAL, "Grabaciones de voz: NO las recogemos.",
        '          "Grabaciones de voz: almacenamos el archivo de audio que grabas para que puedas escucharlo y compararlo.",'),
      expect: (r) => r.failures.some((m) => m.startsWith("политика обещает хранение")),
    },
    {
      name: "и в русской локали тоже",
      plant: () => swapLine(LEGAL, "Аудиозаписи произношения: мы их НЕ собираем.",
        '          "Аудиозаписи произношения: мы сохраняем файл записи, чтобы вы могли его прослушать и сравнить.",'),
      expect: (r) => r.failures.some((m) => m.startsWith("политика обещает хранение")),
    },
    {
      name: "ОБРАТНОЕ НАПРАВЛЕНИЕ: код начал отправлять запись, политика молчит",
      plant: () =>
        swap(
          "src/components/lesson/VoiceRecorder.tsx",
          "export",
          'const send = (b: Blob) => fetch("/api/voice", { method: "POST", body: b });\nexport',
        ),
      expect: (r) => r.failures.some((m) => m.startsWith("код отправляет запись голоса наружу")),
    },
    {
      name: "новый внешний обработчик появился в src/ и не назван нигде",
      plant: () => {
        writeFileSync(PLANTED, 'import { put } from "@vercel/blob";\nexport const x = put;\n');
        execFileSync("git", ["add", "-N", PLANTED]);
        const restore = swapLine(LEGAL, "• Vercel — alojamiento del sitio",
          '          "• Alojamiento del sitio y las funciones del servidor.",');
        return () => {
          restore();
          execFileSync("git", ["rm", "-q", "--cached", PLANTED]);
          rmSync(PLANTED);
        };
      },
      expect: (r) => r.failures.some((m) => m.includes("«Vercel»") && m.includes("НЕ НАЗВАН")),
    },
    {
      name: "обработчик пропал из ОДНОЙ локали — вторая его не спасает",
      plant: () => swapLine(LEGAL, "• Sentry — informes de errores",
        '          "• Informes de errores técnicos.",'),
      expect: (r) =>
        r.failures.some((m) => m.includes("«Sentry»") && m.includes("локали es")) &&
        !r.failures.some((m) => m.includes("«Sentry»") && m.includes("локали ru")),
    },
    {
      name: "зависимость, о которой таблица сторожа не знает вовсе",
      plant: () => {
        writeFileSync(PLANTED, 'import { Redis } from "@upstash/redis";\nexport const y = Redis;\n');
        execFileSync("git", ["add", "-N", PLANTED]);
        const restore = swap("scripts/check-legal-truth.mjs", '["@upstash/redis", "Upstash"],', "");
        return () => {
          restore();
          execFileSync("git", ["rm", "-q", "--cached", PLANTED]);
          rmSync(PLANTED);
        };
      },
      // Таблица правится в ФАЙЛЕ, а не в памяти процесса, поэтому подсадка
      // проверяется отдельным запуском: см. runInChild ниже.
      child: true,
      expectChild: (out) => out.includes("таблица сторожа о нём не знает"),
    },
    {
      name: "дата стала временем сборки вместо решения",
      plant: () =>
        swap(LEGAL, 'const PRIVACY_LAST_UPDATED = "2026-09-09";', "const PRIVACY_LAST_UPDATED = new Date().toISOString().slice(0, 10);"),
      expect: (r) => r.failures.some((m) => m.includes("вычисляется, а не написана рукой")),
    },
    {
      name: "подпись к дате снята с одного документа",
      plant: () => swap(LEGAL, '    lastUpdatedLabel: "Última actualización:",\n', ""),
      expect: (r) => r.failures.some((m) => m.startsWith("подписей к дате 3")),
    },
    {
      name: "ОТРИЦАТЕЛЬНЫЙ: абзац про озвучку OpenAI («хранятся в нашем хранилище») — не про голос пользователя",
      plant: () => () => {},
      expect: (r) => r.failures.length === 0,
      negative: true,
    },
  ];

  let ok = true;
  let pos = 0;
  let neg = 0;
  for (const c of controls) {
    const undo = c.plant();
    let caught;
    try {
      if (c.child) {
        let out = "";
        try {
          out = execFileSync("node", ["scripts/check-legal-truth.mjs"], { encoding: "utf8", stdio: "pipe" });
        } catch (e) {
          out = String(e.stdout ?? "") + String(e.stderr ?? "");
        }
        caught = c.expectChild(out);
      } else {
        caught = c.expect(scan());
      }
    } finally {
      undo();
    }
    const verb = c.negative ? (caught ? "промолчал" : "ЛОЖНО КРАСНЫЙ") : caught ? "поймано" : "ПРОПУЩЕНО";
    console.log(`  ${verb} — ${c.name}`);
    if (caught) {
      if (c.negative) neg++;
      else pos++;
    }
    ok &&= caught;
  }
  const clean = scan().failures.length === 0;
  console.log(`  ${clean ? "чисто" : "ВСЁ ЕЩЁ ГРЯЗНО"} — после отката всех подсадок`);
  ok &&= clean;
  const positives = controls.filter((c) => !c.negative).length;
  console.log(
    ok
      ? `check:legal-truth --plant — ${pos} из ${positives} подсадок поймано, ${neg} из ${controls.length - positives} отрицательных контролей промолчали`
      : "check:legal-truth --plant — FAILED",
  );
  return ok;
}

if (IS_ENTRY_POINT) {
  const ok = process.argv.includes("--plant") ? plantControls() : report(scan());
  process.exitCode = ok ? 0 : 1;
}
