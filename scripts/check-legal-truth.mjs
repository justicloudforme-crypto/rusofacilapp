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
// 3. ВНЕШНИЕ АДРЕСА (заведено 13.09.2026, долг 173). Направление 2 видит
//    только тех, кто пришёл пакетом npm. Вызов по адресу пакета не
//    требует, и ровно так в политике оказалась дыра: `api.mymemory.translated.net`
//    получает слово ученика при каждом тапе мимо нашего банка с самого
//    появления тапа по слову, а в тексте политики вхождений «MyMemory»
//    было 0 — и сторож молчал, потому что MyMemory не зависимость.
//    Поэтому отдельно от зависимостей читаются АДРЕСА: каждый литерал
//    `https://<хост>` в `src/` (кроме тестов, кроме `src/generated/`,
//    кроме строк-комментариев) обязан быть либо назван в политике ОБЕИХ
//    локалей под именем из HOST_PROCESSORS, либо стоять в
//    HOSTS_WITHOUT_NAME с причиной. Хост, которого нет ни там, ни там, —
//    падение: это и есть «код ходит туда, о чём политика молчит».
//
// 5. GOOGLE PLAY И ДАННЫЕ, КОТОРЫЕ ПОЛИТИКА ОБЯЗАНА НАЗВАТЬ (заход 7.242,
//    аудит 7.241 — Р2, Р3, Р14). Направления 1–3 сверяли голос и
//    получателей, но не видели трёх классов неправды, которые Google
//    сверяет с анкетой Data safety:
//      Р2 — «отменить можно в профиле» и «удаление отменяет любую
//           подписку», когда подписку из Google Play отменяет только Google;
//      Р3 — то же обещание на экранах удаления («se eliminará tu
//           suscripción»);
//      Р14 — политика молчала о группах и публичном профиле, часовом поясе,
//           стране по IP и сроке резервных копий.
//    Каждый факт МЕРЯЕТСЯ по коду (продаёт ли приложение через магазин,
//    отменяет ли удаление подписку магазина, сколько дней живут копии, есть
//    ли колонка пояса, группы, публичный профиль, страна по заголовку IP), и
//    только потом от текста требуется его назвать. Правило двустороннее там,
//    где это возможно: научись удаление отменять подписку магазина — текст
//    «НЕ отменяется» станет ложью, и сторож покраснеет на нём.
//
// Контроль: `node scripts/check-legal-truth.mjs --plant`.
import { repoFiles } from "./repo-files.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const IS_ENTRY_POINT = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

const LEGAL = "src/lib/legal/content.ts";
const LEGAL_VIEW = "src/components/legal/LegalDocumentView.tsx";
/** Якорь, на который ссылается анкета Google Play («Delete account URL»).
 *  Один и тот же в обеих локалях НАРОЧНО: поле в анкете одно. */
const REQUIRED_ANCHOR = "tus-derechos";

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

/**
 * ВНЕШНИЙ АДРЕС → как получатель обязан быть назван в политике.
 * Ключ — хост, а не пакет: вызов наружу пакета не требует (долг 173).
 */
const HOST_PROCESSORS = new Map([
  // Слово ученика, мимо нашего банка переводов. Единственный адрес в этом
  // списке, который получает ТЕКСТ, введённый поведением ученика.
  ["api.mymemory.translated.net", "MyMemory"],
  // Таблица курсов для «примерной цены в валюте посетителя».
  ["open.er-api.com", "ExchangeRate-API"],
  // Субтитры и черновики видео-уроков, админские маршруты.
  ["api.anthropic.com", "Anthropic"],
  // Озвучка: расшифровка Whisper. В продуктовом пути не вызывается (это
  // стережёт src/lib/no-runtime-tts.test.ts), но литерал в src/ есть, и
  // молчать о нём нельзя — в политике OpenAI назван.
  ["api.openai.com", "OpenAI"],
  // Встроенный проигрыватель и его API-скрипт: сюда ходит БРАУЗЕР ученика.
  ["www.youtube.com", "YouTube"],
  ["img.youtube.com", "YouTube"],
  // YouTube Data API v3, админская проверка живости встроек.
  ["www.googleapis.com", "Google"],
]);

