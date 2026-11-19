/**
 * check:native-deadline — ДОЛГ 302 (заход 7.292).
 *
 * Мост Capacitor умеет оставить промис висеть вечно (`cap.nativePromise`
 * при неподнявшемся `postToNative`). Вне экрана покупки от этого не было
 * защищено ничто. Правило: плагин, который сайт зовёт БЕЗ участия человека
 * и результат которого чего-то ждёт, импортируется под именем `…Bridge` и
 * в том же файле оборачивается `withNativeDeadlines("<Имя>", <…Bridge>)`
 * (`src/lib/native-deadline.ts`); сырое имя после обёртки не зовётся.
 *
 * ПЕРЕПИСЬ, А НЕ СПИСОК ФАЙЛОВ: сторож читает ВСЕ импорты плагинов
 * Capacitor в `src/` и про каждый говорит одно из двух — «со сроком» или
 * «вне правила, причина такая-то» (`OUTSIDE`). Новый плагин, не названный
 * ни там ни там, — отказ. Пустая перепись — отказ.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { repoFiles } from "./repo-files.mjs";

const HELPER = "src/lib/native-deadline.ts";

/** Плагины под правилом: модуль → имя экспорта. */
export const DEADLINED = new Map([
  ["@capacitor/local-notifications", "LocalNotifications"],
  ["@capgo/capacitor-media-session", "MediaSession"],
]);

/** Плагины вне правила — с причиной. */
export const OUTSIDE = new Map([
  ["@capacitor/core", "сам Capacitor (isNativePlatform, registerPlugin), не вызов плагина"],
  ["@capacitor/app", "только подписки addListener и exitApp; результата никто не ждёт"],
  ["@capacitor/haptics", "вибрация зовётся без ожидания (void), после неё ничего не стоит — висящий промис ничего не держит"],
  ["@revenuecat/purchases-capacitor", "экран покупки: свой срок within() в revenuecat-client.ts (7.224)"],
  ["registerPlugin:RfShare", "окно «Поделиться» открыто, пока человек выбирает, — короткий срок оборвал бы его"],
  ["registerPlugin:RfGoogleSignIn", "окно входа Google ждёт человека"],
  ["registerPlugin:RfReview", "окно оценки ждёт человека"],
]);

