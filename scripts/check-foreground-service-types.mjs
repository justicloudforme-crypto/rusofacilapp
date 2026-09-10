// ТИП СЛУЖБЫ ПЕРЕДНЕГО ПЛАНА В ПАКЕТЕ ⇄ ПАРНОЕ РАЗРЕШЕНИЕ В ПАКЕТЕ.
// Правило двустороннее, и обе стороны нужны по разным причинам.
//
// ПОЧЕМУ ЭТО СУЩЕСТВУЕТ (долг 111). `@capgo/capacitor-media-session`
// объявляет свою службу с `android:foregroundServiceType="mediaPlayback"`,
// а `MediaSessionService.java:132–134` на API 29+ безусловно зовёт
// `startForeground(…, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)`.
// Начиная с Android 14 (API 34) приложение с `targetSdkVersion >= 34`
// обязано объявить разрешение, ПАРНОЕ каждому объявленному типу; иначе
// система отвечает на этот вызов `SecurityException`. У нас
// `targetSdkVersion = 36`, а разрешения `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
// до 09.09.2026 не было ни в одном файле проекта и ни в одном плагине —
// то есть первая же попытка фонового воспроизведения уронила бы службу.
//
// ПОЧЕМУ СТОРОЖ ЧИТАЕТ ПАКЕТ, А НЕ ИСХОДНИКИ. Ни одна половина связки в
// наших файлах не написана целиком: тип живёт в манифесте плагина внутри
// `node_modules`, разрешение — в нашем манифесте, а в одном множестве они
// оказываются только после слияния манифестов, то есть в APK. Судить о
// связке по исходнику — значит судить по половине.
//
// ДВЕ СТОРОНЫ ПРАВИЛА:
//
//   тип есть  → разрешение обязано быть  (иначе SecurityException у
//               живого пользователя; это и был долг 111)
//   разрешение есть → тип обязан быть у какой-нибудь службы (иначе это
//               разрешение без потребителя: Play Console спрашивает про
//               каждое, а объяснять нечем)
//
// Плюс общее: при любом объявленном типе обязано быть
// `android.permission.FOREGROUND_SERVICE` (Android 9+).
//
//   node scripts/check-foreground-service-types.mjs --xmltree=<файл>  # гейт
//   node scripts/check-foreground-service-types.mjs --plant           # контроль
//
// Вход гейта — вывод `aapt2 dump xmltree --file AndroidManifest.xml <apk>`;
// его даёт `.github/workflows/android-debug.yml`. `--plant` ни APK, ни SDK
// не требует: он строит заведомо здоровый дамп и портит его шестью
// способами.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MANIFEST = "android/app/src/main/AndroidManifest.xml";
const VARIABLES = "android/variables.gradle";

/** Бит типа → имя типа и ПАРНОЕ разрешение. Значения битов — из
 *  `android.content.pm.ServiceInfo` (FOREGROUND_SERVICE_TYPE_*), имена
 *  разрешений — из `android.Manifest.permission`. Таблица закрытая:
 *  неизвестный бит роняет проверку, а не проходит молча. */
export const FGS_TYPES = new Map([
  [0x00000001, { name: "dataSync", permission: "android.permission.FOREGROUND_SERVICE_DATA_SYNC" }],
  [0x00000002, { name: "mediaPlayback", permission: "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" }],
  [0x00000004, { name: "phoneCall", permission: "android.permission.FOREGROUND_SERVICE_PHONE_CALL" }],
  [0x00000008, { name: "location", permission: "android.permission.FOREGROUND_SERVICE_LOCATION" }],
  [0x00000010, { name: "connectedDevice", permission: "android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" }],
  [0x00000020, { name: "mediaProjection", permission: "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" }],
  [0x00000040, { name: "camera", permission: "android.permission.FOREGROUND_SERVICE_CAMERA" }],
  [0x00000080, { name: "microphone", permission: "android.permission.FOREGROUND_SERVICE_MICROPHONE" }],
  [0x00000100, { name: "health", permission: "android.permission.FOREGROUND_SERVICE_HEALTH" }],
  [0x00000200, { name: "remoteMessaging", permission: "android.permission.FOREGROUND_SERVICE_REMOTE_MESSAGING" }],
  [0x00000400, { name: "systemExempted", permission: "android.permission.FOREGROUND_SERVICE_SYSTEM_EXEMPTED" }],
  // Единственный тип без парного разрешения — так решено системой, а не
  // нами: короткая служба ограничена по времени и права не требует.
  [0x00000800, { name: "shortService", permission: null }],
  [0x00001000, { name: "fileManagement", permission: "android.permission.FOREGROUND_SERVICE_FILE_MANAGEMENT" }],
  [0x00002000, { name: "specialUse", permission: "android.permission.FOREGROUND_SERVICE_SPECIAL_USE" }],
]);

