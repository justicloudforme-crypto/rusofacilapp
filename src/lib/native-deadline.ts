/**
 * СРОК НА КАЖДЫЙ ВЫЗОВ МОСТА ВНЕ ЭКРАНА ПОКУПКИ — ДОЛГ 302 (заход 7.292).
 *
 * Строка долга (суть): мост Capacitor (`native-bridge.js`, его оболочка
 * кладёт в каждый документ) в `cap.toNative` пишет `console.warn` и
 * возвращает `null`, если `postToNative` не создался или `postMessage`
 * бросил, — а промис `cap.nativePromise` к этому моменту уже создан и не
 * завершится НИКОГДА. Отказ не доходит ни до `catch`, ни до Sentry: обложка
 * в шторке и напоминание о серии молча не применяются.
 *
 * Экран покупки это уже знает (`within` в `revenuecat-client.ts`). Здесь —
 * то же правило для двух плагинов, которые зовутся без человека:
 * `LocalNotifications` (`src/lib/notifications.ts`) и `MediaSession`
 * (`src/lib/native-media-session.ts`). Обёртка ставится НА ПЛАГИН при
 * импорте, а не на каждое место вызова: так её получают все вызовы сразу,
 * и новый вызов не может её забыть (это стережёт `check:native-deadline`).
 *
 * ЧТО ДЕЛАЕТ ОБЁРТКА:
 *   • каждый метод плагина ждётся не дольше срока; срок вышел — промис
 *     отклоняется `NativeDeadline` с именем шага (`MediaSession.setMetadata`),
 *     и одна запись на шаг за загрузку страницы уходит в Sentry;
 *   • метод, вернувший НЕ промис, отдаётся промисом. Так ведут себя методы
 *     с обратным вызовом (`RETURN_CALLBACK`): на Android
 *     `MediaSession.setActionHandler` идёт через `cap.nativeCallback` и
 *     возвращает номер обратного вызова — строку. До 7.292 `nativeOnly`
 *     звал у этой строки `.catch` и бросал `TypeError` на каждой установке
 *     кнопок шторки (обработчик при этом успевал встать).
 *
 * Отменить сам вызов нечем — мост такой возможности не даёт, — проигравший
 * промис остаётся висеть. Это та же осознанная цена, что у `within`.
 */
import * as Sentry from "@sentry/nextjs";

/** Обычный вызов моста отвечает за миллисекунды; 10 с — с большим запасом
 *  на медленный телефон и холодный старт оболочки. */
export const NATIVE_DEADLINE_MS = 10_000;

/** Срок шага, где отвечает ЧЕЛОВЕК (системное окно разрешения): ему нужно
 *  время прочитать и нажать. Это тоже срок — не «без срока». */
export const NATIVE_HUMAN_DEADLINE_MS = 120_000;

export class NativeDeadline extends Error {
  constructor(readonly step: string, readonly ms: number) {
    super(`native step "${step}" did not answer in ${ms} ms`);
    this.name = "NativeDeadline";
  }
}

export type DeadlineReport = (step: string, ms: number) => void;

const reported = new Set<string>();

const sentryReport: DeadlineReport = (step, ms) => {
  if (reported.has(step)) return;
  reported.add(step);
  Sentry.captureMessage("native_bridge_deadline", {
    level: "warning",
    tags: { native_step: step },
    extra: { deadline_ms: ms },
  });
};

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function";
}

/** Ждать вызов моста не дольше `ms`; срок вышел — `NativeDeadline(step)`. */
export async function withinNative<T>(work: T | PromiseLike<T>, step: string, ms = NATIVE_DEADLINE_MS, report: DeadlineReport = sentryReport): Promise<T> {
  if (!isThenable(work)) return work as T;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work) as Promise<T>,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          report(step, ms);
          reject(new NativeDeadline(step, ms));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Плагин, у которого каждый метод — со сроком и именем шага
 * `<имя плагина>.<метод>`. `slow` — методы, где отвечает человек, и их срок.
 */
export function withNativeDeadlines<P extends object>(
  pluginName: string,
  plugin: P,
  slow: Partial<Record<string, number>> = {},
  report: DeadlineReport = sentryReport,
): P {
  return new Proxy(plugin, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function" || typeof prop !== "string" || prop === "then") return value;
      return (...args: unknown[]) => {
        const step = `${pluginName}.${prop}`;
        try {
          return withinNative((value as (...a: unknown[]) => unknown).apply(target, args), step, slow[prop] ?? NATIVE_DEADLINE_MS, report);
        } catch (error) {
          return Promise.reject(error);
        }
      };
    },
  });
}

/** Только для тестов: забыть, о каких шагах уже сообщено. */
export function resetNativeDeadlineReportsForTests(): void {
  reported.clear();
}
