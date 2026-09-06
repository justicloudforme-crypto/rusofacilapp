import type { Page } from "@playwright/test";

/**
 * Дождаться, пока ГЕОМЕТРИЯ страницы перестанет двигаться — вместо
 * ожидания, пока замолчит сеть.
 *
 * Почему не `networkidle`, числами (замер 05.09.2026, заход 7.124; первая
 * половина того же вывода — 04.09.2026, PROGRESS 7.103 и 7.104). Все
 * падения этого класса — не провал утверждения о вёрстке, а
 * `Test timeout of 30000ms exceeded` на самом ожидании. `networkidle` ждёт
 * 500 мс тишины ПОСЛЕ последнего запроса, а тишина здесь всё время
 * откладывается — префетч ссылок App Router'ом, Sentry, ленивые шрифты,
 * предзагрузка service worker'а на прод-сборке; на занятой машине она
 * может не наступить за 30 с вообще. И ждёт он не то: ширина документа —
 * это не сеть, и «сеть замолчала» ничего не говорит про то, построил ли
 * движок дерево отрисовки. Ровно это и поймал заход 7.124 в
 * `activity-calendar.spec.ts`: после наступившего `networkidle` WebKit
 * отдал `0/30 cells have a non-zero box`.
 *
 * Что вместо — тот же способ, что уже стоит в `check:layout`
 * (scripts/check-layout-geometry.mjs, `settle`):
 *
 *   1. `document.fonts.ready` — шрифты двигают ширину текста, то есть ровно
 *      ту величину, которую эти файлы и меряют;
 *   2. каждая картинка `complete` — картинка без атрибутов размера
 *      раздвигает страницу в момент своей догрузки. Это СТРОЖЕ, чем
 *      `waitUntil: "load"`, которого вместо этого ждали раньше: `load`
 *      ждёт ещё и всё, что геометрии не касается вовсе;
 *   3. подпись геометрии — ширина и высота документа плюс число элементов
 *      — снимается каждые 100 мс, и страница считается устоявшейся после
 *      трёх одинаковых подряд. Изменение подписи сбрасывает счётчик,
 *      поэтому появившийся с задержкой блок не проскакивает мимо замера, а
 *      заново запускает ожидание.
 *
 * Ожидание не ослаблено, а сужено: верхняя граница меньше таймаута теста,
 * поэтому исчерпание бюджета здесь даёт ЗАМЕР (и, если вёрстка сломана,
 * красное утверждение с числом), а не таймаут без единого числа.
 */
export const SETTLE_POLL_MS = 100;
export const SETTLE_STABLE_READINGS = 3;
export const SETTLE_MIN_MS = 300;
export const SETTLE_MAX_MS = 6000;

export async function settleGeometry(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  const started = Date.now();
  let last: string | null = null;
  let stable = 0;
  for (;;) {
    const sig = await page
      .evaluate(() => {
        const de = document.documentElement;
        // Незагруженная картинка — это геометрия, которая ещё поедет.
        // Пока хоть одна не `complete`, подпись намеренно не совпадает
        // сама с собой, то есть счётчик стабильности не набирается.
        const pending = [...document.images].filter((img) => !img.complete).length;
        return `${de.scrollWidth}x${de.scrollHeight}:${document.querySelectorAll("body *").length}:${pending}`;
      })
      .catch(() => null);
    stable = sig !== null && sig === last && sig.endsWith(":0") ? stable + 1 : 0;
    last = sig;
    const elapsed = Date.now() - started;
    if (stable >= SETTLE_STABLE_READINGS && elapsed >= SETTLE_MIN_MS) return;
    if (elapsed >= SETTLE_MAX_MS) return;
    await page.waitForTimeout(SETTLE_POLL_MS);
  }
}