/** С этой версии цели правило системы включается. Ниже неё
 *  `SecurityException` не бросается, и сторож это печатает, а не молчит. */
export const TYPED_PERMISSIONS_SINCE = 34;

const FOREGROUND_SERVICE = "android.permission.FOREGROUND_SERVICE";

/** Разбор `aapt2 dump xmltree`. Формат — дерево с отступами; нам нужны
 *  только `uses-permission`, `service` и `targetSdkVersion`, поэтому
 *  разбирается отступ и имя узла, а не весь XML. */
export function parseXmltree(text) {
  const lines = text.split("\n");
  const permissions = new Set();
  const services = [];
  let targetSdk = null;
  let current = null;
  let currentIndent = -1;

  const indentOf = (l) => l.length - l.trimStart().length;

  for (const line of lines) {
    const trimmed = line.trim();
    const indent = indentOf(line);

    if (current !== null && indent <= currentIndent && /^E: /.test(trimmed)) current = null;

    const el = trimmed.match(/^E: (\w[\w-]*) /);
    if (el) {
      if (el[1] === "service") {
        current = { name: null, types: 0, typeRaw: null };
        currentIndent = indent;
        services.push(current);
      } else if (el[1] !== "intent-filter" && el[1] !== "action" && el[1] !== "meta-data" && el[1] !== "category") {
        current = null;
      }
      continue;
    }

    const attr = trimmed.match(/^A: (?:http:\/\/schemas\.android\.com\/apk\/res\/android:)?([\w-]+)\([^)]*\)=(.*)$/);
    if (!attr) continue;
    const [, key, rawValue] = attr;
    const quoted = rawValue.match(/^"([^"]*)"/)?.[1] ?? null;
    const numeric = rawValue.match(/^(0x[0-9a-fA-F]+|\d+)/)?.[1] ?? null;

    if (key === "targetSdkVersion" && numeric !== null) targetSdk = Number(numeric);
    if (key === "name" && quoted !== null && current !== null && current.name === null) {
      current.name = quoted;
    }
    if (key === "foregroundServiceType" && numeric !== null && current !== null) {
      current.types = Number(numeric);
      current.typeRaw = numeric;
    }
  }

  // Разрешения берутся отдельным проходом: узел `uses-permission` —
  // одноуровневый, и путать его `name` с `name` службы нельзя.
  const blocks = text.split(/^\s*E: /m);
  for (const b of blocks) {
    if (!b.startsWith("uses-permission ")) continue;
    const n = b.match(/android:name\(0x[0-9a-f]+\)="([^"]+)"/)?.[1];
    if (n) permissions.add(n);
  }

  return { permissions, services: services.filter((s) => s.types !== 0), targetSdk };
}

/** Разложение числа на известные биты. Неизвестный остаток возвращается
 *  отдельно — молчать о нём нельзя. */
export function splitTypes(bits) {
  const known = [];
  let rest = bits;
  for (const [bit, info] of FGS_TYPES) {
    if ((bits & bit) === bit) {
      known.push({ bit, ...info });
      rest &= ~bit;
    }
  }
  return { known, rest };
}

