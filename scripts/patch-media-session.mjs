/**
 * ЗАПЛАТКА ПЛАГИНА ШТОРКИ `@capgo/capacitor-media-session` — ЗАХОД 7.248
 * (Ж.2 аудита 7.241 и долг 342).
 *
 * Плагин собирается прямо из `node_modules` (`android/capacitor.settings.gradle`),
 * поэтому правка живёт здесь и накладывается после каждой установки
 * (`postinstall`). Новой зависимости (patch-package) ради двух мест не
 * заводится; новых разрешений, типов фоновой службы и SDK правка не
 * добавляет — меняется только поведение уже принятой службы Media playback.
 *
 * ЧТО ЧИНИТСЯ, ЗАМЕР НА ЭМУЛЯТОРЕ 28.09.2026 (1.0.12, `dumpsys media_session`):
 *
 *   1. Уход со страницы рассказа («none») только отвязывал службу, а
 *      `MediaSessionCompat` не освобождался никогда: после трёх рассказов
 *      и копии без сети — 8 сессий приложения, все `active=true`, три из
 *      них `PLAYING`, уведомлений 0. HyperOS рисует карточку по активным
 *      сессиям — отсюда «играет», когда ничего не играет. Теперь
 *      `destroy()` делает `setActive(false)` и `release()`.
 *   2. Текст уведомления склеивался как `artist + " - " + album`, а
 *      `album` мы не передаём — висящий « - » в каждой карточке
 *      («Cuento popular ruso - », долг 342). Теперь разделитель — только
 *      при непустом `album`.
 *
 * Правка ИДЕМПОТЕНТНА: на уже исправленном файле ничего не меняет. Если
 * плагин обновился и якорей нет — установка НЕ падает (сломать `npm ci`
 * на Vercel ради шторки нельзя), а громко печатает предупреждение; красным
 * станет сторож `check:media-session-patch` в verify и CI.
 *
 *   node scripts/patch-media-session.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SERVICE =
  "node_modules/@capgo/capacitor-media-session/android/src/main/java/com/capgo/mediasession/MediaSessionService.java";

export const PATCHES = [
  {
    name: "служба освобождает сессию (Ж.2б)",
    from: [
      "    public void destroy() {",
      "        stopForeground(true);",
      "        stopSelf();",
      "    }",
    ].join("\n"),
    to: [
      "    public void destroy() {",
      "        // RusoFácil 7.248: сессия освобождается, иначе после ухода она остаётся active=true",
      "        if (mediaSession != null) {",
      "            mediaSession.setActive(false);",
      "            mediaSession.release();",
      "            mediaSession = null;",
      "        }",
      "        playbackStateBuilder = null;",
      "        mediaMetadataBuilder = null;",
      "        notificationBuilder = null;",
      "        notificationStyle = null;",
      "        stopForeground(true);",
      "        stopSelf();",
      "    }",
    ].join("\n"),
  },
  {
    name: "без висящего « - » (долг 342)",
    from: 'notificationBuilder.setContentTitle(title).setContentText(artist + " - " + album).setLargeIcon(artwork);',
    to: 'notificationBuilder.setContentTitle(title).setContentText(album.isEmpty() ? artist : artist + " - " + album).setLargeIcon(artwork);',
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
  if (!existsSync(SERVICE)) {
    console.warn(`patch-media-session: ${SERVICE} не найден — плагин не установлен, накладывать нечего`);
    return 0;
  }
  const source = readFileSync(SERVICE, "utf8");
  const { text, report } = applyPatches(source);
  if (text !== source) writeFileSync(SERVICE, text);
  for (const r of report) console.log(`patch-media-session: ${r.name} — ${r.state}`);
  if (report.some((r) => r.state === "ЯКОРЯ НЕТ")) {
    console.warn("patch-media-session: ПЛАГИН ИЗМЕНИЛСЯ — заплатка не легла; сторож check:media-session-patch покраснеет");
  }
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
