/**
 * БЕЙДЖ НА ИКОНКЕ СНИМАЕТСЯ И ПРИ ОТКРЫТИИ С ИКОНКИ — ДОЛГ 203 (7.216).
 *
 * ЗАЧЕМ СТОРОЖ, А НЕ ПРОСТО ПРАВКА. Долг 203 был найден ЧИСЛОМ «вызовов
 * `LocalNotifications.removeAllDeliveredNotifications()` во всём `src/`
 * ровно 0», то есть отсутствием строки. Отсутствие строки возвращается
 * молча: её можно убрать при любой перестройке точки монтирования, и ни
 * сборка, ни тесты об этом не скажут — проверить руками можно только на
 * живом телефоне с настоящим уведомлением, а это заход с устройством
 * (класс долгов 112, 170, 176). Поэтому форма правила заперта здесь.
 *
 * ПРАВИЛО, ЧЕТЫРЬМЯ УТВЕРЖДЕНИЯМИ:
 *
 *   а) `src/lib/notifications.ts` имеет вызов
 *      `LocalNotifications.removeAllDeliveredNotifications()` и отдаёт его
 *      наружу отдельной функцией;
 *   б) вызов обёрнут в `nativeOnly` — на вебе плагина нет вовсе, и голый
 *      вызов уронил бы каждую страницу обеих локалей;
 *   в) точка монтирования `NativeNotifications.tsx` зовёт эту функцию
 *      СРАЗУ (первый запуск: события `resume` на нём не бывает);
 *   г) и подписана на `resume` приложения (`@capacitor/app`) — второе и
 *      каждое следующее возвращение на передний план.
 *
 * ЧЕГО ЭТОТ СТОРОЖ НЕ ОБЕЩАЕТ, названо прямо: он читает ФОРМУ исходника,
 * а не поведение телефона. Что значок действительно гаснет, может
 * сказать только живое устройство — и это ровно то, чем закрываются
 * долги 112/170/176, а не этот.
 *
 *   node scripts/check-notification-badge.mjs          # гейт
 *   node scripts/check-notification-badge.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const LIB = "src/lib/notifications.ts";
const MOUNT = "src/components/NativeNotifications.tsx";

/** Комментарии вычёркиваются: в обоих файлах правило объяснено словами,
 *  и слова эти содержат имя вызова. Сторож, читающий объяснение, доволен
 *  комментарием — ровно та дыра, которую `check:welcome-once` закрыл
 *  первым. */
export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

export function violations(libRaw, mountRaw) {
  const lib = stripComments(libRaw);
  const mount = stripComments(mountRaw);
  const bad = [];

  const call = /nativeOnly\(\(\)\s*=>\s*LocalNotifications\.removeAllDeliveredNotifications\(\)\)/;
  if (!/LocalNotifications\.removeAllDeliveredNotifications\(\)/.test(lib)) {
    bad.push(`${LIB}: вызова removeAllDeliveredNotifications() нет — бейдж снимает только нажатие на уведомление (долг 203)`);
  } else if (!call.test(lib)) {
    bad.push(`${LIB}: вызов не обёрнут в nativeOnly — на вебе плагина нет, и страница упадёт`);
  }
  if (!/export async function clearDeliveredNotifications\(\)/.test(lib)) {
    bad.push(`${LIB}: снятие бейджа не выставлено наружу отдельной функцией — точке монтирования нечего звать`);
  }

  if (!/from "@capacitor\/app"/.test(mount) || !/\bApp\.addListener\(\s*"resume"/.test(mount)) {
    bad.push(`${MOUNT}: на возобновление приложения не подписан никто — открытие С ИКОНКИ бейдж не снимет (долг 203)`);
  }
  if (!/clearDeliveredNotifications/.test(mount)) {
    bad.push(`${MOUNT}: снятие бейджа не зовётся вовсе`);
  } else {
    // «Сразу» — это вызов, стоящий ВНЕ обработчика resume. Первый запуск
    // события resume не даёт, и без прямого вызова бейдж переживёт его.
    const withoutHandler = mount.replace(/App\.addListener\([\s\S]*?\);/g, " ");
    if (!/void clearDeliveredNotifications\(\)/.test(withoutHandler)) {
      bad.push(`${MOUNT}: снятие бейджа зовётся только из обработчика resume — на ПЕРВОМ запуске resume не приходит`);
    }
  }
  return bad;
}

function plant() {
  const lib = readFileSync(LIB, "utf8");
  const mount = readFileSync(MOUNT, "utf8");
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(lib, mount).length === 0 }];
  const add = (name, l, m, expect) => {
    if (l === lib && m === mount) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(l, m).some((f) => f.includes(expect)) });
  };

  add(
    "подсадка: убрать вызов removeAllDeliveredNotifications — поймано",
    lib.replace("nativeOnly(() => LocalNotifications.removeAllDeliveredNotifications())", "nativeOnly(() => Promise.resolve())"),
    mount,
    "вызова removeAllDeliveredNotifications() нет",
  );
  add(
    "подсадка: снять обёртку nativeOnly — поймано",
    lib.replace(
      "await nativeOnly(() => LocalNotifications.removeAllDeliveredNotifications());",
      "await LocalNotifications.removeAllDeliveredNotifications();",
    ),
    mount,
    "не обёрнут в nativeOnly",
  );
  add(
    "подсадка: перестать выставлять функцию наружу — поймано",
    lib.replace("export async function clearDeliveredNotifications()", "async function clearDeliveredNotifications()"),
    mount,
    "не выставлено наружу",
  );
  add(
    "подсадка: снять подписку на resume — поймано",
    lib,
    mount.replace(/App\.addListener\(\s*"resume"/, 'App.addListener("pause"'),
    "не подписан никто",
  );
  add(
    "подсадка: не звать снятие вовсе — поймано",
    lib,
    mount.replace(/clearDeliveredNotifications/g, "scheduleStreakReminder"),
    "не зовётся вовсе",
  );
  add(
    "подсадка: оставить только обработчик resume (первый запуск не покрыт) — поймано",
    lib,
    mount.replace("    void clearDeliveredNotifications();\n    const handle", "    const handle"),
    "на ПЕРВОМ запуске resume не приходит",
  );

  for (const c of cases) console.log(`  ${c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО"} — ${c.name}`);
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:notification-badge --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:notification-badge --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const bad = violations(readFileSync(LIB, "utf8"), readFileSync(MOUNT, "utf8"));
  if (bad.length) {
    console.error(`check:notification-badge — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:notification-badge — 4 правила, нарушений 0 (долг 203)");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
