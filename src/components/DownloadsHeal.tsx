"use client";

import { useEffect } from "react";
import { healDownloads } from "@/lib/downloads-client";
import { sheetUrlsInHtml } from "@/lib/offline-save";
import { SIGNED_OUT_PARAM } from "@/lib/signed-out";

/**
 * СКАЧАННОЕ ДОЛЕЧИВАЕТСЯ ПРИ ЗАХОДЕ С СЕТЬЮ — ЗАХОД 7.235.
 *
 * Весь разбор — у `healDownloads` в `src/lib/downloads-client.ts`:
 * скачанное кодом до #412 не несло своих листов стилей, выкат уносил их
 * из чужого кеша, и каркас без сети прятал всё скачанное («Guardado: 0»
 * при двух строках в кабинете, видео владельца 26.09.2026).
 *
 * Один раз на полную загрузку, в простое и только с сетью: лечение
 * спрашивает сервер о листах стилей, и без сети ему нечего делать. На
 * первой странице после выхода из учётной записи не делает ничего —
 * там уборщик (`SignedOutCachePurge`) стирает скачанное, и лечение не
 * имеет права заводить его кеш заново (строка 317).
 */
let ranThisLoad = false;

export default function DownloadsHeal() {
  useEffect(() => {
    if (ranThisLoad || typeof window === "undefined" || typeof caches === "undefined") return;
    if (!navigator.onLine) return;
    if (new URL(window.location.href).searchParams.get(SIGNED_OUT_PARAM) === "1") return;
    // Каркас и сохранённая копия — не страница сайта: листов текущей
    // сборки у них нет, и переводить на них скачанное было бы не на что.
    if (document.body?.dataset.offlineShell === "1" || document.body?.dataset.offlineCopy === "1") return;
    const timer = window.setTimeout(() => {
      if (ranThisLoad) return;
      ranThisLoad = true;
      void healDownloads({
        caches,
        fetch: (url, init) => fetch(url, init),
        origin: window.location.href,
        currentSheets: sheetUrlsInHtml(document.head.outerHTML, window.location.href),
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
