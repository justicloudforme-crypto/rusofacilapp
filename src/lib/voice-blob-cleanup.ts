import { rm } from "node:fs/promises";
import path from "node:path";

/**
 * Уборка ОБЪЕКТОВ записи голоса — та же для обоих путей удаления.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫМ ФАЙЛОМ, А НЕ В `voice-storage.ts`. Долг 167: путей
 * удаления учётной записи два, и до 13.09.2026 второй из них
 * (`prisma/delete-test-accounts.ts`) про объекты не знал ВОВСЕ —
 * вхождений `voice` и `blob` в нём было 0. Он не мог о них знать даже
 * при желании: `voice-storage.ts` открывается строкой `import
 * "server-only"`, и попытка позвать его из обычного скрипта падает на
 * сборке. Поэтому уборка живёт здесь, без `server-only`, а
 * `voice-storage.ts` её просто перевыставляет — один код на оба пути, и
 * заново разойтись им теперь негде.
 *
 * Цена молчания измерена, а не предположена: три объекта долга 24
 * пережили своих владельцев, и каким из двух путей они ушли, различить
 * сегодня нечем — оба объясняют результат одинаково.
 */

/** Общий префикс всех записей голоса в хранилище. Одно место на проект. */
export const VOICE_SUBMISSION_PREFIX = "submissions/";

const LOCAL_DIR = path.join(process.cwd(), "public", "audio", "submissions");

/**
 * Кому принадлежит объект по его пути в хранилище, или `null`, если путь
 * не той формы. Вынесено отдельно и экспортируется, потому что на этом
 * держится сторож сирот: «объектов под `submissions/`, чей владелец не
 * находится в `User`, — ноль».
 */
export function userIdFromSubmissionPath(pathname: string): string | null {
  if (!pathname.startsWith(VOICE_SUBMISSION_PREFIX)) return null;
  const rest = pathname.slice(VOICE_SUBMISSION_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  return rest.slice(0, slash);
}

/** Кто из владельцев названных объектов не находится среди живых. Чистая
 *  функция — ровно затем, чтобы правило сторожа проверялось контролем, а
 *  не прогоном по боевому хранилищу. */
export function orphansAmong(
  pathnames: Iterable<string>,
  liveUserIds: Iterable<string>,
): { pathname: string; userId: string }[] {
  const live = new Set(liveUserIds);
  const orphans: { pathname: string; userId: string }[] = [];
  for (const pathname of pathnames) {
    const userId = userIdFromSubmissionPath(pathname);
    if (userId === null) continue;
    if (!live.has(userId)) orphans.push({ pathname, userId });
  }
  return orphans;
}

/**
 * Удаляет все записи голоса одного человека — и в облаке, и на диске.
 *
 * БРОСАЕТ при отказе НАРОЧНО, и это вторая половина долга 167. Раньше
 * отказ глотался `catch (() => {})` прямо на месте вызова, поэтому
 * объект оставался, а id, по которому его можно было бы найти, исчезал
 * из базы следующей же командой. Теперь решение «что делать с отказом»
 * принимает ВЫЗЫВАЮЩИЙ, и у двух путей оно РАЗНОЕ и намеренно
 * несимметричное: человек, удаляющий свою учётную запись, не должен
 * застревать из-за файла (там — отчёт в Sentry и продолжаем), а скрипт
 * владельца, наоборот, обязан остановиться, потому что его никто не ждёт
 * (там — отказ и строка не удаляется).
 */
export async function deleteAllVoiceSubmissionsForUser(userId: string): Promise<number> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { list, del } = await import("@vercel/blob");
    const prefix = `${VOICE_SUBMISSION_PREFIX}${userId}/`;
    let removed = 0;
    let cursor: string | undefined;
    // Постранично: `list` отдаёт не больше 1000 за раз, и человек с
    // тысяча первой записью иначе унёс бы её с собой в сироты.
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      if (page.blobs.length > 0) {
        await del(page.blobs.map((blob) => blob.url));
        removed += page.blobs.length;
      }
      cursor = page.cursor;
    } while (cursor);
    return removed;
  }
  await rm(path.join(LOCAL_DIR, userId), { recursive: true, force: true });
  return 0;
}
