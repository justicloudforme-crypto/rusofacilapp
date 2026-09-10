// Что лежит В СОБРАННОМ APK — то и объявлено в исходниках. Проверка
// читает `aapt2 dump badging`, а не файлы проекта: до 09.09.2026 нативная
// сборка Android не собиралась НИ РАЗУ, и всё, что о ней было известно,
// доказывалось статически — чтением тех же файлов, которые правились.
// Переезд идентификатора под `com.rusofacilapp.app` (7.154) на этом и
// стоял: сторож `check:app-id` сличает одиннадцать ОБЪЯВЛЕНИЙ друг с
// другом и по построению не может сказать, что из них попало в пакет.
//
// ЧТО СЛИЧАЕТСЯ (пять величин, все из APK):
//
//   package name      → applicationId в android/app/build.gradle,
//                       appId в capacitor.config.ts и APP_ID в src/lib/brand.ts
//   versionCode       → versionCode в build.gradle
//   versionName       → versionName в build.gradle
//   application-label → app_name в strings.xml и APP_DISPLAY_NAME
//   uses-permission   → РАВЕНСТВО МНОЖЕСТВ с AndroidManifest.xml
//
// Последнее — равенство в обе стороны, а не «наши на месте»: лишнее
// разрешение в пакете так же плохо, как недостающее (та же причина, что
// у `check:native-permissions`: анкета Play Console спрашивает про
// каждое). Разрешения, добавленные системой при сборке (их вносит
// merger, а не наш манифест), названы поимённо в ALLOWED_MERGED.
//
//   node scripts/check-apk-facts.mjs --badging=<файл>   # гейт
//   node scripts/check-apk-facts.mjs --plant            # позитивный контроль
//
// `--plant` файла не требует и SDK не требует: он строит заведомо
// здоровый дамп из самих исходников и портит его шестью способами.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const GRADLE = "android/app/build.gradle";
const STRINGS = "android/app/src/main/res/values/strings.xml";
const MANIFEST = "android/app/src/main/AndroidManifest.xml";
const CAPACITOR = "capacitor.config.ts";
const BRAND = "src/lib/brand.ts";

/** РАЗРЕШЕНИЯ, КОТОРЫХ В НАШЕМ МАНИФЕСТЕ НЕТ, А В ПАКЕТЕ ЕСТЬ.
 *
 *  Найдены первой же настоящей сборкой 09.09.2026: наш
 *  `AndroidManifest.xml` объявляет ТРИ разрешения, а собранный APK несёт
 *  ДВЕНАДЦАТЬ. Девять приносит слияние манифестов библиотек, и статический
 *  сторож `check:native-permissions` их не видит по построению — он читает
 *  наш манифест, а не пакет. Play Console спрашивает про КАЖДОЕ
 *  разрешение в загруженном пакете, а не про каждое написанное нами.
 *
 *  Происхождение каждого прочитано из
 *  `android/app/build/outputs/logs/manifest-merger-debug-report.txt`,
 *  а не угадано. Десятое, приехавшее с новой зависимостью, обязано быть
 *  замечено человеком: список закреплён ЧИСЛОМ (см. MERGED_COUNT). */
export const ALLOWED_MERGED = new Map([
  ["android.permission.VIBRATE", "@capacitor/haptics"],
  ["android.permission.RECEIVE_BOOT_COMPLETED", "@capacitor/local-notifications"],
  ["android.permission.WAKE_LOCK", "@capacitor/local-notifications"],
  ["android.permission.POST_NOTIFICATIONS", "@capacitor/local-notifications"],
  ["android.permission.FOREGROUND_SERVICE", "@capgo/capacitor-media-session"],
  ["android.permission.ACCESS_NETWORK_STATE", "com.revenuecat.purchases:purchases"],
  ["com.android.vending.BILLING", "com.android.billingclient:billing (через RevenueCat)"],
  // Записан ЧЕРЕЗ ПОДСТАНОВКУ, а не литералом: androidx.core объявляет
  // его как `${applicationId}.DYNAMIC_…`, и смена идентификатора пакета
  // не должна выглядеть «пропавшим разрешением».
  ["${applicationId}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION", "androidx.core:core"],
]);

/** Подстановка `${applicationId}` — единственная, какую делает AGP в
 *  именах разрешений. */
const withAppId = (name, applicationId) => name.replace("${applicationId}", applicationId);

/** Число, а не «примерно столько». Появилось лишнее — падение.
 *
 *  Было 9 до 09.09.2026. Стало 8: `SCHEDULE_EXACT_ALARM` больше не
 *  приезжает — он вычеркнут `tools:node="remove"` в нашем манифесте
 *  (долг 107), потому что напоминание перестало просить точный будильник
 *  (`isExactNotification: false` в `src/lib/notifications.ts`). Это
 *  ограниченное разрешение Google Play, и его отсутствие в пакете —
 *  единственная форма, в которой анкету по нему заполнять не придётся. */
const MERGED_COUNT = 8;

