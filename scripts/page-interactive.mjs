/**
 * «СТРАНИЦА ОЖИЛА» ДО НАЖАТИЯ — ДОЛГ 414, ЗАХОД 7.295.
 *
 * Что было. Шаг CI «Rendered surface» (без повторов) дважды краснел на
 * нажатии по вкладке: «locator.click: Timeout … exceeded», а в журнале
 * Playwright попеременно «`<div role="tablist" …>` intercepts pointer
 * events» и «`<header class="sticky top-0 …">` subtree intercepts pointer
 * events» (CI 44629803025 — `check-layout-geometry.mjs`, «Ejercicios» на
 * `/es/courses/a1/1` @ 320, 10 с; CI 44663883147 — `check-access-signs.ts`
 * `readGameTiles`, первая вкладка `/ru/word-games`, 30 с).
 *
 * Причина — не перекрытие. Пока React не догидратировал страницу, на
 * `<html>` стоит `data-hydrating`, и правило `globals.css`
 * `html[data-hydrating] button:not([type="submit"]):not(:disabled)`
 * снимает с КНОПОК `pointer-events` (HydrationMarker.tsx; так на медленной
 * сети нажатие не пропадает молча). Вкладка — `<button role="tab">`, и
 * точка нажатия проваливается в её родителя — полосу вкладок; после
 * очередной прокрутки Playwright — в липкую шапку над ней. Снимок первого
 * случая (артефакт `playwright-report`) это и показывает: вместо кнопки
 * «Descargar» пустая рамка, подсказки о подчёркнутых словах нет, вкладки
 * бледные — ровно как у той же страницы без JavaScript. То есть страница
 * за 10 с (и за 30 с во втором случае) так и не ожила, а нажатие честно
 * ждало, не зная, чего ждёт.
 *
 * Поэтому нажатие теперь ждёт ТО, ЧТО ПРИЛОЖЕНИЕ САМО СООБЩАЕТ (тот же
 * признак ждут `e2e/page-width.spec.ts`, `e2e/access-code.spec.ts`,
 * `scripts/check-bottom-inset.mjs`), в том же сроке, что был у нажатия, а
 * если страница не ожила — провал говорит именно это и перечисляет, что
 * ей мешало: какие запросы так и не кончились, какие упали, ошибки
 * страницы и консоли, кто управляет страницей (воркер или нет). Ничего не
 * глушится: не ожила — провал, как и раньше.
 */

/** Слушать запросы и ошибки страницы с самого её открытия. */
export function watchPage(page) {
  const started = Date.now();
  const pending = new Map();
  const failed = [];
  const errors = [];
  page.on("request", (r) => pending.set(r, Date.now()));
  page.on("requestfinished", (r) => pending.delete(r));
  page.on("requestfailed", (r) => {
    pending.delete(r);
    failed.push(`${shortUrl(r.url())} — ${r.failure()?.errorText ?? "?"}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e?.message ?? e).split("\n")[0].slice(0, 160)}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().split("\n")[0].slice(0, 160)}`);
  });
  return { started, pending, failed, errors };
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return (u.pathname + u.search).slice(0, 120);
  } catch {
    return String(url).slice(0, 120);
  }
}

/**
 * Ждать, пока страница не снимет `data-hydrating`. Возвращает `null`, если
 * ожила, иначе — строку-диагноз (одна строка для отчёта + подробности).
 */
export async function waitInteractive(page, timeoutMs, watch) {
  const t0 = Date.now();
  try {
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-hydrating"), null, {
      timeout: timeoutMs,
    });
    return null;
  } catch (e) {
    const state = await page
      .evaluate(() => ({
        hydrating: document.documentElement.hasAttribute("data-hydrating"),
        readyState: document.readyState,
        sw: navigator.serviceWorker?.controller ? "воркер управляет" : "без воркера",
      }))
      .catch(() => null);
    const lines = [
      `страница не ожила за ${Math.round((Date.now() - t0) / 1000)} с (на <html> остался data-hydrating — кнопки не принимают нажатий)` +
        (state ? `; readyState ${state.readyState}; ${state.sw}` : `; страница не отвечает: ${String(e?.message ?? e).split("\n")[0].slice(0, 100)}`),
    ];
    if (watch) {
      const now = Date.now();
      const pending = [...watch.pending.entries()].map(([r, at]) => `${shortUrl(r.url())} (висит ${now - at} мс)`);
      lines.push(`  незаконченные запросы: ${pending.length ? pending.slice(0, 12).join("; ") : "нет"}`);
      lines.push(`  упавшие запросы: ${watch.failed.length ? watch.failed.slice(0, 12).join("; ") : "нет"}`);
      lines.push(`  ошибки страницы: ${watch.errors.length ? watch.errors.slice(0, 8).join("; ") : "нет"}`);
    }
    return lines.join("\n");
  }
}
