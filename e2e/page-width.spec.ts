import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";
import {
  FILL_THRESHOLD,
  MIN_CONTAINER_WIDTH,
  findUnderfilledRows,
  formatUnderfilled,
} from "../scripts/layout-fill.mjs";

/**
 * A page must never be wider than the phone it is on.
 *
 * This is the guard for a whole class, not for one bug. The class: some
 * element deep in a page has an intrinsic width the layout can't shrink,
 * nothing above it bounds that width, and the document starts scrolling
 * sideways. Everything the owner then sees follows from that one fact and
 * looks like three separate defects — the sticky header slides off to the
 * left so text passes where it used to cover, the footer's right edge stops
 * at the viewport and reads as clipped, and the page rocks under the thumb.
 *
 * It has now happened twice, from two unrelated causes: the footer's
 * six-link row (29.08.2026, PROGRESS.md 7.46) and a 16-column word-search
 * board inside an unbounded wrapper (30.08.2026, 7.60). Between them
 * `scripts/check-layout-geometry.mjs` was written, and it did catch the
 * first — but it runs against a URL a person hands it, over the ten page
 * shapes listed inside it. The second bug lived on pages nobody had listed,
 * on production, for as long as that check was reporting `ok`. So the
 * measurement also moves into the suite that runs on every push.
 *
 * What is asserted is one number: documentElement.scrollWidth must not
 * exceed its clientWidth. Horizontal page scroll is never intentional in
 * this app — everything that genuinely scrolls sideways (the word deck, the
 * tab strips, the filter chips, the puzzle cards) does it inside its own
 * `overflow-x: auto` box, which does not widen the document.
 *
 * Each page is measured twice, at the top and after a scroll: a block that
 * only exists below the fold is exactly the kind of thing that widens a
 * document once it appears.
 *
 * Since 02.09.2026 the same pass also asserts the OPPOSITE number, on the
 * same loaded pages: that no row of content covers under 70% of a container
 * wider than 700px (`scripts/layout-fill.mjs`, shared verbatim with
 * `check:layout`). The two questions are one visit apart and neither can
 * fire where the other does, so they ride together rather than doubling the
 * suite's logins.
 *
 * This run is the one that matters for the fill rule, because it is the one
 * that LOGS IN. `check:layout` is anonymous by construction, so /profile —
 * where the calendar sat at 53.3% of its column at 768, 820, 834 and 1024
 * alike — is invisible to it.
 */

/**
 * Two widths, and 320 is not decoration.
 *
 * 360 is the narrowest width still common on Android and the one where the
 * word-search overflow measured worst against a modern phone (25px past the
 * viewport, against 9px at 393 — PROGRESS.md 7.60). 320 is where the same
 * defect is actually WORST, and it is the width `scripts/check-layout-
 * geometry.mjs` had been sweeping all along: on production that check
 * reported `-comida` failing at 320 and 375. So the guard written to stop
 * this class from escaping again was watching a strictly milder case than
 * the hand-run check it was meant to back up. Measured by taking the fix
 * back out and rebuilding (30.08.2026): the same board overflows by 24px at
 * 360 and by 44px at 320 — the 408px wrapper is a fixed intrinsic width, so
 * every pixel the viewport loses is a pixel of overflow gained. 320 is a
 * real device too, not a paranoid margin — iPhone SE (1st gen) and Galaxy
 * S9+ both report it.
 *
 * Ordered widest-first so a failure report reads as "already broken at 360"
 * before "and worse at 320".
 */
const WIDTHS = [1024, 834, 820, 360, 320] as const;

/**
 * The four tablet widths the fill rule was reported for, plus the two phone
 * widths that were already here. 820 (iPad Air), 834 (iPad Air 10.9) and
 * 1024 (iPad Pro 11", and the `lg` breakpoint) all measured the same defect
 * at the same size — the calendar was a flat 384px inside a 720px column at
 * every one of them — and 768 is already swept by `check:layout`. They are
 * all kept anyway: 1024 is the only one where the `lg:` column ladders move,
 * and 820/834 are the only ones that would catch a fix that solved 1024 by
 * a breakpoint rather than by making the block a column.
 *
 * Ordered widest-first: a failure report then reads top-down from the
 * roomiest layout to the tightest.
 */