/** Единственное место, где принимается решение. Пустой список — «сошлось». */
export function compare(pkg) {
  const bad = [];
  const needed = new Map(); // разрешение → службы, которым оно нужно

  for (const svc of pkg.services) {
    const { known, rest } = splitTypes(svc.types);
    if (rest !== 0) {
      bad.push(
        `служба ${svc.name}: тип 0x${rest.toString(16)} сторожу неизвестен — допишите его в FGS_TYPES вместе с парным разрешением`,
      );
    }
    for (const t of known) {
      if (t.permission === null) continue;
      if (!needed.has(t.permission)) needed.set(t.permission, []);
      needed.get(t.permission).push(`${svc.name} (${t.name})`);
    }
  }

  // Сторона 1: тип есть — разрешение обязано быть.
  for (const [permission, users] of needed) {
    if (pkg.permissions.has(permission)) continue;
    bad.push(
      `тип службы объявлен, а парного разрешения в пакете нет: ${permission} нужен для ${users.join(", ")}.\n` +
        `      При targetSdkVersion >= ${TYPED_PERMISSIONS_SINCE} система отвечает на startForeground с этим типом SecurityException.`,
    );
  }

  // Сторона 2: разрешение есть — тип обязан быть у какой-нибудь службы.
  const typed = new Set([...FGS_TYPES.values()].map((t) => t.permission).filter(Boolean));
  for (const p of pkg.permissions) {
    if (!typed.has(p) || needed.has(p)) continue;
    bad.push(
      `разрешение ${p} объявлено, а службы с парным ему типом в пакете нет.\n` +
        `      Play Console спрашивает про каждое разрешение в загруженном пакете, и объяснять это нечем.`,
    );
  }

  // Общее: любой тип требует самого FOREGROUND_SERVICE.
  if (pkg.services.length > 0 && !pkg.permissions.has(FOREGROUND_SERVICE)) {
    bad.push(`служб с типом ${pkg.services.length}, а ${FOREGROUND_SERVICE} в пакете нет — без него служба не стартует вовсе`);
  }

  if (pkg.targetSdk === null) bad.push("в дампе нет targetSdkVersion — читать нечего");
  return bad;
}

/** Здоровый дамп строится из наших же исходников, чтобы контроль не
 *  требовал ни APK, ни SDK. Служба здесь одна и та же, что в пакете:
 *  тип она приносит из манифеста плагина. */
function healthyXmltree() {
  const manifest = readFileSync(MANIFEST, "utf-8");
  const variables = readFileSync(VARIABLES, "utf-8");
  const targetSdk = variables.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1] ?? "36";
  const ours = [...manifest.matchAll(/<uses-permission\b([\s\S]*?)\/>/g)]
    .filter((m) => !/tools:node="remove"/.test(m[1]))
    .map((m) => m[1].match(/android:name="([^"]+)"/)?.[1])
    .filter(Boolean);
  const merged = [FOREGROUND_SERVICE, "android.permission.VIBRATE", "android.permission.WAKE_LOCK"];
  const perms = [...new Set([...ours, ...merged])];
  return [
    `N: android=http://schemas.android.com/apk/res/android (line=2)`,
    `  E: manifest (line=2)`,
    `    A: package="com.rusofacilapp.app" (Raw: "com.rusofacilapp.app")`,
    `      E: uses-sdk (line=7)`,
    `        A: http://schemas.android.com/apk/res/android:minSdkVersion(0x0101020c)=24`,
    `        A: http://schemas.android.com/apk/res/android:targetSdkVersion(0x01010270)=${targetSdk}`,
    ...perms.map(
      (p) =>
        `      E: uses-permission (line=13)\n        A: http://schemas.android.com/apk/res/android:name(0x01010003)="${p}" (Raw: "${p}")`,
    ),
    `      E: application (line=20)`,
    `          E: service (line=127)`,
    `            A: http://schemas.android.com/apk/res/android:name(0x01010003)="com.capgo.mediasession.MediaSessionService" (Raw: "com.capgo.mediasession.MediaSessionService")`,
    `            A: http://schemas.android.com/apk/res/android:exported(0x01010010)=true`,
    `            A: http://schemas.android.com/apk/res/android:foregroundServiceType(0x01010599)=0x00000002`,
    `              E: intent-filter (line=132)`,
    `                  E: action (line=133)`,
    `                    A: http://schemas.android.com/apk/res/android:name(0x01010003)="android.intent.action.MEDIA_BUTTON" (Raw: "android.intent.action.MEDIA_BUTTON")`,
    `          E: service (line=247)`,
    `            A: http://schemas.android.com/apk/res/android:name(0x01010003)="com.google.android.datatransport.runtime.scheduling.jobscheduling.JobInfoSchedulerService" (Raw: "…")`,
    `            A: http://schemas.android.com/apk/res/android:exported(0x01010010)=false`,
  ].join("\n");
}