function strip(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function judge(files) {
  const bad = [];
  const seen = new Map(); // ключ плагина → файлы
  const note = (key, file) => seen.set(key, [...(seen.get(key) ?? []), file]);

  for (const [file, raw] of Object.entries(files)) {
    if (!/\.(tsx?|mjs)$/.test(file) || file.includes(".test.")) continue;
    const src = strip(raw);
    for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"(@capacitor\/[\w-]+|@capgo\/[\w-]+|@revenuecat\/[\w-]+)"/g)) {
      if (m[1]) continue; // только типы — вызова нет
      const mod = m[3];
      note(mod, file);
      if (!DEADLINED.has(mod)) continue;
      const exported = DEADLINED.get(mod);
      const spec = new RegExp(`\\b${exported}\\s+as\\s+(\\w+)`).exec(m[2]);
      if (!spec || !/^\w+Bridge$/.test(spec[1])) {
        bad.push(`${file}: ${exported} из ${mod} импортирован напрямую — вызовы пойдут мимо срока (долг 302); нужно «${exported} as ${exported}Bridge» и withNativeDeadlines`);
        continue;
      }
      const alias = spec[1];
      const wrap = new RegExp(`const\\s+${exported}\\s*=\\s*withNativeDeadlines\\(\\s*"${exported}"\\s*,\\s*${alias}\\b`);
      if (!wrap.test(src)) bad.push(`${file}: ${alias} не обёрнут withNativeDeadlines("${exported}", ${alias}) — у вызовов нет срока (долг 302)`);
      const uses = [...src.matchAll(new RegExp(`\\b${alias}\\b`, "g"))].length;
      if (uses > 2) bad.push(`${file}: сырое ${alias} зовётся мимо обёртки (${uses - 2} раз) — у этих вызовов нет срока (долг 302)`);
    }
    for (const m of src.matchAll(/registerPlugin<[^>]*>\(\s*"(\w+)"/g)) note(`registerPlugin:${m[1]}`, file);
  }

  for (const key of seen.keys()) {
    if (!DEADLINED.has(key) && !OUTSIDE.has(key)) {
      bad.push(`${seen.get(key).join(", ")}: плагин ${key} не назван ни под правилом срока, ни вне его с причиной — перепись не знает, ждёт ли его кто-нибудь`);
    }
  }
  for (const mod of DEADLINED.keys()) {
    if (!seen.has(mod)) bad.push(`перепись пуста для ${mod}: ни одного импорта — сторож смотрит не туда (или плагин убран — тогда и правило)`);
  }

  const helper = strip(files[HELPER] ?? "");
  if (!/Promise\.race\(/.test(helper) || !/setTimeout\(/.test(helper)) bad.push(`${HELPER}: обёртка больше не ставит срок (нет Promise.race/setTimeout)`);
  if (!/captureMessage\(/.test(helper)) bad.push(`${HELPER}: просрочка больше не доходит до Sentry — узнать о ней снова неоткуда`);
  if (!/export function withNativeDeadlines/.test(helper)) bad.push(`${HELPER}: нет withNativeDeadlines`);

  return { bad, seen };
}

function readAll() {
  const out = {};
  for (const f of repoFiles(["src"])) {
    if (!/\.(tsx?|mjs)$/.test(f)) continue;
    try {
      out[f] = readFileSync(f, "utf8");
    } catch {
      /* удалён в рабочем дереве */
    }
  }
  return out;
}

const NOTIF = "src/lib/notifications.ts";
const MEDIA = "src/lib/native-media-session.ts";

function main() {
  const files = readAll();
  if (process.argv.includes("--plant")) {
    let ok = judge(files).bad.length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие исходники`);
    const edit = (file, from, to) => {
      const next = files[file]?.replace(from, to);
      return !next || next === files[file] ? null : { ...files, [file]: next };
    };
    const asOnMain = (file, name) => {
      const step1 = edit(file, `import { ${name} as ${name}Bridge }`, `import { ${name} }`);
      if (!step1) return null;
      const next = step1[file].replace(new RegExp(`const ${name} = withNativeDeadlines\\([\\s\\S]*?\\);\\n`), "");
      return next === step1[file] ? null : { ...step1, [file]: next };
    };
    const cases = [
      ["ПОЗИТИВНЫЙ КОНТРОЛЬ: уведомления в виде main a60af9d (прямой импорт, без обёртки)", asOnMain(NOTIF, "LocalNotifications"), "LocalNotifications из @capacitor/local-notifications импортирован напрямую"],
      ["ПОЗИТИВНЫЙ КОНТРОЛЬ: шторка в виде main a60af9d", asOnMain(MEDIA, "MediaSession"), "MediaSession из @capgo/capacitor-media-session импортирован напрямую"],
      ["обёртка снята, имя оставлено", edit(MEDIA, /withNativeDeadlines\("MediaSession", MediaSessionBridge\)/, "MediaSessionBridge"), "не обёрнут"],
      ["сырой вызов мимо обёртки", edit(NOTIF, "export async function cancelStreakReminder", "void LocalNotificationsBridge.cancel({ notifications: [] });\nexport async function cancelStreakReminder"), "мимо обёртки"],
      ["новый файл зовёт плагин напрямую", { ...files, "src/lib/__plant__.ts": 'import { MediaSession } from "@capgo/capacitor-media-session";\nvoid MediaSession.setMetadata({ title: "x" });' }, "__plant__.ts: MediaSession"],
      ["новый плагин не назван переписью", { ...files, "src/lib/__plant2__.ts": 'import { Geolocation } from "@capacitor/geolocation";\nvoid Geolocation.getCurrentPosition();' }, "@capacitor/geolocation не назван"],
      ["обёртка потеряла срок", edit(HELPER, "Promise.race(", "Promise.any("), "не ставит срок"],
      ["просрочка не идёт в Sentry", edit(HELPER, "Sentry.captureMessage(", "void ("), "не доходит до Sentry"],
      ["пустая перепись (импорты исчезли)", Object.fromEntries(Object.entries(files).filter(([f]) => f !== NOTIF && f !== MEDIA)), "перепись пуста"],
    ];
    let caught = 0;
    for (const [name, patched, expect] of cases) {
      if (!patched) {
        console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name}`);
        ok = false;
        continue;
      }
      const hit = judge(patched).bad.some((m) => m.includes(expect));
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    ok &&= caught === cases.length;
    console.log(ok ? `check:native-deadline --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:native-deadline --plant — FAILED");
    return ok ? 0 : 1;
  }
  const { bad, seen } = judge(files);
  if (bad.length) {
    console.error("check:native-deadline — ОТКАЗ:");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  const under = [...DEADLINED.keys()].map((k) => `${DEADLINED.get(k)} (${seen.get(k).length} файл)`).join(", ");
  console.log(`check:native-deadline — плагинов в переписи ${seen.size}: со сроком ${DEADLINED.size} — ${under}; вне правила с причиной ${seen.size - DEADLINED.size}. Контроль — --plant.`);
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