/**
 * Page SHAPES — one per way a page in this app is built — restricted to
 * what exists in CI, whose database is created empty by `prisma db push`
 * and then given the fixtures in scripts/seed-e2e-fixture.mjs.
 *
 * `/word-games/WORD_SEARCH/C1/5` is the one that matters and is not here
 * for variety: it is the 16×16 fixture board, i.e. the exact intrinsic
 * width that overflowed on production. A grid that dense cannot shrink past
 * its 22px-per-column floor, so this page goes too wide the moment nothing
 * above the board bounds it again.
 */
const PATHS = [
  "",
  "/courses",
  "/courses/a1/1",
  "/pricing",
  "/profile",
  "/word-games/WORD_SEARCH/C1/5",
  "/glossary/caso-nominativo",
];

/**
 * Дождаться, пока ГЕОМЕТРИЯ перестанет двигаться — вместо ожидания, пока
 * замолчит сеть.
 *
 * Почему не `networkidle` (замер 04.09.2026, PROGRESS 7.103 и 7.104). Все
 * падения этого файла в CI — не провал утверждения о ширине, а
 * `Test timeout of 30000ms exceeded` на самом `waitForLoadState`: в одном
 * красном окне упало 10 из 20 тестов файла разом, то есть подпись пика
 * нагрузки. `networkidle` ждёт 500 мс тишины ПОСЛЕ последнего запроса, а
 * тишина здесь всё время откладывается — префетч ссылок App Router'ом,
 * Sentry, ленивые шрифты; на занятой машине она может не наступить за
 * 30 с вообще. И ждёт он не то: ширина документа — это не сеть.
 *
 * Что вместо — тот же способ, что уже стоит в `check:layout`
 * (scripts/check-layout-geometry.mjs, `settle`): сначала шрифты
 * (`document.fonts.ready` двигают ширину текста, то есть ровно ту
 * величину, которую этот файл и меряет), затем подпись геометрии —
 * ширина и высота документа плюс число элементов — снимается каждые
 * 100 мс, и страница считается устоявшейся после трёх одинаковых подряд.
 * Изменение подписи сбрасывает счётчик, поэтому появившийся с задержкой
 * блок не проскакивает мимо замера, а заново запускает ожидание.
 *
 * Ожидание не ослаблено, а сужено: верхняя граница 6 с меньше 30 с
 * таймаута теста, поэтому исчерпание бюджета здесь даёт замер (и, если
 * вёрстка сломана, красное утверждение о ширине), а не таймаут без
 * единого числа.
 */
const SETTLE_POLL_MS = 100;
const SETTLE_STABLE_READINGS = 3;
const SETTLE_MIN_MS = 300;
const SETTLE_MAX_MS = 6000;

async function settleGeometry(page: import("@playwright/test").Page) {
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  const started = Date.now();
  let last: string | null = null;
  let stable = 0;
  for (;;) {
    const sig = await page
      .evaluate(() => {
        const de = document.documentElement;
        return `${de.scrollWidth}x${de.scrollHeight}:${document.querySelectorAll("body *").length}`;
      })
      .catch(() => null);
    stable = sig !== null && sig === last ? stable + 1 : 0;
    last = sig;
    const elapsed = Date.now() - started;
    if (stable >= SETTLE_STABLE_READINGS && elapsed >= SETTLE_MIN_MS) return;
    if (elapsed >= SETTLE_MAX_MS) return;
    await page.waitForTimeout(SETTLE_POLL_MS);
  }
}

