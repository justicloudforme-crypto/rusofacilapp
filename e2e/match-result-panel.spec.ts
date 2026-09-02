import { type Page } from "@playwright/test";
import { test, expect } from "./helpers/test";

/**
 * One finished round must draw ONE result panel.
 *
 * The bug this closes: MatchApp (and its two siblings, RecallApp and
 * FillBlankApp) opened a CelebrationModal on the same state transition
 * that opened GameResultPanel. Both are z-50 overlays carrying the same
 * sentence — on Android at ~412px the celebration dialog sat centred
 * ("ПРЕКРАСНО! Раунд завершён! 4 пары" + «Продолжить») and the stats
 * sheet sat under it ("Раунд завершён! 4 пары", time, errors, «Играть
 * заново»/«Следующий раунд»), both on screen at once.
 *
 * Both overlays render `role="dialog"` (CelebrationModal's own div;
 * GameResultPanel via ui/Modal), so counting dialogs is what separates
 * one panel from two — and this spec fails on the pre-fix code for that
 * reason, which is the only reason it is worth having.
 *
 * Runs anonymously: /vocabulary hands a logged-out visitor a free sample
 * of up to 10 cards per category (see api/flashcards/route.ts), which is
 * more than the 4 a round needs. Runs in both locales because the panel
 * copy is per-locale, and in both Playwright projects — Desktop Chrome
 * and iPhone 13 — because the two overlays stack differently at the two
 * widths (centred dialog over a bottom sheet on the phone, two centred
 * dialogs on the desktop) and only one of those was reported.
 */

/** Opens Match on a category that actually has cards. `data-total` is on
 * the tile for this: in CI only the fixture's one category is non-empty,
 * and every other tile leads to "not enough words". */
async function openPlayableCategory(page: Page, lang: "ru" | "es") {
  await page.goto(`/${lang}/vocabulary?mode=match`);
  const tiles = page.getByTestId("category-tile");
  await expect(tiles.first()).toBeVisible();
  // Polled, not read once: every tile renders with data-total="0" until
  // POST /api/flashcards/summary answers, so a single read right after
  // the first tile appears finds nothing playable and the whole thing
  // fails for a reason that has nothing to do with what it measures.
  await expect
    .poll(async () =>
      (
        await tiles.evaluateAll((els) => els.map((el) => Number(el.getAttribute("data-total") ?? "0")))
      ).filter((t) => t >= 4).length,
    )
    .toBeGreaterThan(0);
  const totals = await tiles.evaluateAll((els) =>
    els.map((el) => Number(el.getAttribute("data-total") ?? "0")),
  );
  const index = totals.findIndex((t) => t >= 4);
  await tiles.nth(index).click();
  await expect(page.getByTestId("match-tile-ru").first()).toBeVisible();
}

/**
 * Plays the round to the end without knowing which Russian word pairs
 * with which translation: pick the first Russian tile still on the board,
 * try Spanish tiles until one of them is right (a wrong pair just flashes
 * red and clears), and repeat. A matched pair leaves the board, so "the
 * board is empty" is the finish line.
 *
 * Deliberately no knowledge of the fixture's contents: locally this runs
 * against dev.db's real cards, in CI against e2e/fixtures/flashcards.json.
 */
async function playRoundToTheEnd(page: Page) {
  const ru = page.getByTestId("match-tile-ru");
  const es = page.getByTestId("match-tile-es");

  for (let guard = 0; guard < 40; guard++) {
    const remaining = await ru.count();
    if (remaining === 0) return;

    const target = ru.first();
    const before = await es.count();
    for (let i = 0; i < before; i++) {
      await target.click();
      await es.nth(i).click();
      // The board holds a green/red flash for up to 650ms before it
      // unlocks the tiles again (MatchBoard's CORRECT/WRONG_FLASH_MS), so
      // a matched pair leaves the board a beat after the click.
      const matched = await ru
        .count()
        .then(async (c) => {
          if (c < remaining) return true;
          await page.waitForTimeout(700);
          return (await ru.count()) < remaining;
        });
      if (matched) break;
    }
  }
  expect(await ru.count(), "round never finished").toBe(0);
}

for (const lang of ["ru", "es"] as const) {
  test(`match round shows exactly one result panel (${lang})`, async ({ page }) => {
    await openPlayableCategory(page, lang);
    await playRoundToTheEnd(page);

    const dialogs = page.getByRole("dialog");
    await expect(dialogs).toHaveCount(1);

    // The one that survived has to be the one with the numbers and the two
    // next-step buttons — a run that kept the celebration modal instead
    // would also count one dialog.
    const panel = dialogs.first();
    await expect(panel.getByRole("button", { name: /Играть заново|Jugar de nuevo/i })).toBeVisible();
    await expect(panel.getByRole("button", { name: /Следующий раунд|Siguiente ronda/i })).toBeVisible();

    // "Раунд завершён! N пар" / "¡Ronda completa! N parejas" — once on the
    // page, not twice. Counting the sentence (not just the dialogs) is what
    // catches a future second panel that forgets role="dialog".
    const heading = page.getByText(/Раунд завершён|Ronda completa/i);
    await expect(heading).toHaveCount(1);

    // The progress line under the stats must print the denominator the API
    // actually sent — what this visitor can open — and name the locked
    // remainder only when there is one. Asserted against the live response
    // rather than a literal: locally the bank has 896 C1 cards behind
    // Premium, in CI the fixture has none, and a hardcoded number would
    // pin this test to one of the two. See PROGRESS.md 7.76.
    const summary = (await page.evaluate(async () => {
      const res = await fetch("/api/flashcards/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return res.json();
    })) as { availableWords: number; premiumOnlyWords: number };

    const panelText = (await panel.textContent()) ?? "";
    expect(panelText).toContain(String(summary.availableWords));
    if (summary.premiumOnlyWords > 0) {
      expect(panelText).toMatch(/Premium/);
      expect(panelText).toContain(String(summary.premiumOnlyWords));
    } else {
      expect(panelText).not.toMatch(/Premium/);
    }
  });
}