function readSources() {
  const gradle = readFileSync(GRADLE, "utf-8");
  const strings = readFileSync(STRINGS, "utf-8");
  const manifest = readFileSync(MANIFEST, "utf-8");
  const capacitor = readFileSync(CAPACITOR, "utf-8");
  const brand = readFileSync(BRAND, "utf-8");

  const pick = (text, re, what) => {
    const m = text.match(re);
    if (!m) throw new Error(`не найдено в исходниках: ${what}`);
    return m[1];
  };

  return {
    applicationId: pick(gradle, /applicationId\s+"([^"]+)"/, "applicationId"),
    capacitorAppId: pick(capacitor, /appId:\s*"([^"]+)"/, "appId"),
    brandAppId: pick(brand, /APP_ID\s*=\s*"([^"]+)"/, "APP_ID"),
    versionCode: pick(gradle, /versionCode\s+(\d+)/, "versionCode"),
    versionName: pick(gradle, /versionName\s+"([^"]+)"/, "versionName"),
    label: pick(strings, /<string name="app_name">([^<]+)<\/string>/, "app_name"),
    brandLabel: pick(brand, /APP_DISPLAY_NAME\s*=\s*"([^"]+)"/, "APP_DISPLAY_NAME"),
    ...splitPermissions(manifest),
  };
}

/** Наш манифест несёт записи ДВУХ противоположных смыслов, и путать их
 *  нельзя. Обычная строка ОБЪЯВЛЯЕТ разрешение; строка с
 *  `tools:node="remove"` (появилась 09.09.2026, долг 107) ВЫЧЁРКИВАЕТ
 *  разрешение, принесённое библиотекой, и в пакете его после этого нет.
 *  Считать вторую за объявление значило бы требовать в APK ровно то, что
 *  она оттуда убирает. */
export function splitPermissions(manifest) {
  const declared = new Set();
  const removed = new Set();
  for (const m of manifest.matchAll(/<uses-permission\b([\s\S]*?)\/>/g)) {
    const body = m[1];
    const name = body.match(/android:name="([^"]+)"/)?.[1];
    if (!name) continue;
    if (/tools:node="remove"/.test(body)) removed.add(name);
    else declared.add(name);
  }
  return { permissions: declared, removedPermissions: removed };
}

/** Разбор `aapt2 dump badging`. Формат строчный, кавычки одинарные. */
export function parseBadging(text) {
  const one = (re) => text.match(re)?.[1] ?? null;
  return {
    packageName: one(/^package: name='([^']+)'/m),
    versionCode: one(/versionCode='(\d+)'/),
    versionName: one(/versionName='([^']*)'/),
    label: one(/^application-label:'([^']*)'/m) ?? one(/^application:\s+label='([^']*)'/m),
    permissions: new Set([...text.matchAll(/^uses-permission: name='([^']+)'/gm)].map((m) => m[1])),
  };
}

/** Единственное место, где принимается решение. Возвращает список
 *  расхождений — пустой список и есть «сошлось». */
export function compare(apk, src) {
  const bad = [];
  const eq = (what, got, want) => {
    if (got !== want) bad.push(`${what}: в APK ${JSON.stringify(got)}, в исходниках ${JSON.stringify(want)}`);
  };
  eq("package", apk.packageName, src.applicationId);
  eq("package против capacitor.config.ts", apk.packageName, src.capacitorAppId);
  eq("package против src/lib/brand.ts", apk.packageName, src.brandAppId);
  eq("versionCode", apk.versionCode, src.versionCode);
  eq("versionName", apk.versionName, src.versionName);
  eq("витринное имя", apk.label, src.label);
  eq("витринное имя против src/lib/brand.ts", apk.label, src.brandLabel);

  for (const p of src.permissions) {
    if (!apk.permissions.has(p)) bad.push(`разрешение объявлено, но в APK его нет: ${p}`);
  }
  const allowed = new Map(
    [...ALLOWED_MERGED].map(([name, from]) => [withAppId(name, src.applicationId), from]),
  );
  // Вычеркнутое обязано в пакете ОТСУТСТВОВАТЬ. Без этого правила
  // `tools:node="remove"` мог бы молча перестать работать (опечатка в
  // имени, потерянный xmlns:tools) и никто бы не заметил.
  for (const p of src.removedPermissions ?? []) {
    if (apk.permissions.has(p)) {
      bad.push(`разрешение вычеркнуто tools:node="remove", но в APK оно есть: ${p}`);
    }
  }
  const merged = [...apk.permissions].filter((p) => !src.permissions.has(p));
  for (const p of merged) {
    if (!allowed.has(p)) {
      bad.push(
        `разрешение в APK, которого нет ни в нашем манифесте, ни в списке принесённых библиотеками: ${p}`,
      );
    }
  }
  if (merged.length !== MERGED_COUNT) {
    bad.push(
      `принесённых библиотеками разрешений ${merged.length}, а закреплено ${MERGED_COUNT}` +
        (merged.length < MERGED_COUNT
          ? ` — пропали: ${[...allowed.keys()].filter((p) => !merged.includes(p)).join(", ")}`
          : ""),
    );
  }
  return bad;
}