const MEDIA_PERM = "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK";

function main() {
  if (process.argv.includes("--plant")) {
    console.log("check:fgs-types --plant");
    const healthy = healthyXmltree();
    const dropPerm = (text, p) =>
      text.replace(
        new RegExp(`      E: uses-permission \\(line=13\\)\\n        A: [^\\n]*"${p.replace(/\./g, "\\.")}"[^\\n]*\\n`),
        "",
      );
    const plants = [
      [
        "ровно долг 111: тип mediaPlayback на службе есть, разрешения нет",
        dropPerm(healthy, MEDIA_PERM),
      ],
      [
        "тип пропал со службы, разрешение осталось — разрешение без потребителя",
        healthy.replace(/\n[^\n]*foregroundServiceType[^\n]*/, ""),
      ],
      [
        "к mediaPlayback добавился camera, парного разрешения нет",
        healthy.replace("=0x00000002", "=0x00000042"),
      ],
      [
        "разрешение под микрофонную службу объявлено, службы такой нет",
        healthy.replace(
          `      E: application (line=20)`,
          `      E: uses-permission (line=99)\n        A: http://schemas.android.com/apk/res/android:name(0x01010003)="android.permission.FOREGROUND_SERVICE_MICROPHONE" (Raw: "android.permission.FOREGROUND_SERVICE_MICROPHONE")\n      E: application (line=20)`,
        ),
      ],
      [
        "сам FOREGROUND_SERVICE пропал из пакета",
        dropPerm(healthy, FOREGROUND_SERVICE),
      ],
      [
        "на службе тип, которого сторож не знает",
        healthy.replace("=0x00000002", "=0x00040002"),
      ],
    ];
    let caught = 0;
    for (const [name, text] of plants) {
      const bad = compare(parseXmltree(text));
      const hit = bad.length > 0;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${name}${hit ? ` → ${bad[0].split("\n")[0]}` : ""}`);
      if (hit) caught += 1;
    }
    const cleanBad = compare(parseXmltree(healthy));
    const quiet = cleanBad.length === 0;
    console.log(
      `  ${quiet ? "отрицательный контроль: здоровый дамп — молчание" : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН: ${cleanBad.join("; ")}`}`,
    );
    console.log(`  поймано ${caught} из ${plants.length}`);
    process.exit(caught === plants.length && quiet ? 0 : 1);
  }

  const arg = process.argv.find((a) => a.startsWith("--xmltree="));
  if (!arg) {
    console.error("нужен --xmltree=<вывод `aapt2 dump xmltree --file AndroidManifest.xml <apk>`> или --plant");
    process.exit(1);
  }
  const pkg = parseXmltree(readFileSync(arg.slice("--xmltree=".length), "utf-8"));
  const bad = compare(pkg);

  console.log(`targetSdkVersion в пакете: ${pkg.targetSdk} (правило системы включается с ${TYPED_PERMISSIONS_SINCE})`);
  console.log(`служб с типом переднего плана: ${pkg.services.length}`);
  for (const svc of pkg.services) {
    const { known, rest } = splitTypes(svc.types);
    console.log(
      `  ${svc.name} — ${svc.typeRaw} = ${known.map((t) => t.name).join("|") || "?"}${rest ? ` + неизвестный остаток 0x${rest.toString(16)}` : ""}`,
    );
    for (const t of known) {
      console.log(
        `    ${t.name} → ${t.permission ?? "разрешения не требует"}${
          t.permission ? (pkg.permissions.has(t.permission) ? " — в пакете есть" : " — В ПАКЕТЕ НЕТ") : ""
        }`,
      );
    }
  }

  if (bad.length === 0) {
    console.log("check:fgs-types — связка «тип ⇄ разрешение» сошлась в обе стороны, расхождений 0.");
    process.exit(0);
  }
  for (const line of bad) console.error(`РАСХОЖДЕНИЕ: ${line}`);
  process.exit(1);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) main();
