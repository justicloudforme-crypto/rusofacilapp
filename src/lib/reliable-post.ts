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

/**
 * Итог с подробностями — для очереди, которой мало «ok/rejected/lost»
 * (заход 7.236, `src/lib/progress-outbox.ts`): ей надо отличить «сервер
 * принял» от «сервер принял ПОВТОР» (тело ответа) и «не твоя запись»
 * (409) от «нет такого урока» (400). `status` — код последнего ответа
 * сервера, `null`, если ответа не было вовсе; `beacon` — ушёл ли маячок.
 */
export interface PostResult {
  outcome: PostOutcome;
  status: number | null;
  body: unknown;
  beacon: boolean;
}

export interface ReliablePostOptions {
  /** Сколько всего попыток fetch до маячка. */
  attempts?: number;
  /** Базовая пауза; каждая следующая вдвое длиннее. */
  backoffMs?: number;
  /** Подменяется в тестах. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Маячок последним рубежом (по умолчанию да). Очередь 7.236 его
   * выключает: маячок не сообщает, дошёл ли он, а запись очереди живёт
   * до ПОДТВЕРЖДЕНИЯ сервера — «ok» от маячка стёр бы её вслепую.
   */
  beacon?: boolean;
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
  options: ReliablePostOptions = {},
): Promise<PostOutcome> {
  return (await postReliablyForResult(url, body, options)).outcome;
}

async function readBody(res: Response): Promise<unknown> {
  try {
    return typeof res.json === "function" ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function postReliablyForResult(
  url: string,
  body: unknown,
  { attempts = 3, backoffMs = 400, sleep = defaultSleep, beacon: useBeacon = true }: ReliablePostOptions = {},
): Promise<PostResult> {
  const payload = JSON.stringify(body);
  let status: number | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
      status = res.status;
      if (res.ok) return { outcome: "ok", status, body: await readBody(res), beacon: false };
      // Отказ, который повтор не починит.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { outcome: "rejected", status, body: await readBody(res), beacon: false };
      }
    } catch {
      // Сеть. Падать сюда — нормально, для этого и цикл.
    }
    if (attempt < attempts - 1) await sleep(backoffMs * 2 ** attempt);
  }

  if (useBeacon && beacon(url, payload)) return { outcome: "ok", status, body: null, beacon: true };
  return { outcome: "lost", status, body: null, beacon: false };
}
