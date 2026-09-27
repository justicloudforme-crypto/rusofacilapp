import { readSession, sessionStorageOrNull } from "./safe-storage";

/**
 * ВКЛАДКА И ПРОКРУТКА СКАЧАННОЙ КОПИИ ПЕРЕЖИВАЮТ ВОЗВРАТ СЕТИ — ЗАХОД 7.239.
 *
 * Видео владельца, оболочка 1.0.10: в скачанном уроке без сети открыта
 * «Ejercicios»; сеть вернулась, каркас перезагрузил страницу — и живой
 * урок открылся сверху на «Gramática» (`LessonView` всегда начинает с
 * грамматики). Живая страница о копии не знала ничего.
 *
 * Теперь каркас (`public/offline.html`, `rememberCopyView`) перед любой
 * перезагрузкой ради сети оставляет в хранилище ВКЛАДКИ записку: адрес,
 * открытая вкладка, прокрутка, время. Здесь она читается ровно один раз и
 * стирается. Ключ и форма записки — общие с каркасом; их совпадение
 * держит `npm run check:offline-reader` (правило 20).
 */
export const COPY_VIEW_KEY = "rf-copy-view";

/** Записка старше этого — не про этот возврат сети, а забытая. */
export const COPY_VIEW_MAX_AGE_MS = 10 * 60_000;

export interface CopyView {
  tab: string | null;
  y: number;
}

/** Разбор записки без побочных эффектов — для примеров. */
export function parseCopyView(raw: string | null, pathname: string, now: number): CopyView | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.path !== pathname) return null;
  if (typeof v.at !== "number" || !Number.isFinite(v.at)) return null;
  const age = now - v.at;
  if (age < 0 || age > COPY_VIEW_MAX_AGE_MS) return null;
  const tab = typeof v.tab === "string" && v.tab ? v.tab : null;
  const y = typeof v.y === "number" && Number.isFinite(v.y) && v.y > 0 ? Math.round(v.y) : 0;
  return { tab, y };
}

/** Прочитать записку для этого адреса и стереть её — один раз. */
export function takeCopyView(pathname: string, now: number = Date.now()): CopyView | null {
  const raw = readSession(COPY_VIEW_KEY);
  if (raw === null) return null;
  try {
    sessionStorageOrNull()?.removeItem(COPY_VIEW_KEY);
  } catch {
    // Не стёрлась — прочитается ещё раз в пределах срока; вреда нет.
  }
  return parseCopyView(raw, pathname, now);
}
