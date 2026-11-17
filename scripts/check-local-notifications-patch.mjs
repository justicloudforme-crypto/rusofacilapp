/**
 * НАПОМИНАНИЕ СО ВТОРОГО ДНЯ БУДИТ ТЕЛЕФОН — СТОРОЖ ЗАХОДА 7.288 (долг 408).
 *
 * Замер на эмуляторе 17.11.2026 (7.287, 1.0.16): день 1 плагин ставит
 * `RTC_WAKEUP` (`setAndAllowWhileIdle`), а после срабатывания сам ставит
 * следующий день `alarmManager.set(AlarmManager.RTC, …)` — без права будить
 * телефон. В глубоком сне день 2 пришёл в 20:03, после окна 19:00–20:00.
 * Замер «до/после» 7.288 — `docs/progress-archive/runs-2026-11.md`, 7.288.
 *
 * Места, каждое из которых порознь возвращает болезнь:
 *   1) перестановка следующего дня (`TimedNotificationPublisher.kt`, плагин
 *      собирается из `node_modules`) при `allowWhileIdle` ставит
 *      `setAndAllowWhileIdle(RTC_WAKEUP)` — заплатка
 *      `scripts/patch-local-notifications.mjs`;
 *   2) заплатка накладывается сама после установки (`postinstall`);
 *   3) сайт просит `allowWhileIdle: true` и `isExactNotification: false`
 *      (`src/lib/notifications.ts`) — без первого заплатке нечего читать,
 *      без второго плагин открыл бы ученику экран «Alarms & reminders»;
 *   4) в манифесте точный будильник вырезан (`tools:node="remove"`) и
 *      `USE_EXACT_ALARM` не появился — декларации Play (решение 7.158).
 *
 * Сторож слепнет честно: нет файла плагина — это нарушение, а не «чисто».
 *
 *   node scripts/check-local-notifications-patch.mjs          # гейт
 *   node scripts/check-local-notifications-patch.mjs --plant  # контроль подсадками
 */
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PATCHES, PUBLISHER, applyPatches } from "./patch-local-notifications.mjs";

const PLANT = process.argv.slice(2).includes("--plant");
const SITE = "src/lib/notifications.ts";
const MANIFEST = "android/app/src/main/AndroidManifest.xml";
const PKG = "package.json";

function read() {
  return {
    publisher: existsSync(PUBLISHER) ? readFileSync(PUBLISHER, "utf8") : "",
    site: readFileSync(SITE, "utf8"),
    manifest: readFileSync(MANIFEST, "utf8"),
    pkg: readFileSync(PKG, "utf8"),
  };
}

/** Тело именованной функции Kotlin — по имени и скобкам, а не по строкам. */
function fnBody(code, name) {
  const at = code.indexOf(`fun ${name}(`);
  if (at === -1) return "";
  let depth = 0;
  for (let i = code.indexOf("{", at); i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}" && --depth === 0) return code.slice(at, i + 1);
  }
  return "";
}

