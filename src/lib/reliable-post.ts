/**
 * POST, который переживает уход со страницы.
 *
 * Зачем. Отметка «пазл решён» уходила обычным `fetch(...).catch(() => {})`.
 * Три беды сразу: (1) браузер вправе оборвать запрос, когда страница
 * уходит, а ученик как раз в этот момент и нажимает «к играм»; (2) один
 * отказ сети — и запись потеряна навсегда, повтора нет; (3) `.catch(() => {})`
 * съедает и настоящий отказ API, так что потеря не видна вообще никому.
 *
 * Что делает этот модуль:
 *
 *  - `keepalive: true` — запрос доживает до конца даже после того, как
 *    документ выгружен. Ограничение спецификации — 64 КБ на все keepalive-
 *    запросы страницы; тела здесь — десятки байт.
 *  - повтор с растущей паузой на сетевых отказах и на 5xx/429;
 *  - 4xx (кроме 429) НЕ повторяется: «нет такого пазла» и «не авторизован»
 *    повтором не чинятся, а лишний круг только жжёт батарею;
 *  - последний рубеж — `navigator.sendBeacon`: если страница уже уходит и
 *    fetch не успел, браузер обязан доставить маячок сам.
 *
 * Возвращает, чем кончилось, — чтобы вызывающий мог отличить «записано» от
 * «потеряно» и сказать об этом вслух, а не молчать.
 */

export type PostOutcome = "ok" | "rejected" | "lost";

export interface ReliablePostOptions {
  /** Сколько всего попыток fetch до маячка. */
  attempts?: number;
  /** Базовая пауза; каждая следующая вдвое длиннее. */
  backoffMs?: number;
  /** Подменяется в тестах. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function beacon(url: string, payload: string): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return false;
  try {
    return navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
  } catch {
    return false;
  }
}

export async function postReliably(
  url: string,
  body: unknown,
  { attempts = 3, backoffMs = 400, sleep = defaultSleep }: ReliablePostOptions = {},
): Promise<PostOutcome> {
  const payload = JSON.stringify(body);

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
      if (res.ok) return "ok";
      // Отказ, который повтор не починит.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return "rejected";
    } catch {
      // Сеть. Падать сюда — нормально, для этого и цикл.
    }
    if (attempt < attempts - 1) await sleep(backoffMs * 2 ** attempt);
  }

  return beacon(url, payload) ? "ok" : "lost";
}