function healthyBadging(src) {
  return [
    `package: name='${src.applicationId}' versionCode='${src.versionCode}' versionName='${src.versionName}' platformBuildVersionName='16'`,
    `sdkVersion:'24'`,
    `targetSdkVersion:'36'`,
    ...[...src.permissions].map((p) => `uses-permission: name='${p}'`),
    ...[...ALLOWED_MERGED.keys()].map(
      (p) => `uses-permission: name='${withAppId(p, src.applicationId)}'`,
    ),
    `application-label:'${src.label}'`,
    `launchable-activity: name='${src.applicationId}.MainActivity'  label='' icon=''`,
  ].join("\n");
}

function main() {
  const src = readSources();

  if (process.argv.includes("--plant")) {
    console.log("check:apk-facts --plant");
    const healthy = healthyBadging(src);
    const plants = [
      // Значение подсадки НЕ строчная опечатка имени: её запрещает
      // `check:brand` (поймано им же на первом прогоне этого файла).
      ["package не тот, что в build.gradle", healthy.replace(src.applicationId, "com.rusofacilapp.android")],
      ["versionCode не тот, что в build.gradle", healthy.replace(`versionCode='${src.versionCode}'`, "versionCode='7'")],
      ["versionName не тот, что в build.gradle", healthy.replace(`versionName='${src.versionName}'`, "versionName='9.9'")],
      ["витринное имя — бренд сайта, а не подпись под иконкой", healthy.replace(`application-label:'${src.label}'`, "application-label:'RusoFácilapp'")],
      ["микрофон в APK не доехал", healthy.replace(/^uses-permission: name='android\.permission\.RECORD_AUDIO'\n/m, "")],
      ["лишнее разрешение приехало с зависимостью", `${healthy}\nuses-permission: name='android.permission.ACCESS_FINE_LOCATION'`],
      [
        "принесённое библиотекой разрешение ПРОПАЛО из пакета",
        healthy.replace(/^uses-permission: name='android\.permission\.POST_NOTIFICATIONS'\n/m, ""),
      ],
      // Долг 107: `tools:node="remove"` перестал работать (опечатка в
      // имени, потерянный xmlns:tools, вернувшийся плагин) — ограниченное
      // разрешение Google Play снова в пакете, и сказать об этом должен
      // сторож, а не Play Console.
      [
        "вычеркнутое tools:node=remove разрешение вернулось в пакет",
        `${healthy}\nuses-permission: name='android.permission.SCHEDULE_EXACT_ALARM'`,
      ],
    ];
    let caught = 0;
    for (const [name, text] of plants) {
      const bad = compare(parseBadging(text), src);
      const hit = bad.length > 0;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"}: ${name}${hit ? ` → ${bad[0]}` : ""}`);
      if (hit) caught += 1;
    }
    const cleanBad = compare(parseBadging(healthy), src);
    const quiet = cleanBad.length === 0;
    console.log(`  ${quiet ? "отрицательный контроль: здоровый дамп — молчание" : `ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ КРАСЕН: ${cleanBad.join("; ")}`}`);
    console.log(`  поймано ${caught} из ${plants.length}`);
    process.exit(caught === plants.length && quiet ? 0 : 1);
  }

  const arg = process.argv.find((a) => a.startsWith("--badging="));
  if (!arg) {
    console.error("нужен --badging=<файл с выводом `aapt2 dump badging`> или --plant");
    process.exit(1);
  }
  const text = readFileSync(arg.slice("--badging=".length), "utf-8");
  const apk = parseBadging(text);
  const bad = compare(apk, src);

  console.log(`APK: package ${apk.packageName}, versionCode ${apk.versionCode}, versionName ${apk.versionName}, витрина «${apk.label}»`);
  console.log(`APK: разрешений ${apk.permissions.size} — ${[...apk.permissions].sort().join(", ")}`);
  console.log(`исходники: разрешений ${src.permissions.size} — ${[...src.permissions].sort().join(", ")}`);
  const merged = [...apk.permissions].filter((p) => !src.permissions.has(p)).sort();
  console.log(`принесено библиотеками: ${merged.length} (закреплено ${MERGED_COUNT}) —`);
  const allowedNames = new Map(
    [...ALLOWED_MERGED].map(([name, from]) => [withAppId(name, src.applicationId), from]),
  );
  for (const p of merged) console.log(`  ${p} ← ${allowedNames.get(p) ?? "НЕИЗВЕСТНО ОТКУДА"}`);

  if (bad.length === 0) {
    console.log(
      `check:apk-facts — 5 величин сошлись, наших разрешений ${src.permissions.size} из ${src.permissions.size}, ` +
        `принесённых библиотеками ${MERGED_COUNT} из ${MERGED_COUNT}, расхождений 0.`,
    );
    process.exit(0);
  }
  for (const line of bad) console.error(`РАСХОЖДЕНИЕ: ${line}`);
  process.exit(1);
}

const isEntryPoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) main();
