#!/usr/bin/env node
// ЗВУК НАПОМИНАНИЯ В ШТОРКЕ — ПРОБА НА ЭМУЛЯТОРЕ (долг 303, заход 7.299).
//
// Что доказывает один круг (на установленном приложении, оболочка не
// пересобирается):
//   1. Часы эмулятора ставятся на 18:58 сегодняшнего дня, приложение
//      стартует заново. Сайт внутри оболочки (`NativeNotifications`) сам
//      снимает вчерашнее уведомление и ставит напоминание на 19:00 —
//      проверяется по `dumpsys alarm` (будильник приложения на 19:00 этого
//      дня) и по пустой шторке приложения.
//   2. Канал, куда плагин кладёт напоминание: `default`, важность ≥ 3
//      (со звуком), `mSound` не пустой — по `dumpsys notification`.
//   3. Часы — на 20:02 (окно неточного будильника — час): напоминание
//      показано в шторке, у записи `channel=default`, `mSound` тот же, что у
//      канала, `isNoisy=true`.
//   4. Звук РЕАЛЬНО проигран: системный `RingtonePlayer` пишет в logcat
//      `play uri=<звук канала>` и `player.start` в те же секунды.
//
//   node scripts/emulator/reminder-sound.mjs [--repeat N]
//   node scripts/emulator/reminder-sound.mjs --control dnd       # «Не беспокоить»: проба обязана увидеть тишину
//   node scripts/emulator/reminder-sound.mjs --unswiped          # день 2 без снятия вчерашнего (долг 416)
//
// Перед прогоном: эмулятор поднят (`rf-emulator.sh up`), приложение
// стоит. Скрипт выдаёт разрешение на уведомления сам (`pm grant`) и в
// конце возвращает часы эмулятора к настоящему времени и выключает
// «Не беспокоить», если включал. Нужна сеть: оболочка грузит боевой сайт.
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const sdk = process.env.ANDROID_HOME || join(homedir(), "Library/Android/sdk");
const adb = join(sdk, "platform-tools/adb");
const PKG = "com.rusofacilapp.app";
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const REPEAT = Number(opt("--repeat", "1"));
const CONTROL = opt("--control", null);
const UNSWIPED = flag("--unswiped");
// «ПРИГЛУШЕНИЕ ПОВТОРОВ» ANDROID НА ВРЕМЯ ПРОГОНА ВЫКЛЮЧЕНО (замер 7.299).
// Android 16 глушит звонок приложения, если по часам стены он не позже
// прошлого прозвучавшего (Settings → Notifications → «Notification
// cooldown»). Проба переводит часы назад, на 18:58, в каждом круге — и без
// выключения второй круг немой: в один день 0 из 3, по дню на круг вперёд
// звук есть, назад — нет. У настоящего напоминания между звонками сутки
// вперёд, его это не касается. Кругов «по дню вперёд» больше ≈50 не
// сделать: дальше срока сертификата боевого сайта (16.01.2027) оболочка
// сайт не откроет. Поэтому — выключить на прогон и вернуть как было.
const COOLDOWN_KEY = "notification_cooldown_enabled";

const sh = (...a) => execFileSync(adb, ["shell", ...a], { encoding: "utf8", maxBuffer: 64 << 20 });
const adbRun = (...a) => execFileSync(adb, a, { encoding: "utf8", maxBuffer: 64 << 20 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(what, fn, timeoutMs) {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`не дождались: ${what} (${timeoutMs / 1000} с)`);
    await sleep(500);
  }
}

/** Секунды эпохи и сдвиг пояса — у самого эмулятора. */
function deviceClock() {
  const [epoch, h, m, s] = sh("date '+%s %H %M %S'").trim().split(/\s+/).map(Number);
  return { epoch, midnight: epoch - (h * 3600 + m * 60 + s) };
}

function setTime(epochSec) {
  sh("cmd", "alarm", "set-time", String(epochSec * 1000));
}

/** Будильники приложения: момент срабатывания (мс эпохи). */
function appAlarms() {
  const out = sh("dumpsys", "alarm");
  const res = [];
  for (const m of out.matchAll(/Alarm\{\w+ type \d+ origWhen (\d+) whenElapsed \d+ com\.rusofacilapp\.app\}/g)) res.push(Number(m[1]));
  return res;
}

function notificationDump() {
  return sh("dumpsys", "notification", "--noredact");
}

