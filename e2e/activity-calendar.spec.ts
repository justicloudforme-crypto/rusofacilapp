import { expect, test } from "@playwright/test";
import { loginWithSubscription } from "./helpers/auth";

/**
 * The activity calendar on /profile, MEASURED — not looked at.
 *
 * Three questions, none of which a screenshot answers:
 *   1. does the grid show the real days of the real month, in both locales;
 *   2. how big, in px, is the thing a finger has to hit at 320px — the
 *      narrowest viewport this project supports (PROGRESS.md 7.60, and the
 *      same width `page-width.spec.ts` measures overflow at);
 *   3. does anything on that page scroll sideways at 320.
 *
 * Every assertion below prints the number it asserted on, because "the
 * calendar fits" is not a result and "each day is 39.4 × 44.0 px inside a
 * 288px content column, overlapping its neighbour by 0.0px" is.
 *
 * What this file does NOT measure: the cold flame on a day WITHOUT study.
 * The account it builds registers seconds earlier, so every day before today
 * is "before you registered" and there is no missed day on the grid at all —
 * the branch is asserted in src/components/profile/ActivityCalendar.test.tsx,
 * where the fixture can have a history. The check below runs when a missed
 * day happens to exist and says so when it does not, rather than passing
 * silently on nothing.
 */

const NARROW = { width: 320, height: 780 };

/** WCAG 2.5.8 AA, the floor that actually applies to a seven-column month
 * grid. The project's own 44px rule (CLAUDE.md) is what a BUTTON gets when
 * the page can afford it; seven 44px squares plus their 2px gaps need 320px
 * of content width and there are 288 at this viewport, so the rule that can
 * be met here is this one — see the arithmetic printed by the test. */
const WCAG_MIN_TARGET = 24;

/** What the vertical size is held to instead: height is not scarce, so the
 * day keeps a full 44px of it. */
const MIN_TARGET_HEIGHT = 44;

test.use({ viewport: NARROW });

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}: the calendar shows the real month and its days are big enough to hit at 320px`, async ({
    page,
  }) => {
    await loginWithSubscription(page, { tier: "premium" });
    // /profile shows its empty state until the account has done something,
    // and an empty state has no calendar to measure. One GET marks the day.
    await page.context().request.get(`/${lang}/vocabulary`);

    const response = await page.goto(`/${lang}/profile`);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");

    const greeting = page.locator('[role="dialog"][aria-modal="true"]');
    if (await greeting.count()) {
      await greeting.click({ position: { x: 4, y: 4 } }).catch(() => {});
      await greeting.waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
    }

    const days = page.locator("[data-date]");
    const count = await days.count();

    // 1. Real days of a real month. The grid is built from the learner's own
    //    today (src/lib/activity-calendar.ts), so the count is that month's
    //    length — 28 to 31 — and the keys run 01..N without a hole.
    const keys = await days.evaluateAll((els) => els.map((el) => el.getAttribute("data-date")!));
    const month = keys[0].slice(0, 7);
    expect(keys.every((key) => key.startsWith(month))).toBe(true);
    expect(keys).toEqual(
      Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
    );
    const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
    expect(count).toBe(daysInMonth);
    console.log(`  /${lang}: ${month} drawn with ${count} day cells (month has ${daysInMonth})`);

    // 2. The size of the target, in px, for every single day — not for the
    //    one that happens to be first.
    const boxes = await days.evaluateAll((els) =>
      els.map((el) => {
        const b = el.getBoundingClientRect();
        return { date: el.getAttribute("data-date")!, w: b.width, h: b.height, l: b.left, r: b.right, t: b.top };
      }),
    );
    const smallest = boxes.reduce((min, b) => (b.w * b.h < min.w * min.h ? b : min));
    const widest = boxes.reduce((max, b) => (b.w > max.w ? b : max));
    console.log(
      `  /${lang}: day target — smallest ${smallest.w.toFixed(1)}×${smallest.h.toFixed(1)}px ` +
        `(${smallest.date}), widest ${widest.w.toFixed(1)}px`,
    );
    for (const b of boxes) {
      expect(b.w, `${b.date} is ${b.w.toFixed(1)}px wide`).toBeGreaterThanOrEqual(WCAG_MIN_TARGET);
      expect(b.h, `${b.date} is ${b.h.toFixed(1)}px tall`).toBeGreaterThanOrEqual(MIN_TARGET_HEIGHT);
    }

    // No day may cover its neighbour. This is not decoration: raising the
    // cell to 44px WITH `aspect-square` still in place made every square
    // 44px wide inside a 41.4px column, so seven of them overlapped by
    // 2.6px each and the last hung 4.6px past the grid — measured, and the
    // reason the square is dropped below `sm` rather than the column
    // widened. A target that covers its neighbour's edge is worse than a
    // slightly narrow one.
    const sameRow = boxes.filter((b) => Math.abs(b.t - boxes[0].t) < 1).sort((a, b) => a.l - b.l);
    let worstOverlap = 0;
    for (let i = 1; i < sameRow.length; i++) {
      worstOverlap = Math.max(worstOverlap, sameRow[i - 1].r - sameRow[i].l);
    }
    console.log(`  /${lang}: worst overlap between neighbouring days ${worstOverlap.toFixed(1)}px`);
    expect(worstOverlap).toBeLessThanOrEqual(0.5);

    // The arithmetic that says why 44 wide is not on the table here, printed
    // so the number above is read as a ceiling and not as a shrug.
    const grid = await days.first().evaluate((el) => {
      const row = el.parentElement!;
      const style = getComputedStyle(row);
      return { width: row.getBoundingClientRect().width, gap: parseFloat(style.columnGap || "0") };
    });
    const neededFor44 = 7 * 44 + 6 * grid.gap;
    console.log(
      `  /${lang}: grid ${grid.width.toFixed(1)}px wide, ${grid.gap}px gaps — ` +
        `seven 44px squares would need ${neededFor44.toFixed(1)}px`,
    );
    expect(neededFor44).toBeGreaterThan(grid.width);

    // 3. Nothing scrolls sideways at 320. Measured on the document, which is
    //    the only thing a learner can actually swipe.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    console.log(`  /${lang}: document ${overflow.scrollWidth}px in a ${overflow.clientWidth}px viewport`);
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    // 4. The flame and the cold flame: a day of study and a day without it
    //    are told apart by something drawn, not by the absence of it.
    const studied = page.locator('[data-date][data-state="active"]');
    expect(await studied.count(), "the marked day should be on the grid").toBeGreaterThan(0);
    const hotFlames = await studied.evaluateAll((els) =>
      els.map((el) => el.querySelector("span.absolute")?.className ?? ""),
    );
    expect(hotFlames.every((cls) => cls.length > 0 && !cls.includes("ice-flame"))).toBe(true);

    const missed = page.locator('[data-date][data-state="missed"]');
    const missedCount = await missed.count();
    if (missedCount > 0) {
      const cold = await missed.evaluateAll((els) =>
        els.map((el) => ({
          today: el.className.includes("ring-2"),
          glyph: el.querySelector("span.absolute")?.className ?? "",
        })),
      );
      for (const cell of cold) {
        // Today is not a missed day until it is over, so it carries no cold
        // flame — every other missed day does.
        if (cell.today) continue;
        expect(cell.glyph).toContain("ice-flame");
      }
      console.log(`  /${lang}: ${missedCount} day(s) without study, each carrying the cold flame`);
    } else {
      console.log(`  /${lang}: no day without study on this grid — the cold flame is not measured here`);
    }
  });
}
