/**
 * ЗАПЛАТКА ПЛАГИНА НАПОМИНАНИЙ `@capacitor/local-notifications` — ЗАХОД 7.288
 * (долг 408).
 *
 * Плагин собирается прямо из `node_modules` (`android/capacitor.settings.gradle`),
 * поэтому правка живёт здесь и накладывается после каждой установки
 * (`postinstall`), как `scripts/patch-media-session.mjs`. Новой зависимости
 * не заводится; новых разрешений (ни SCHEDULE_EXACT_ALARM, ни
 * USE_EXACT_ALARM), типов фоновой службы и SDK правка не добавляет.
 *
 * ЧТО ЧИНИТСЯ, ЗАМЕР НА ЭМУЛЯТОРЕ 17.11.2026 (7.287, 1.0.16):
 *
 *   Сайт ставит ежедневное напоминание `schedule.on {hour, minute}` с
 *   `allowWhileIdle: true` (`src/lib/notifications.ts`). Первый раз плагин
 *   ставит будильник правильно — `setAndAllowWhileIdle(RTC_WAKEUP, …)`
 *   (`LocalNotificationManager.kt`, setExactIfPossible). Но после
 *   срабатывания следующий день он ставит сам, в
 *   `TimedNotificationPublisher.kt`, и там `allowWhileIdle` не читается
 *   вовсе: `alarmManager.set(AlarmManager.RTC, …)` — будильник без права
 *   будить телефон. В глубоком сне день 2 пришёл в 20:03 вместо окна
 *   19:00–20:00 (пришёл, когда телефон проснулся по другому поводу).
 *
 *   Теперь перестановка повторяет ту же развилку, что первая постановка:
 *   при `allowWhileIdle` — `RTC_WAKEUP` с `…AndAllowWhileIdle`. Точного
 *   будильника у нас нет (разрешения нет и не будет — декларации Play), так
 *   что на деле работает ветка `setAndAllowWhileIdle(RTC_WAKEUP)`: Android
 *   12+ держит у неточного разового будильника окно не больше часа после
 *   заданного времени — это и есть окно 19:00–20:00.
 *
 * Правка ИДЕМПОТЕНТНА: на уже исправленном файле ничего не меняет. Если
 * плагин обновился и якоря нет — установка НЕ падает (сломать `npm ci` на
 * Vercel ради напоминания нельзя), а громко печатает предупреждение;
 * красным станет сторож `check:local-notifications-patch` в verify и CI.
 *
 *   node scripts/patch-local-notifications.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PUBLISHER =
  "node_modules/@capacitor/local-notifications/android/src/main/kotlin/com/capacitorjs/plugins/localnotifications/TimedNotificationPublisher.kt";

export const PATCHES = [
  {
    name: "следующий день будит телефон (долг 408)",
    from: [
      "        if (wantsExact && canExact) {",
      "            alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent)",
      "        } else {",
      "            if (wantsExact) {",
      '                Logger.warn("Capacitor/LocalNotification", "Exact alarms not allowed in user settings.  Notification scheduled with non-exact alarm.")',
      "            }",
      "            alarmManager.set(AlarmManager.RTC, trigger, pendingIntent)",
      "        }",
    ].join("\n"),
    to: [
      "        // RusoFácil 7.288 (долг 408): та же развилка, что при первой постановке",
      "        // (LocalNotificationManager.setExactIfPossible) — иначе со второго дня RTC без пробуждения",
      '        val allowWhileIdle = storedNotification?.getJSObject("schedule")?.getBoolean("allowWhileIdle", false) == true',
      "        if (wantsExact && canExact) {",
      "            if (allowWhileIdle) {",
      "                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent)",
      "            } else {",
      "                alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent)",
      "            }",
      "        } else {",
      "            if (wantsExact) {",
      '                Logger.warn("Capacitor/LocalNotification", "Exact alarms not allowed in user settings.  Notification scheduled with non-exact alarm.")',
      "            }",
      "            if (allowWhileIdle) {",
      "                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent)",
      "            } else {",
      "                alarmManager.set(AlarmManager.RTC, trigger, pendingIntent)",
      "            }",
      "        }",
    ].join("\n"),
  },
];

/** Применить заплатки к тексту. Возвращает новый текст и что с каждой. */
export function applyPatches(source) {
  let text = source;
  const report = [];
  for (const patch of PATCHES) {
    if (text.includes(patch.to)) report.push({ name: patch.name, state: "уже стоит" });
    else if (text.includes(patch.from)) {
      text = text.replace(patch.from, patch.to);
      report.push({ name: patch.name, state: "наложена" });
    } else report.push({ name: patch.name, state: "ЯКОРЯ НЕТ" });
  }
  return { text, report };
}

export function main() {
  if (!existsSync(PUBLISHER)) {
    console.warn(`patch-local-notifications: ${PUBLISHER} не найден — плагин не установлен, накладывать нечего`);
    return 0;
  }
  const source = readFileSync(PUBLISHER, "utf8");
  const { text, report } = applyPatches(source);
  if (text !== source) writeFileSync(PUBLISHER, text);
  for (const r of report) console.log(`patch-local-notifications: ${r.name} — ${r.state}`);
  if (report.some((r) => r.state === "ЯКОРЯ НЕТ")) {
    console.warn(
      "patch-local-notifications: ПЛАГИН ИЗМЕНИЛСЯ — заплатка не легла; сторож check:local-notifications-patch покраснеет",
    );
  }
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
