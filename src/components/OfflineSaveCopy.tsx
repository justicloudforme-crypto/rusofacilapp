"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { askCacheNames, saveCopy } from "@/lib/offline-save-client";
import { copyMarkupOf } from "@/lib/downloads-client";
import { savedKindOf } from "@/lib/offline-save";

/**
 * СТРАНИЦА КЛАДЁТ СВОЮ КОПИЮ НА ТЕЛЕФОН САМА — ЗАХОД 7.230, СТРОКА 309.
 *
 * Весь разбор — в `src/lib/offline-save.ts`: коротко, внутри оболочки
 * навигацию обслуживает java-посредник Capacitor, воркер её не видит, а
 * значит и не кладёт в кеш ничего. Владелец 25.09.2026 на 1.0.5 прошёл с
 * Wi-Fi урок, два рассказа и словарь, убил приложение, выключил сеть —
 * и получил каркас три раза подряд: читать было нечего.
 *
 * Здесь только проводка. Правило живёт в `offline-save-client.ts`, у
 * него есть примеры с подставными кешами и позитивный контроль
 * мутацией; у компонента их быть не может без настоящего браузера.
 *
 * ПОЧЕМУ ПОСЛЕ ПОЛНОЙ ЗАГРУЗКИ И В ПРОСТОЕ. Копия снимается с уже
 * отрисованного документа (`documentElement.outerHTML`), то есть в ней
 * лежит ровно то, что человек видел, — вместе с панелью «Ejercicios»,
 * если он её открывал. Соревноваться за сеть и за кадр с самой
 * страницей при этом незачем.
 */
export default function OfflineSaveCopy() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || typeof caches === "undefined") return;
    if (!savedKindOf(window.location.pathname)) return;
    // Каркас и сохранённая копия — не страницы сайта, и сохранять их
    // поверх настоящей было бы порчей: у каркаса тот же адрес.
    if (document.body?.dataset.offlineShell === "1" || document.body?.dataset.offlineCopy === "1") return;

    let cancelled = false;
    let idle = 0;
    let timer = 0;

    const run = async () => {
      const names = await askCacheNames();
      if (cancelled || !names) return;
      await saveCopy({
        caches,
        names,
        url: window.location.href,
        pathname: window.location.pathname,
        // Снимок берётся с КОПИИ дерева, и кнопка «Descargar» из него
        // убирается (строка 313): нажать её в копии нечем — скрипты
        // каркас вырезает, — а застывшее «↓ 0 / 13» владелец уже видел.
        html: copyMarkupOf(document, null),
        title: document.title,
        lang: document.documentElement.lang === "ru" ? "ru" : "es",
        now: Date.now(),
      });
    };

    const start = () => {
      const idler = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback;
      if (typeof idler === "function") idle = idler(() => void run());
      else timer = window.setTimeout(() => void run(), 1500);
    };

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      const canceller = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle && typeof canceller === "function") canceller(idle);
      if (timer) window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
