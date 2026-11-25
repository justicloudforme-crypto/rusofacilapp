import { isLocale } from "@/i18n/config";
import { readLocal, writeLocal } from "./safe-storage";

/**
 * ВИЗИТЫ ВЛАДЕЛЬЦА НЕ СЧИТАЮТСЯ В СТАТИСТИКЕ — заход 7.310.
 *
 * Зачем. В Vercel Web Analytics ≈609 просмотров в месяц приходились на
 * админку, и ещё часть — на обычные страницы с устройств владельца. Это
 * не посетители: такие просмотры искажают и счёт, и долю `/ru` (долг 100).
 *
 * Правило два, и оба решаются ЗДЕСЬ, в одном месте:
 *
 *  1. Страницы админки (`/admin`, `/es/admin/…`, `/ru/admin/…`) не уходят
 *     в аналитику НИКОГДА и ни у кого — проверка по адресу события.
 *  2. Браузер с пометкой «не считать» не шлёт ничего ни с какой страницы.
 *     Пометка ставится сама при заходе в админку (`markOnAdminVisit`) и
 *     живёт в `localStorage` без срока: выход из админки и выход из учётки
 *     её не трогают (ключа нет в `PERSONAL_LOCAL_KEYS`,
 *     `src/lib/signed-out-local.ts`).
 *
 * Чего здесь нет намеренно: отсечения по IP (адрес меняется, и так нельзя
 * по приватности) и новой куки (юридический текст перечисляет куки; эта
 * пометка — запись в хранилище одного браузера, на сервер не уходит).
 *
 * Три значения ключа:
 *   "1" — не считать (поставлена при заходе в админку или кнопкой);
 *   "0" — считать: владелец снял пометку кнопкой САМ. Заход в админку такую
 *         пометку не перебивает, иначе проверить «считается» было бы нельзя;
 *   нет ключа — браузер обычного посетителя, считается.
 *
 * Пометка читается в момент КАЖДОГО события, а не один раз при загрузке:
 * кнопка в админке действует сразу, без перезагрузки.
 */
export const STATS_OPT_OUT_KEY = "rf-stats-opt-out";

export type StatsMark = "excluded" | "counted" | "unset";

export function readStatsMark(): StatsMark {
  const value = readLocal(STATS_OPT_OUT_KEY);
  if (value === "1") return "excluded";
  if (value === "0") return "counted";
  return "unset";
}

/** Кнопка в админке. `true`, если запись состоялась (хранилище может
 *  отказать — приватное окно, запрет данных сайта). */
export function setStatsExcluded(excluded: boolean): boolean {
  const ok = writeLocal(STATS_OPT_OUT_KEY, excluded ? "1" : "0");
  notify();
  return ok;
}

/** Заход в админку: ставит пометку, если её нет. Снятую вручную («0») не
 *  трогает. Возвращает состояние после вызова. */
export function markOnAdminVisit(): StatsMark {
  const mark = readStatsMark();
  if (mark !== "unset") return mark;
  setStatsExcluded(true);
  return readStatsMark();
}

/** Адрес (полный или путь) — страница админки? `/admin` без языка тоже:
 *  по правилу 265 он переадресуется, но событие могло уйти раньше. */
export function isAdminPath(urlOrPath: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(urlOrPath, "https://rusofacilapp.com").pathname;
  } catch {
    return false;
  }
  const [first, second] = pathname.split("/").filter(Boolean);
  if (first === "admin") return true;
  return first !== undefined && isLocale(first) && second === "admin";
}

/** Главный вопрос: отправлять ли событие с этим адресом. */
export function shouldSkipStats(urlOrPath: string): boolean {
  return isAdminPath(urlOrPath) || readStatsMark() === "excluded";
}

// Подписка для строки в админке (useSyncExternalStore): кнопка в этой же
// вкладке и запись из другой вкладки (событие `storage`).
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeStatsMark(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STATS_OPT_OUT_KEY) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
