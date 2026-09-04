import type { APIRequestContext } from "@playwright/test";
import { test, expect } from "./helpers/test";
import { loginWithSubscription, loginWithoutSubscription } from "./helpers/auth";

/**
 * The half of the word-games access matrix that used to be checked by hand
 * against the LIVE database: **signed in, no subscription**.
 *
 * Production still carries three `e2e-manual-check-*@example.test` rows,
 * created on three separate occasions for exactly this one state, because
 * nothing in the suite could produce it. loginWithoutSubscription does, so
 * nothing has to be created on the real site again.
 *
 * Both puzzles below exist in dev.db AND in e2e/fixtures/word-games.json,
 * so this runs identically locally and in CI. They are picked for what the
 * ROUTE has to decide about them, not for their content:
 *
 * - CROSSWORD A1/1 — sequence <= 10, so free-trial (see free-tier.ts).
 * - CROSSWORD B1/91 — sequence > 10 and premiumOnly = false: paid, and a
 *   `standard` subscriber is fully entitled to it. That second half is what
 *   makes it a control rather than a second copy of the first assertion —
 *   the 403 below has to be about the missing subscription, not about the
 *   puzzle being unreachable for everyone.
 *
 * The premiumOnly-for-a-standard-subscriber row of the same matrix is
 * covered by the route's own unit tests (check/route.test.ts,
 * hint/route.test.ts) and was measured on production on 04.09.2026; there
 * is no premiumOnly CROSSWORD in the CI fixture to drive it from here.
 */
const FREE_PUZZLE = { type: "CROSSWORD", level: "A1", sequence: 1 };
const PAID_PUZZLE = { type: "CROSSWORD", level: "B1", sequence: 91 };

interface Target {
  id: string;
  /** An ANSWER cell of that puzzle, not a blocked square — /hint answers
   * 400 `not_a_cell` for a blocked one, which would look like a pass on a
   * route that never even reached its access rule. The public crossword
   * payload carries every word's starting row/col, so the first word's
   * start is an answer cell by construction, whatever the grid looks like
   * locally or in CI. */
  cell: { row: number; col: number };
}

async function targetOf(
  request: APIRequestContext,
  puzzle: { type: string; level: string; sequence: number },
): Promise<Target> {
  const response = await request.get(
    `/api/word-games?type=${puzzle.type}&level=${puzzle.level}&sequence=${puzzle.sequence}`,
  );
  expect(response.status(), `GET /api/word-games ${puzzle.level}/${puzzle.sequence}`).toBe(200);
  const body = await response.json();
  const id = body?.puzzle?.id;
  expect(typeof id, `puzzle id for ${puzzle.level}/${puzzle.sequence}`).toBe("string");
  const first = body?.puzzle?.words?.[0];
  expect(first, `words[0] of ${puzzle.level}/${puzzle.sequence}`).toBeTruthy();
  return { id, cell: { row: first.row, col: first.col } };
}

const check = (request: APIRequestContext, target: Target) =>
  request.post("/api/word-games/check", {
    data: { puzzleId: target.id, guesses: [{ ...target.cell, letter: "а" }] },
  });

const hint = (request: APIRequestContext, target: Target) =>
  request.post("/api/word-games/hint", { data: { puzzleId: target.id, ...target.cell } });

test("залогиненный без подписки: /check и /hint закрыты на платном пазле и открыты на бесплатном", async ({
  page,
}) => {
  // Both ids are read while entitled — a puzzle id is just a string, and
  // the whole point of the gate is that holding one does not grant access
  // (see isFreeWordGamePuzzle's doc comment). Registering below replaces
  // this session with a brand-new, unsubscribed one in the same context.
  await loginWithSubscription(page);
  const request = page.context().request;
  const free = await targetOf(request, FREE_PUZZLE);
  const paid = await targetOf(request, PAID_PUZZLE);

  await loginWithoutSubscription(page);

  // The state itself, asserted rather than assumed: signed in, tier free.
  const status = await request.get("/api/subscription/status");
  expect(status.status()).toBe(200);
  expect(await status.json()).toEqual({ tier: "free" });

  const paidCheck = await check(request, paid);
  expect(paidCheck.status(), "POST /check on a paid puzzle without a subscription").toBe(403);
  expect(await paidCheck.json()).toEqual({ error: "subscription_required" });

  const paidHint = await hint(request, paid);
  expect(paidHint.status(), "POST /hint on a paid puzzle without a subscription").toBe(403);
  expect(await paidHint.json()).toEqual({ error: "subscription_required" });

  // Control on blindness: the same two routes, the same account, a
  // free-trial puzzle. Without these the 403s above would also pass if the
  // routes were simply broken for everyone.
  const freeCheck = await check(request, free);
  expect(freeCheck.status(), "POST /check on a free-trial puzzle without a subscription").toBe(200);
  expect((await freeCheck.json()).results).toHaveLength(1);

  const freeHint = await hint(request, free);
  expect(freeHint.status(), "POST /hint on a free-trial puzzle without a subscription").toBe(200);
  expect(typeof (await freeHint.json()).letter).toBe("string");
});
