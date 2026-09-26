"use client";

import { useEffect, useState } from "react";
import { GUEST_OWNER, OUTBOX_CHANGE_EVENT, flushProgress, type FlushReport } from "@/lib/progress-outbox";

/** Проба, пока очередь не пуста: сама отправка и есть проба сети. */
const RETRY_MS = 20_000;
/** Первая попытка — после того, как страница встала. */
const FIRST_MS = 1_500;

/**
 * ОТПРАВКА ОЧЕРЕДИ ОТВЕТОВ — НА КАЖДОЙ СТРАНИЦЕ, А НЕ ТОЛЬКО В УРОКЕ.
 * Заход 7.236 (офлайн-3б), `src/lib/progress-outbox.ts`.
 *
 * До правки очередь досылалась только монтированием вкладки
 * «Ejercicios»: замер на эмуляторе — после возврата сети запись лежала,
 * пока человек снова не открыл упражнения урока. Теперь отправка идёт:
 *
 *   - при запуске любой страницы сайта (то есть и при следующем запуске
 *     приложения, когда сеть есть);
 *   - по событию `online` и при возврате на вкладку;
 *   - пробой раз в 20 с, пока у этого владельца есть ждущие записи —
 *     `online` на Android приходит не всегда (посадка 7.233, строка 4).
 *
 * Гость (`anon`) не отправляет ничего — у гостя очереди нет.
 *
 * ПРИБОР. Скрытая строка `data-rf-outbox-truth` — сколько ждёт, сколько
 * чужих, чем кончилась последняя отправка; для замера по видео и через
 * DevTools, как `data-rf-truth` у каркаса (посадка 7.233, строка 8).
 */
export default function ProgressOutboxSync({ owner }: { owner: string }) {
  const [truth, setTruth] = useState("");

  useEffect(() => {
    if (owner === GUEST_OWNER) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, ms);
    };
    const describe = (r: FlushReport) =>
      `ждёт ${r.waiting} · чужих ${r.foreign} · ушло ${r.sent} · повтор ${r.duplicate} · снято ${r.dropped} · стоп ${r.stoppedBy ?? "—"}`;

    async function run() {
      timer = null;
      const report = await flushProgress(owner);
      if (!alive) return;
      setTruth(describe(report));
      if (report.waiting > 0) schedule(RETRY_MS);
    }

    const soon = () => schedule(0);
    const onVisible = () => {
      if (document.visibilityState === "visible") soon();
    };
    schedule(FIRST_MS);
    window.addEventListener("online", soon);
    window.addEventListener(OUTBOX_CHANGE_EVENT, onChange);
    document.addEventListener("visibilitychange", onVisible);
    // Запись, добавленная без сети, должна попасть под пробу, даже если
    // первая отправка уже закончилась «пусто».
    function onChange() {
      if (!timer) schedule(RETRY_MS);
    }
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", soon);
      window.removeEventListener(OUTBOX_CHANGE_EVENT, onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [owner]);

  if (owner === GUEST_OWNER) return null;
  return <span hidden data-rf-outbox-truth={truth} />;
}