async function measure(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const scrollsHorizontally = (el: Element) => {
      const o = getComputedStyle(el).overflowX;
      return o === "auto" || o === "scroll";
    };
    // A box that sticks out of a scroller by design is not the document's
    // problem — only an element with no horizontally scrollable ancestor
    // can widen the page.
    const insideAScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (scrollsHorizontally(p)) return true;
      }
      return false;
    };
    let widest: string | null = null;
    let worst = 1;
    for (const el of document.querySelectorAll("body *")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const over = Math.round(Math.max(b.right - vw, -b.left));
      if (over <= worst || insideAScroller(el)) continue;
      worst = over;
      widest = `<${el.tagName.toLowerCase()} class="${String(el.className || "").slice(0, 80)}"> ${Math.round(
        b.width
      )}px at [${Math.round(b.left)}, ${Math.round(b.right)}]`;
    }
    return { vw, scrollWidth: de.scrollWidth, widest };
  });
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 780 } });

    for (const lang of ["es", "ru"] as const) {
      test(`/${lang}: at ${width}px no page is wider than the viewport, and no container is left half empty`, async ({
        page,
      }) => {
    // Premium, not standard: /word-games and C1 content are both gated
    // (see helpers/auth.ts), and a redirect to /pricing would measure the
    // pricing page twice instead of the puzzle board once — a check that
    // passes for the wrong reason.
    await loginWithSubscription(page, { tier: "premium" });

    // /profile renders its empty state — no calendar, no stat tiles — until
    // the account has done something, and measuring that is measuring a
    // different page than the one this rule is about. One GET to
    // /vocabulary is enough: it marks the study day (markStudyDayVisit),
    // which is what `hasAnyProgress` reads. No fixture rows needed, so this
    // works against CI's empty database exactly as it does locally.
    await page.context().request.get(`/${lang}/vocabulary`);

    const tooWide: string[] = [];
    const underfilled: string[] = [];
    for (const path of PATHS) {
      const url = `/${lang}${path}`;
      const response = await page.goto(url);
      // Several routes exist only on /es and answer 404 on /ru by design;
      // that is not a width problem. A 500 is, and quietly measuring an
      // error page instead of the real one is how a check comes to pass
      // for the wrong reason.
      const status = response?.status() ?? 0;
      if (status === 404) continue;
      expect(status, `${url} did not answer 200`).toBe(200);
      await settleGeometry(page);
      // The once-a-day greeting is a modal over the whole page. It is
      // position:fixed, so the fill rule skips it — but it also covers what
      // is underneath, and a page measured through a dialog is not the
      // page. Dismissed by its backdrop's own corner: the panel inside
      // swallows a centre click.
      const greeting = page.locator('[role="dialog"][aria-modal="true"]');
      if (await greeting.count()) {
        await greeting.click({ position: { x: 4, y: 4 } }).catch(() => {});
        await greeting.waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
        // Снятие модалки — это само по себе изменение раскладки: пока она
        // висела, страница под ней не двигалась. Замер сразу после неё
        // мерил бы геометрию, которая ещё едет.
        await settleGeometry(page);
      }
      for (const row of await page.evaluate(findUnderfilledRows, {
        threshold: FILL_THRESHOLD,
        minContainer: MIN_CONTAINER_WIDTH,
      })) {
        underfilled.push(`${url}: ${formatUnderfilled(row)}`);
      }
      for (const scrollY of [0, 900]) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        await page.waitForTimeout(150);
        const m = await measure(page);
        if (m.scrollWidth > m.vw + 1) {
          tooWide.push(
            `${url} at scrollY=${scrollY}: document ${m.scrollWidth}px in a ${m.vw}px viewport` +
              (m.widest
                ? ` — widest offender ${m.widest}`
                : " — no single element to blame; check a parent's min-width")
          );
        }
      }
    }
        expect(tooWide, `pages wider than the viewport:\n${tooWide.join("\n")}`).toEqual([]);
        expect(
          underfilled,
          `containers wider than ${MIN_CONTAINER_WIDTH}px whose content covers under ` +
            `${FILL_THRESHOLD * 100}% of them:\n${underfilled.join("\n")}`
        ).toEqual([]);
      });
    }
  });
}
