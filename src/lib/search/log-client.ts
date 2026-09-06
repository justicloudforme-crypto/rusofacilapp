import type { LoggedLang } from "./demand";

/**
 * Отправка одной записи спроса из браузера.
 *
 * `sendBeacon`, а не `fetch`, потому что запись уходит ровно в тот момент,
 * когда окно поиска закрывается — а закрытие чаще всего происходит вместе
 * с переходом по ссылке, то есть страница в эту же миллисекунду начинает
 * уезжать. Обычный `fetch` в такой момент браузер имеет право отменить, и
 * тогда журнал систематически терял бы именно те заходы, у которых был
 * переход, — то есть врал бы в одну сторону про самое интересное поле.
 * `keepalive` у fetch — запасной путь для окружений без `sendBeacon`.
 *
 * Ошибки проглатываются намеренно и молча: человек, закрывший поиск, не
 * должен увидеть ничего от того, что счётчик не сработал.
 */
export function logSearchDemand(payload: {
  query: string;
  resultCount: number;
  lang: LoggedLang;
  followed: boolean;
}): void {
  if (typeof navigator === "undefined") return;
  if (!payload.query.trim()) return;

  const body = JSON.stringify(payload);
  try {
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/search/log", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/search/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // см. комментарий выше
  }
}