export function violationsIn(src) {
  const bad = [];
  if (!src.publisher.trim()) {
    bad.push(`${PUBLISHER} не найден — сторож ослеп (плагин не установлен или переехал)`);
  } else {
    const body = fnBody(src.publisher, "rescheduleNotificationIfNeeded");
    if (!body) bad.push("в TimedNotificationPublisher нет rescheduleNotificationIfNeeded() — плагин изменился, заплатку надо пересобрать");
    else {
      if (!/getJSObject\("schedule"\)\?\.getBoolean\("allowWhileIdle"/.test(body)) {
        bad.push("перестановка следующего дня не читает allowWhileIdle — со второго дня RTC без пробуждения (долг 408)");
      }
      if (!/setAndAllowWhileIdle\(AlarmManager\.RTC_WAKEUP/.test(body)) {
        bad.push("перестановка следующего дня не ставит setAndAllowWhileIdle(RTC_WAKEUP) — в глубоком сне напоминание опаздывает (долг 408)");
      }
      // Голый RTC допустим только в ветке «allowWhileIdle = false».
      const bare = body.match(/alarmManager\.set(?:Exact)?\(AlarmManager\.RTC,/g) ?? [];
      const guarded = body.match(/\} else \{\s*\n\s*alarmManager\.set(?:Exact)?\(AlarmManager\.RTC,/g) ?? [];
      if (bare.length !== guarded.length) {
        bad.push("в перестановке следующего дня есть RTC вне ветки «без allowWhileIdle» — будильник без пробуждения (долг 408)");
      }
    }
  }
  let postinstall = "";
  try {
    postinstall = JSON.parse(src.pkg).scripts?.postinstall ?? "";
  } catch {
    bad.push("package.json не разбирается");
  }
  if (!/node scripts\/patch-local-notifications\.mjs/.test(postinstall)) {
    bad.push("postinstall не накладывает заплатку напоминаний — на CI и при сборке AAB плагин соберётся без неё");
  }
  if (!/allowWhileIdle:\s*true/.test(src.site)) {
    bad.push(`${SITE}: напоминание без allowWhileIdle: true — заплатке нечего читать, в глубоком сне молчит`);
  }
  if (!/isExactNotification:\s*false/.test(src.site)) {
    bad.push(`${SITE}: напоминание без isExactNotification: false — плагин откроет экран «Alarms & reminders» (долг 107)`);
  }
  if (!/android\.permission\.SCHEDULE_EXACT_ALARM"\s*\n?\s*tools:node="remove"/.test(src.manifest)) {
    bad.push(`${MANIFEST}: SCHEDULE_EXACT_ALARM не вырезан tools:node="remove" — новое разрешение ломает декларации Play`);
  }
  if (/USE_EXACT_ALARM/.test(src.manifest)) {
    bad.push(`${MANIFEST}: USE_EXACT_ALARM — разрешение только для приложений-будильников, декларации Play`);
  }
  return bad;
}

/** Заплатка сама по себе: на исходном тексте плагина ложится, на
 *  исправленном — ничего не меняет. Исходный текст восстанавливается из
 *  исправленного обратной заменой — то есть ровно тот, что приносит npm. */
function patchSelfTest(patched) {
  let pristine = patched;
  for (const p of PATCHES) pristine = pristine.replace(p.to, p.from);
  const first = applyPatches(pristine);
  const second = applyPatches(first.text);
  return {
    pristine,
    pristineDiffers: pristine !== patched,
    applied: first.report.every((r) => r.state === "наложена"),
    idempotent: second.text === first.text && second.report.every((r) => r.state === "уже стоит"),
    same: first.text === patched,
  };
}

function plant() {
  const raw = read();
  const cases = [];
  const planted = (file, from, to, name, expect) => {
    const mutated = { ...raw, [file]: raw[file].replace(from, to) };
    if (mutated[file] === raw[file]) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violationsIn(mutated).some((f) => f.includes(expect)) });
  };
  cases.push({ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violationsIn(raw).length === 0 });
  cases.push({
    name: "пустой вход (нет плагина, сайта, манифеста) — сторож краснеет, а не молчит",
    ok: violationsIn({ publisher: "", site: "", manifest: "", pkg: "{}" }).length >= 4,
  });
  planted(
    "publisher",
    "alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent)",
    "alarmManager.set(AlarmManager.RTC, trigger, pendingIntent)",
    "подсадка: перестановка снова RTC (как в 1.0.16) — поймано",
    "setAndAllowWhileIdle",
  );
  planted("pkg", " && node scripts/patch-local-notifications.mjs", "", "подсадка: postinstall без заплатки — поймано", "postinstall");
  planted("site", "allowWhileIdle: true", "allowWhileIdle: false", "подсадка: сайт без allowWhileIdle — поймано", "allowWhileIdle: true");
  planted("site", "isExactNotification: false", "isExactNotification: true", "подсадка: сайт просит точный будильник — поймано", "Alarms & reminders");
  planted("manifest", "</manifest>", '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />\n</manifest>', "подсадка: USE_EXACT_ALARM в манифесте — поймано", "USE_EXACT_ALARM");
  if (raw.publisher) {
    const t = patchSelfTest(raw.publisher);
    cases.push({ name: "заплатка: исходный текст плагина отличается от исправленного", ok: t.pristineDiffers });
    cases.push({ name: "заплатка: исходный текст плагина сторож ловит (как 1.0.16)", ok: violationsIn({ ...raw, publisher: t.pristine }).some((f) => f.includes("долг 408")) });
    cases.push({ name: "заплатка: на исходном тексте ложится", ok: t.applied });
    cases.push({ name: "заплатка: повторный запуск ничего не меняет", ok: t.idempotent });
    cases.push({ name: "заплатка: результат побайтово равен файлу в node_modules", ok: t.same });
    const drift = applyPatches(t.pristine.replace("alarmManager.set(AlarmManager.RTC, trigger, pendingIntent)", "alarmManager.set(AlarmManager.RTC, at, pendingIntent)"));
    cases.push({ name: "заплатка: плагин без якоря — отчёт «ЯКОРЯ НЕТ», а не молчание", ok: drift.report.some((r) => r.state === "ЯКОРЯ НЕТ") });
  } else cases.push({ name: "плагин в node_modules есть", ok: false });

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:local-notifications-patch --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const bad = violationsIn(read());
  if (bad.length) {
    console.error("НАПОМИНАНИЕ СО ВТОРОГО ДНЯ СНОВА НЕ БУДИТ ТЕЛЕФОН (долг 408):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(
    "[check:local-notifications-patch] следующий день — setAndAllowWhileIdle(RTC_WAKEUP), заплатка в postinstall, сайт просит allowWhileIdle без точного будильника, в манифесте нет точного будильника (контроль — --plant).",
  );
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