/**
 * Адреса, которых в политике быть не обязано, каждый с причиной. Причина
 * обязательна по той же причине, что и у SKIP: список без причин через
 * месяц нельзя ни проверить, ни объяснить проверяющему магазина.
 */
const HOSTS_WITHOUT_NAME = new Map([
  ["schema.org", "пространство имён JSON-LD: строка стоит в разметке `@context`, по сети не запрашивается"],
  ["www.w3.org", "пространство имён SVG (`xmlns`), по сети не запрашивается"],
  ["rusofacilapp.com", "наш собственный адрес"],
  ["t.me", "внешняя ссылка на группу: переход делает сам ученик нажатием, код наружу ничего не отправляет"],
  ["github.com", "загрузка бинарника yt-dlp админским маршрутом; наружу уходит GET за файлом релиза, данных ученика в запросе нет"],
  [
    "play.google.com",
    "адрес карточки магазина (`PLAY_STORE_URL`, src/lib/pwa-manifest.ts): поле `related_applications` " +
      "манифеста PWA (с захода 7.259 — карточка Google Play для Chrome) и, с захода 7.258, ссылка-бейдж " +
      "«Google Play» в браузере (`PlayStoreBadge`). Данных наружу код не отправляет ВООБЩЕ: переход " +
      "делает сам человек нажатием, как по ссылке на t.me",
  ],
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

/** Документ × локаль как кусок исходника: границы — объявления констант и
 * ключ `ru: {` на два пробела внутри каждой. */
function legalSlices(text) {
  const terms = text.slice(text.indexOf("export const TERMS_CONTENT"), text.indexOf("export const PRIVACY_CONTENT"));
  const privacy = text.slice(text.indexOf("export const PRIVACY_CONTENT"), text.indexOf("export function visibleLegalParagraphs"));
  const split = (doc) => {
    const i = doc.indexOf("\n  ru: {");
    return { es: doc.slice(0, i), ru: doc.slice(i) };
  };
  return { terms: split(terms), privacy: split(privacy) };
}

/** Раздел документа по номеру заголовка («6.»), до следующего `heading:`. */
function sectionOf(doc, number) {
  const m = new RegExp(`heading: "${number.replace(".", "\\.")} `).exec(doc);
  if (!m) return "";
  const end = doc.indexOf("heading:", m.index + 10);
  return doc.slice(m.index, end < 0 ? doc.length : end);
}

export const PLAY_SUBSCRIPTIONS = "play.google.com/store/account/subscriptions";
const DELETE_ROUTE = "src/app/api/auth/confirm-account-deletion/route.ts";
const BACKUP = "src/lib/backup.ts";
const DELETION_COPY = "src/lib/legal/account-deletion.ts";

/** Ложные утверждения: удаление аккаунта отменяет ЛЮБУЮ подписку или
 *  удаляет «подписку» без оговорки о магазине. Судятся в правовых текстах,
 *  на экранах удаления (словари) и на странице удаления. */
const FALSE_DELETION_CLAIMS = [
  /cancela cualquier suscripci[oó]n/i,
  /отменяет любую (?:активную )?подписку/i,
  /se eliminar[aá]n? tu progreso, suscripci[oó]n/i,
  /будут удалены прогресс, подписка/i,
];
/** «Удаление НЕ отменяет подписку Google Play» — по локали. */
const DELETION_KEEPS_PLAY = {
  es: /Google Play NO se cancela|\bNO\b[^.]*Google Play/,
  ru: /Google Play[^.]*НЕ отменя|НЕ отменя[^.]*Google Play/,
};

/** Факты кода, от которых зависит правда текстов раздела 5. */
export function codeFacts() {
  const read = (f) => {
    try {
      return readFileSync(f, "utf8");
    } catch {
      return "";
    }
  };
  const webhooks = repoFiles(["src/app/api/webhooks"]).map(read).join("\n");
  const route = read(DELETE_ROUTE);
  const retention = Number(/const RETENTION_COUNT = (\d+);/.exec(read(BACKUP))?.[1] ?? NaN);
  const daily = /"path": "\/api\/cron\/backup", "schedule": "\d+ \d+ \* \* \*"/.test(read("vercel.json"));
  const schema = read("prisma/schema.prisma");
  return {
    sellsInStore: /provider:\s*"revenuecat"/.test(webhooks),
    // Отменяет ли удаление подписку магазина: любое обращение к RevenueCat
    // или к Google Play из маршрута удаления.
    deletionCancelsStore: /revenuecat|googleapis|androidpublisher/i.test(route),
    backupDays: daily ? retention : NaN,
    timezone: /^\s*timezone\s+String/m.test(schema),
    groups: repoFiles(["src/app/[lang]/groups"]).length > 0,
    publicProfile: /publicProfileEnabled/.test(schema) && repoFiles(["src/app/[lang]/u"]).length > 0,
    countryByIp: /x-vercel-ip-country/.test(read("src/lib/country.ts")),
  };
}

/** Раздел 5 целиком: вернуть список нарушений. Вынесен из `scan`, чтобы
 *  подсадки могли подать ему изменённый текст без записи файлов. */
export function playTruthFailures(text, facts = codeFacts(), extraSources = null) {
  const failures = [];
  const docs = legalSlices(text);
  const labels = { terms: "Условия", privacy: "Политика" };

  // Р2 + Р3: ложные обещания отмены при удалении — везде, где их читает человек.
  const sources = extraSources ?? [
    [LEGAL, text],
    ["src/dictionaries/es.json", readFileSync("src/dictionaries/es.json", "utf8")],
    ["src/dictionaries/ru.json", readFileSync("src/dictionaries/ru.json", "utf8")],
    [DELETION_COPY, readFileSync(DELETION_COPY, "utf8")],
  ];
  if (!facts.deletionCancelsStore && facts.sellsInStore) {
    for (const [file, body] of sources) {
      for (const re of FALSE_DELETION_CLAIMS) {
        const m = re.exec(body);
        if (m) {
          failures.push(
            `${file}: «${m[0]}» — удаление аккаунта отменяет только подписку сайта (${DELETE_ROUTE} ` +
              `к магазину не обращается), а подписку Google Play не трогает. Р2/Р3 аудита 7.241.`,
          );
        }
      }
    }
  }

  for (const locale of ["es", "ru"]) {
    const terms = docs.terms[locale];
    const privacy = docs.privacy[locale];
    if (facts.sellsInStore) {
      // Р2: где отменять подписку магазина.
      if (!sectionOf(terms, "3.").includes(PLAY_SUBSCRIPTIONS)) {
        failures.push(
          `${labels.terms} /${locale}, раздел 3: приложение продаёт подписку через Google Play, а раздел об отмене ` +
            `не даёт адреса ${PLAY_SUBSCRIPTIONS} — «отменить в профиле» для такой подписки неправда.`,
        );
      }
      // Р2/Р3: что удаление делает с подпиской магазина — двусторонне.
      for (const [doc, number] of [[terms, "6."], [privacy, "6."]]) {
        const body = sectionOf(doc, number);
        const says = DELETION_KEEPS_PLAY[locale].test(body);
        const name = doc === terms ? labels.terms : labels.privacy;
        if (!facts.deletionCancelsStore && !says) {
          failures.push(
            `${name} /${locale}, раздел 6: не сказано, что удаление аккаунта НЕ отменяет подписку Google Play ` +
              `(а ${DELETE_ROUTE} её не отменяет).`,
          );
        }
        if (facts.deletionCancelsStore && says) {
          failures.push(
            `${name} /${locale}, раздел 6: текст говорит, что удаление НЕ отменяет подписку Google Play, ` +
              `а ${DELETE_ROUTE} теперь обращается к магазину — перепишите текст под код.`,
          );
        }
      }
    }
    // Р14: срок резервных копий — число из кода.
    if (!Number.isFinite(facts.backupDays)) {
      failures.push(`${BACKUP}/vercel.json: срок резервных копий не вычисляется (RETENTION_COUNT × ежедневный cron) — перечитайте сторож.`);
    } else {
      const want = locale === "es" ? `${facts.backupDays} días` : `${facts.backupDays} дней`;
      if (!sectionOf(privacy, "6.").includes(want)) {
        failures.push(
          `${labels.privacy} /${locale}, раздел 6: резервные копии живут ${facts.backupDays} дней ` +
            `(${BACKUP}: RETENTION_COUNT, копия раз в сутки), а текст не говорит «${want}».`,
        );
      }
    }
    // Р14: что остаётся у получателей после удаления.
    for (const name of ["Google Play", "RevenueCat", "Stripe", "Resend", "Sentry"]) {
      if (!sectionOf(privacy, "6.").includes(name)) {
        failures.push(`${labels.privacy} /${locale}, раздел 6: не сказано, что остаётся у «${name}» после удаления аккаунта.`);
      }
    }
    // Р14: данные, которые код собирает, а политика обязана назвать.
    const collected = sectionOf(privacy, "2.");
    const need = {
      es: [
        [facts.timezone, /zona horaria/i, "часовой пояс (User.timezone)"],
        [facts.groups, /grupos? de estudio/i, "учебные группы (имя видно участникам)"],
        [facts.publicProfile, /perfil público/i, "публичный профиль (/u/…)"],
        [facts.countryByIp, /país[^.]*dirección IP|dirección IP[^.]*país/i, "страна по IP (x-vercel-ip-country)"],
      ],
      ru: [
        [facts.timezone, /часовой пояс/i, "часовой пояс (User.timezone)"],
        [facts.groups, /учебн\S* групп/i, "учебные группы (имя видно участникам)"],
        [facts.publicProfile, /публичный профиль/i, "публичный профиль (/u/…)"],
        [facts.countryByIp, /IP-адрес[^.]*стран|стран[^.]*IP-адрес/i, "страна по IP (x-vercel-ip-country)"],
      ],
    }[locale];
    for (const [present, re, what] of need) {
      if (present && !re.test(collected)) {
        failures.push(`${labels.privacy} /${locale}, раздел 2: код собирает «${what}», а раздел «что собираем» об этом молчит.`);
      }
    }
    // Адрес отдельной страницы удаления — в разделе о правах.
    if (!sectionOf(privacy, "7.").includes(`rusofacilapp.com/${locale}/eliminar-cuenta`)) {
      failures.push(`${labels.privacy} /${locale}, раздел 7 (#tus-derechos): нет адреса страницы удаления rusofacilapp.com/${locale}/eliminar-cuenta.`);
    }
  }
  return failures;
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
  const srcFiles = repoFiles(["src"])
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

  // --- 2.5 внешние адреса (долг 173) -----------------------------------
  //
  // Строки-комментарии отрезаются, и это не придирка: `src/lib/safe-redirect.ts`
  // объясняет правку на примере `https://evil.com`, и без этого отреза
  // сторож требовал бы назвать evil.com в политике конфиденциальности.
  const hostFiles = srcFiles.filter((f) => !f.startsWith("src/generated/"));
  const hosts = new Map();
  hostFiles.forEach((file) => {
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      return;
    }
    src.split("\n").forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      for (const m of line.matchAll(/["'`]https?:\/\/([A-Za-z0-9.-]+)/g)) {
        const host = m[1].toLowerCase();
        // Не адрес: заполнитель вида `https://...` в placeholder поля ввода.
        if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) continue;
        if (!hosts.has(host)) hosts.set(host, `${file}:${i + 1}`);
      }
    });
  });

  const namedHosts = [];
  for (const [host, where] of hosts) {
    if (HOSTS_WITHOUT_NAME.has(host)) continue;
    const label = HOST_PROCESSORS.get(host);
    if (!label) {
      failures.push(
        `код ходит на «${host}» (${where}), а политика о нём МОЛЧИТ.\n` +
          `        Внешний адрес — это либо получатель данных (впишите хост в HOST_PROCESSORS ` +
          `И его имя в раздел обработчиков ОБЕИХ локалей ${LEGAL}), либо не получатель ` +
          `(впишите в HOSTS_WITHOUT_NAME с причиной). Молча — нельзя: именно так ` +
          `MyMemory и прожил в коде, не будучи назван в политике (долг 173).`,
      );
      continue;
    }
    for (const [locale, body] of Object.entries(sections)) {
      if (!body) continue;
      if (body.includes(label)) continue;
      failures.push(
        `код ходит на «${host}» (${where}), а получатель «${label}» НЕ НАЗВАН в разделе ` +
          `обработчиков локали ${locale}. Анкета Data safety спрашивает ровно об этом списке.`,
      );
    }
    namedHosts.push(`${host} → ${label}`);
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

  // --- 4. якорь на раздел о правах (13.09.2026) -----------------------
  //
  // В анкете Google Play Data safety есть поле «Delete account URL»: туда
  // требуется адрес, ведущий ИМЕННО на объяснение, как удалить учётную
  // запись. Ссылка на политику целиком — это ссылка на 12 разделов, среди
  // которых проверяющий обязан искать сам, и на ревью это законное
  // замечание. Адрес держится на двух вещах сразу, и без любой из них он
  // молча перестаёт работать: слаг у раздела в ОБЕИХ локалях и `id` у
  // `<section>` в отрисовщике. Поэтому проверяются обе.
  const anchors = [...text.matchAll(/slug: "([\w-]+)"/g)].map((m) => m[1]);
  const rightsAnchors = anchors.filter((a) => a === REQUIRED_ANCHOR).length;
  if (rightsAnchors !== 2) {
    failures.push(
      `якорей «${REQUIRED_ANCHOR}» на раздел о правах найдено ${rightsAnchors}, а нужно два — по одному на локаль. ` +
        `На этот адрес ссылается поле «Delete account URL» анкеты Google Play, и молча он не ломается.`,
    );
  }
  const view = readFileSync(LEGAL_VIEW, "utf8");
  if (!/<section[^>]*\bid=\{section\.slug\}/.test(view)) {
    failures.push(
      `${LEGAL_VIEW}: у <section> нет id={section.slug} — слаг в данных есть, а якоря в разметке нет, ` +
        `то есть адрес с «#» ведёт на начало страницы и ничего не выделяет.`,
    );
  }

  // --- 5. Google Play и данные, которые обязаны быть названы (7.242) ---
  const facts = codeFacts();
  failures.push(...playTruthFailures(text, facts));

  return {
    failures,
    facts,
    anchors,
    sends,
    voiceRoutes,
    apiDirs: apiDirs.length,
    claims,
    imported,
    hosts: [...hosts.keys()],
    namedHosts,
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
    `  внешние адреса: найдено в src/ ${r.hosts.length}; из них получателей данных ${r.namedHosts.length} ` +
      `(${r.namedHosts.join(", ")}), остальные ${r.hosts.length - r.namedHosts.length} — в HOSTS_WITHOUT_NAME с причиной`,
  );
  console.log(
    `  названы без зависимости: ${[...NAMED_WITHOUT_DEPENDENCY.keys().toArray?.() ?? NAMED_WITHOUT_DEPENDENCY.keys()].join(", ")}`,
  );
  console.log(`  даты последнего изменения: ${r.dates.join(", ")}, обе написаны рукой`);
  console.log(
    `  Google Play и данные (7.242): продаёт через магазин — ${r.facts.sellsInStore ? "да" : "нет"}, ` +
      `удаление отменяет подписку магазина — ${r.facts.deletionCancelsStore ? "да" : "нет"}, ` +
      `резервные копии ${r.facts.backupDays} дней; пояс, группы, публичный профиль, страна по IP — названы в обеих локалях; ` +
      `ложных обещаний отмены при удалении 0 (правовые тексты, два словаря, страница удаления)`,
  );
  console.log(
    `  якоря на разделы: ${r.anchors.length} (${r.anchors.join(", ")}); ` +
      `«${REQUIRED_ANCHOR}» — в обеих локалях, id={section.slug} в отрисовщике на месте`,
  );
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
      name: "ПОДСАДКА ДОЛГА 173: фиктивный вызов наружу по адресу, которого нет в политике",
      plant: () => {
        writeFileSync(
          PLANTED,
          'export const ping = () => fetch("https://tracker.example.net/collect", { method: "POST" });\n',
        );
        execFileSync("git", ["add", "-N", PLANTED]);
        return () => {
          execFileSync("git", ["rm", "-q", "--cached", PLANTED]);
          rmSync(PLANTED);
        };
      },
      expect: (r) => r.failures.some((m) => m.includes("«tracker.example.net»") && m.includes("МОЛЧИТ")),
    },
    {
      name: "ОБРАТНОЕ НАПРАВЛЕНИЕ ТОГО ЖЕ ПРАВИЛА: имя получателя убрано из политики, а код к нему ходит",
      plant: () => swapLine(LEGAL, "• MyMemory — traducción de palabras sueltas",
        '          "• Traducción de palabras sueltas.",'),
      expect: (r) =>
        r.failures.some((m) => m.includes("api.mymemory.translated.net") && m.includes("«MyMemory»") && m.includes("локали es")) &&
        !r.failures.some((m) => m.includes("«MyMemory»") && m.includes("локали ru")),
    },
    {
      name: "и в русской локали тоже — вторая его не спасает",
      plant: () => swapLine(LEGAL, "• MyMemory — перевод отдельных слов",
        '          "• Перевод отдельных слов.",'),
      expect: (r) =>
        r.failures.some((m) => m.includes("«MyMemory»") && m.includes("локали ru")) &&
        !r.failures.some((m) => m.includes("«MyMemory»") && m.includes("локали es")),
    },
    {
      name: "ОТРИЦАТЕЛЬНЫЙ: адрес внутри строки-комментария (`https://evil.com` в safe-redirect.ts) политики не требует",
      plant: () => () => {},
      expect: (r) => r.failures.length === 0,
      negative: true,
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
        swapLine(LEGAL, "const PRIVACY_LAST_UPDATED = \"", "const PRIVACY_LAST_UPDATED = new Date().toISOString().slice(0, 10);"),
      expect: (r) => r.failures.some((m) => m.includes("вычисляется, а не написана рукой")),
    },
    {
      name: "подпись к дате снята с одного документа",
      plant: () => swap(LEGAL, '    lastUpdatedLabel: "Última actualización:",\n', ""),
      expect: (r) => r.failures.some((m) => m.startsWith("подписей к дате 3")),
    },
    {
      name: "якорь на раздел о правах снят с одной локали",
      plant: () => swap(LEGAL, '        slug: "tus-derechos",\n        paragraphs: [\n          "Tienes derecho', '        paragraphs: [\n          "Tienes derecho'),
      expect: (r) => r.failures.some((m) => m.includes("на раздел о правах найдено 1")),
    },
    {
      name: "слаг в данных есть, а id в разметке нет",
      plant: () => swap(LEGAL_VIEW, "id={section.slug}", ""),
      expect: (r) => r.failures.some((m) => m.includes("нет id={section.slug}")),
    },
    // --- 7.242: Р2, Р3, Р14 ---
    {
      name: "Р2: в Условия /es вернулось «удаление отменяет любую активную подписку»",
      plant: () => swap(LEGAL, "y elimina de forma permanente tu cuenta y tu progreso.", "y elimina de forma permanente tu cuenta y tu progreso, y cancela cualquier suscripción activa."),
      expect: (r) => r.failures.some((m) => m.includes("cancela cualquier suscripci")),
    },
    {
      name: "Р2: и в русские Условия тоже",
      plant: () => swap(LEGAL, "безвозвратно удаляет ваш аккаунт и прогресс обучения.", "безвозвратно удаляет ваш аккаунт и прогресс обучения и отменяет любую активную подписку."),
      expect: (r) => r.failures.some((m) => m.includes("отменяет любую активную подписку")),
    },
    {
      name: "Р2: из раздела 3 Условий /es пропал адрес центра подписок Google Play",
      plant: () => swap(LEGAL, "sólo se puede cancelar en Google Play → Suscripciones (https://play.google.com/store/account/subscriptions), no desde tu perfil", "sólo se puede cancelar en Google Play, no desde tu perfil"),
      expect: (r) => r.failures.some((m) => m.startsWith("Условия /es, раздел 3")) && !r.failures.some((m) => m.startsWith("Условия /ru, раздел 3")),
    },
    {
      name: "Р3: страница подтверждения снова пишет «se eliminarán tu progreso, suscripción»",
      plant: () => swap("src/dictionaries/es.json", "Esta acción es irreversible: se eliminarán tu cuenta, tu progreso y todos sus datos.", "Esta acción es irreversible: se eliminarán tu progreso, suscripción y todos los datos de la cuenta."),
      expect: (r) => r.failures.some((m) => m.startsWith("src/dictionaries/es.json")),
    },
    {
      name: "Р3 ОБРАТНОЕ НАПРАВЛЕНИЕ: удаление научилось отменять подписку магазина — «НЕ отменяется» стало ложью",
      plant: () => swap(DELETE_ROUTE, "  await db.user.delete(", "  await cancelRevenuecatSubscriptions(user.id);\n  await db.user.delete("),
      expect: (r) => r.failures.some((m) => m.includes("теперь обращается к магазину")),
    },
    {
      name: "Р14: копии стали жить 30 дней, а текст говорит «14»",
      plant: () => swap(BACKUP, "const RETENTION_COUNT = 14;", "const RETENTION_COUNT = 30;"),
      expect: (r) => r.failures.some((m) => m.includes("резервные копии живут 30 дней")),
    },
    {
      name: "Р14: из Политики /es пропал часовой пояс",
      plant: () => swapLine(LEGAL, "Zona horaria: guardamos la zona horaria", '          "Ajustes: guardamos tus preferencias.",'),
      expect: (r) => r.failures.some((m) => m.includes("/es, раздел 2") && m.includes("часовой пояс")),
    },
    {
      name: "Р14: из Политики /ru пропали учебные группы и публичный профиль",
      plant: () => swapLine(LEGAL, "Учебные группы и публичный профиль:", '          "Сообщество: пока пусто.",'),
      expect: (r) => r.failures.some((m) => m.includes("/ru, раздел 2") && m.includes("учебные группы")) && r.failures.some((m) => m.includes("/ru, раздел 2") && m.includes("публичный профиль")),
    },
    {
      name: "Р14: из Политики /es пропала страна по IP",
      plant: () => swapLine(LEGAL, "País aproximado: nuestro proveedor", '          "Idioma: elegimos el idioma de la interfaz.",'),
      expect: (r) => r.failures.some((m) => m.includes("/es, раздел 2") && m.includes("страна по IP")),
    },
    {
      name: "Р14: из раздела 6 Политики /ru пропал Resend",
      plant: () => swap(LEGAL, "журналы отправки писем Resend (адрес и тема); и отчёты", "и отчёты"),
      expect: (r) => r.failures.some((m) => m.includes("/ru, раздел 6") && m.includes("«Resend»")),
    },
    {
      name: "Р4: из раздела о правах /es пропал адрес страницы удаления",
      plant: () => swap(LEGAL, "Los pasos completos, qué se borra y qué se conserva están en https://rusofacilapp.com/es/eliminar-cuenta.", ""),
      expect: (r) => r.failures.some((m) => m.includes("/es, раздел 7")),
    },
    {
      name: "ОТРИЦАТЕЛЬНЫЙ 7.242: правка абзаца, не касающегося подписок и данных, — сторож молчит",
      plant: () => swap(LEGAL, "No debes: intentar acceder a cuentas ajenas", "No debes: intentar entrar en cuentas ajenas"),
      expect: (r) => r.failures.length === 0,
      negative: true,
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