/** Канал `default` текущего uid приложения. */
function defaultChannel(dump, uid) {
  const block = dump.split(`AppSettings: ${PKG} (${uid})`)[1];
  if (!block) return null;
  const head = block.split("AppSettings:")[0];
  const m = head.match(/NotificationChannel\{mId='default'[^\n]*/);
  if (!m) return null;
  const line = m[0];
  return {
    importance: Number((line.match(/mImportance=(\d+)/) || [])[1]),
    sound: (line.match(/mSound=([^,]+)/) || [])[1],
    usage: (line.match(/usage=(\w+)/) || [])[1],
  };
}

/** Запись уведомления приложения в шторке, если есть. */
function appRecord(dump) {
  const i = dump.indexOf(`NotificationRecord(`);
  if (i < 0) return null;
  for (const part of dump.split(/\n(?=\s*NotificationRecord\()/)) {
    if (!part.includes(`pkg=${PKG} `)) continue;
    return {
      channel: (part.match(/Notification\(channel=(\S+)/) || [])[1],
      sound: ((part.match(/\n\s*mSound=\s*(\S+)/) || [])[1] ?? "").trim(),
      noisy: /isNoisy=true/.test(part),
      interruptive: /mIsInterruptive=true/.test(part),
      when: Number((part.match(/when=(\d+)\//) || [])[1]),
    };
  }
  return null;
}

function uidOf() {
  return (sh("dumpsys", "package", PKG).match(/appId=(\d+)/) || [])[1];
}

function launch() {
  sh("am", "force-stop", PKG);
  sh("monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");
}

/** Строки `RingtonePlayer` после очистки журнала. */
function ringtoneLines() {
  return adbRun("logcat", "-d", "-s", "RingtonePlayer:D").split("\n").filter((l) => /play uri=|player\.start/.test(l));
}

async function oneRound(n, { expectSound }) {
  const uid = uidOf();
  const midnight = baseMidnight;
  const at1858 = midnight + 18 * 3600 + 58 * 60;
  const at1900 = (midnight + 19 * 3600) * 1000;
  setTime(at1858);
  launch();
  // Напоминание этого дня: 19:00:xx (секунды плагин берёт от прежнего срабатывания).
  await until("будильник напоминания на 19:00 сегодня", () => appAlarms().some((w) => w >= at1900 && w < at1900 + 60_000), 45_000);
  await until("шторка приложения пуста после запуска (вчерашнее снято)", () => !appRecord(notificationDump()), 20_000);
  sh("input", "keyevent", "KEYCODE_HOME");
  // Приложение должно уйти в фон ДО прыжка часов: иначе переход «домой»
  // доигрывает уже после него, страница монтируется заново и сама снимает
  // только что пришедшее напоминание (замер 7.299, `removeAllDeliveredNotifications`
  // через 1 с после звонка) — для «вчерашнее не снято» это ложная картина.
  await until("приложение в фоне", () => !/topResumedActivity=[^\n]*com\.rusofacilapp\.app/.test(sh("dumpsys", "activity", "activities")), 10_000);
  await sleep(3000);

  const ch = defaultChannel(notificationDump(), uid);
  if (!ch) throw new Error("канала `default` у приложения нет");
  if (!(ch.importance >= 3)) throw new Error(`канал без звука: важность ${ch.importance}`);
  if (!ch.sound || ch.sound === "null") throw new Error(`у канала не назначен звук: ${ch.sound}`);

  adbRun("logcat", "-c");
  setTime(at1858 + 64 * 60); // 20:02
  const rec = await until("напоминание в шторке", () => appRecord(notificationDump()), 20_000);
  if (rec.channel !== "default") throw new Error(`напоминание не в канале default: ${rec.channel}`);
  if (rec.sound !== ch.sound) throw new Error(`звук записи ${rec.sound} ≠ звук канала ${ch.sound}`);

  let played = [];
  try {
    played = await until("RingtonePlayer проиграл звук канала", () => {
      const lines = ringtoneLines();
      return lines.some((l) => l.includes(`play uri=${ch.sound}`)) && lines.some((l) => l.includes("player.start")) ? lines : null;
    }, 8_000);
  } catch {
    played = [];
  }
  const sounded = played.length > 0;
  const ok = expectSound ? sounded && rec.noisy : !sounded;
  console.log(
    `круг ${n}: канал default важность ${ch.importance}, звук ${ch.sound}; запись noisy=${rec.noisy} interruptive=${rec.interruptive}; ` +
      `проигран: ${sounded ? "да" : "НЕТ"} → ${ok ? "ЗЕЛЁНЫЙ" : "КРАСНЫЙ"}`,
  );
  return ok;
}

/** День 2 без снятия вчерашнего уведомления: обновление приходит тихо (замер 7.299). */
async function unswipedRound() {
  await oneRound("день 1", { expectSound: true });
  const alarm = Math.max(...appAlarms());
  adbRun("logcat", "-c");
  setTime(Math.floor(alarm / 1000) + 62 * 60);
  await sleep(8000);
  const rec = appRecord(notificationDump());
  const sounded = ringtoneLines().some((l) => l.includes("play uri="));
  console.log(`день 2 (вчерашнее не снято): запись ${rec ? "обновлена, when=" + new Date(rec.when).toISOString() : "нет"}; звук: ${sounded ? "да" : "НЕТ"}`);
}

const realNow = Math.floor(Date.now() / 1000);
const baseMidnight = deviceClock().midnight;
let green = 0;
let red = 0;
const cooldownBefore = sh("settings", "get", "system", COOLDOWN_KEY).trim();
try {
  sh("settings", "put", "system", COOLDOWN_KEY, "0");
  sh("pm", "grant", PKG, "android.permission.POST_NOTIFICATIONS");
  if (CONTROL === "dnd") sh("cmd", "notification", "set_dnd", "on");
  if (UNSWIPED) {
    await unswipedRound();
  } else {
    for (let i = 1; i <= REPEAT; i++) {
      try {
        if (await oneRound(i, { expectSound: CONTROL !== "dnd" })) green++;
        else red++;
      } catch (e) {
        red++;
        console.log(`круг ${i}: КРАСНЫЙ — ${e.message}`);
      }
    }
    console.log(`итог: зелёных ${green} из ${REPEAT}${CONTROL ? ` (контроль ${CONTROL}: «зелёный» = тишина увидена)` : ""}`);
  }
} finally {
  if (CONTROL === "dnd") sh("cmd", "notification", "set_dnd", "off");
  setTime(realNow + Math.round(process.uptime()));
  if (cooldownBefore === "null") sh("settings", "delete", "system", COOLDOWN_KEY);
  else sh("settings", "put", "system", COOLDOWN_KEY, cooldownBefore);
}
process.exit(red === 0 ? 0 : 1);
