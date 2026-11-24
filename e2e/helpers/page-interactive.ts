import type { Page, Request } from "@playwright/test";

/**
 * «СТРАНИЦА ОЖИЛА» ДО НАЖАТИЯ — В ТЕСТАХ E2E. ДОЛГ 424 (с влитым 425), ЗАХОД 7.306.
 *
 * Скрипты «Rendered surface» ждут этого с 7.295 (`scripts/page-interactive.mjs`,
 * долг 414, PR #551). Здесь — то же для тестов Playwright.
 *
 * Что было. `search-demand-log.spec.ts:183` (CI 45095560835) — нажатие
 * «Buscar» 30 с, 57 попыток, каждый раз «… intercepts pointer events»;
 * `sw-audio-replay.spec.ts:79` (CI 45118324669) — нажатие «Слушать» 58 с,
 * то же сообщение. Пока React не догидратировал страницу, на `<html>`
 * стоит `data-hydrating`, и `globals.css` снимает с кнопок
 * `pointer-events` (HydrationMarker.tsx) — нажатие проваливается в
 * родителя, и Playwright пишет «перехватывает» — ложный диагноз. Трассы
 * обоих случаев: страница, которой УЖЕ управлял воркер, после повторной
 * загрузки не ожила; документ и стили пришли за десятки мс, скрипты
 * страница брала через воркер (в сетевом журнале трассы их нет), ошибок
 * страницы и консоли нет. Почему скрипты не исполнились — трасса не
 * говорит; поэтому помощник при неудаче называет, ЧТО висит.
 *
 * Ничего не глушится и срок не растёт: ждём не дольше, чем ждало само
 * нажатие; не ожила — провал «страница не ожила» с перечнем незаконченных
 * и упавших запросов (с пометкой «через воркер»), скриптов без записи
 * в Resource Timing, состояния воркера и ошибок страницы.
 */

type Watch = {
  pending: Map<Request, number>;
  failed: string[];
  errors: string[];
};

const watches = new WeakMap<Page, Watch>();

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname + u.search).slice(0, 120);
  } catch {
    return url.slice(0, 120);
  }
}

/** Слушать запросы и ошибки страницы с её открытия. Ставится общим стендом (`helpers/test.ts`). */
export function watchPage(page: Page): void {
  if (watches.has(page)) return;
  const w: Watch = { pending: new Map(), failed: [], errors: [] };
  watches.set(page, w);
  page.on("request", (r) => w.pending.set(r, Date.now()));
  page.on("requestfinished", (r) => w.pending.delete(r));
  page.on("requestfailed", (r) => {
    w.pending.delete(r);
    w.failed.push(`${shortUrl(r.url())} — ${r.failure()?.errorText ?? "?"}`);
  });
  page.on("pageerror", (e) => w.errors.push(`pageerror: ${String(e?.message ?? e).split("\n")[0].slice(0, 160)}`));
  page.on("console", (m) => {
    if (m.type() === "error") w.errors.push(`console: ${m.text().split("\n")[0].slice(0, 160)}`);
  });
}

/**
 * Дождаться, пока страница снимет `data-hydrating`. Не ожила за `timeoutMs` —
 * бросает ошибку с диагнозом.
 */
export async function waitPageInteractive(page: Page, timeoutMs: number): Promise<void> {
  const t0 = Date.now();
  try {
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-hydrating"), null, { timeout: timeoutMs });
    return;
  } catch (e) {
    throw new Error(await diagnose(page, Date.now() - t0, e));
  }
}

async function diagnose(page: Page, waitedMs: number, cause: unknown): Promise<string> {
  const state = await page
    .evaluate(async () => {
      const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
      const loaded = new Set(performance.getEntriesByType("resource").map((e) => e.name));
      const scripts = [...document.querySelectorAll<HTMLScriptElement>("script[src]")].map((s) => s.src);
      return {
        hydrating: document.documentElement.hasAttribute("data-hydrating"),
        readyState: document.readyState,
        controller: navigator.serviceWorker?.controller ? navigator.serviceWorker.controller.state : "нет",
        registration: reg
          ? `active ${reg.active?.state ?? "—"}, waiting ${reg.waiting?.state ?? "—"}, installing ${reg.installing?.state ?? "—"}`
          : "нет",
        scriptsTotal: scripts.length,
        scriptsNotLoaded: scripts.filter((s) => !loaded.has(s)).map((s) => new URL(s).pathname),
      };
    })
    .catch((err: unknown) => ({ error: String((err as Error)?.message ?? err).split("\n")[0].slice(0, 120) }));
  const lines = [
    `страница не ожила за ${Math.round(waitedMs / 1000)} с (на <html> остался data-hydrating — кнопки не принимают нажатий; долг 424)`,
  ];
  if ("error" in state) {
    lines.push(`  страница не отвечает: ${state.error}`);
  } else {
    lines.push(
      `  readyState ${state.readyState}; воркер управляет: ${state.controller}; регистрация: ${state.registration}`,
      `  скриптов на странице ${state.scriptsTotal}, без записи о загрузке: ${state.scriptsNotLoaded.length ? state.scriptsNotLoaded.slice(0, 12).join(", ") : "нет"}`,
    );
  }
  const w = watches.get(page);
  if (w) {
    const now = Date.now();
    const pending = [...w.pending.entries()].map(
      ([r, at]) => `${shortUrl(r.url())}${r.serviceWorker() ? " (из воркера)" : ""} (висит ${now - at} мс)`,
    );
    lines.push(`  незаконченные запросы: ${pending.length ? pending.slice(0, 15).join("; ") : "нет"}`);
    lines.push(`  упавшие запросы: ${w.failed.length ? w.failed.slice(-12).join("; ") : "нет"}`);
    lines.push(`  ошибки страницы: ${w.errors.length ? w.errors.slice(-8).join("; ") : "нет"}`);
  } else {
    lines.push("  (страница открыта не общим стендом — журнал запросов не вёлся)");
  }
  lines.push(`  ожидание: ${String((cause as Error)?.message ?? cause).split("\n")[0].slice(0, 160)}`);
  return lines.join("\n");
}
