# Freemium policy: what's free, what's Standard, what's Premium-only

Single source of truth for the three-tier content model. If you're changing
what a tier can access, change the code in `src/lib/entitlement.ts` (and the
seeding scripts referenced below) and update this file in the same PR — this
doc has no effect on runtime behavior by itself.

## The three tiers

`EntitlementTier` (`src/lib/entitlement.ts`) is `"free" | "standard" | "premium"`,
resolved by `getEntitlementTier()`:

- **free** — no active subscription (includes anonymous visitors and staff-free
  logged-in accounts with no purchase). Gets a small taste of each section,
  enough to judge the product before paying.
- **standard** — an active monthly or annual Stripe/RevenueCat subscription.
  Full access to everything *except* the Premium-exclusive slice carved out
  of a few sections (see below).
- **premium** — an active **lifetime** plan (a Subscription row with
  `plan === "lifetime"`, modeled as a normal subscription with
  `currentPeriodEnd` ~100 years out — see `src/lib/plans.ts`). No restrictions
  anywhere.

Staff accounts (`isStaff(user.role)`) always resolve to `"premium"`.

## Per-section rules

| Section | Free | Standard | Premium |
|---|---|---|---|
| Flashcards | `FREE_TRIAL_LIMITS.flashcards` (10) cards | 100% except C1 | 100% |
| Idioms (non-literary) | `FREE_TRIAL_LIMITS.idioms` (5) idioms | 100% except C1* | 100% |
| Idioms, `literary` category | 1 idiom | max 5 (`LITERARY_IDIOM_LIMITS.standard`) | 100% |
| Stories | 2 curated (`Репка`, `Теремок`) | 100% except `premiumOnly` rows | 100% |
| Word games | the first `FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel` (10) rungs of every (type, level) ladder except C1, plus the rungs listed by name in `EXTRA_FREE_WORD_GAME_RUNGS` — **83 puzzles** today, both types, A1–B2 | 100% except `premiumOnly` (curved ★ + top ~32% by sequence per ladder) | 100% |
| Media | curated 7-item free sample (`MediaItem.free`) | 100% (no separate Premium slice) | 100% |

The word-games row said "first 5 A1 WORD_SEARCH puzzles" until 05.09.2026.
That was the rule as it shipped in August; it was widened on 2026-08-28 to
ten rungs of every ladder but C1 and to both game types (see the comment on
`FREE_TRIAL_LIMITS.wordGamePuzzlesPerLevel`), and three more rungs were
opened by name on 05.09.2026 when the density split moved half of a free
themed board onto a new, paywalled row (`EXTRA_FREE_WORD_GAME_RUNGS`). This
doc was never swept, so it understated the free sample by a factor of
sixteen. The number is not written down anywhere in the product any more —
`src/lib/intro/stats.ts` counts it by sifting candidate rungs through
`isFreeWordGamePuzzle` — and it is quoted here only as "today", with the
rule beside it.

\* Idiom `level` is currently a non-functional placeholder — every row in the
DB is tagged `"A2"` (a known temporary stand-in, see the schema comment on
`Idiom.level`), so `canAccessLevel`'s C1 check never actually excludes an
idiom today. This is a data problem, not a logic bug — fix by re-tagging
idiom levels, not by changing `canAccessLevel`.

### Why "literary" idioms get their own cap

Every other section's Premium-exclusive slice is "the hardest CEFR level" or
"a difficulty-ranked top slice." Literary idioms (proverbs' more advanced,
harder-to-parse sibling) are gated by *category* instead, at the user's
explicit request — Free gets one to know the category exists, Standard gets a
real but capped sample (5), Premium sees the full bank. `proverbs` is not
gated this way; only `literary` is.

### Why stories and word games use different splitting mechanisms

Both sections target roughly the same "~30-35% Premium-exclusive" outcome,
but arrive at it differently because they have different underlying
difficulty signals:

- **Word games** have a genuine per-item difficulty signal: `curved` (★)
  puzzles are always the hardest rung of their `(type, level)` ladder, and
  were confirmed (empirically, across every group) to always sit at the tail
  of that ladder's `sequence` range. `prisma/set-premium-only-word-games.ts`
  flags the top `~32%` of each `(type, level)` group by `sequence` —
  mathematically guaranteed to fully include every curved puzzle, so the two
  concepts (curved / premiumOnly) never disagree in practice. Runtime checks
  test `puzzle.curved || puzzle.premiumOnly` together
  (`canAccessCurvedPuzzle`) as defense-in-depth in case a future
  puzzle-generation script ever sets one without the other.
- **Stories** have no such per-item signal — nothing distinguishes an "easy"
  B2 story from a "hard" one. A clean CEFR-level split doesn't hit the
  target either (C1-only is 20% of the library, C1+B2 is 40%). Instead,
  `prisma/set-premium-only-stories.ts` sets a deterministic default (all C1 +
  the first half of B2 stories by `createdAt`, landing at ~30%) that a staff
  member then corrects by hand per-story through the admin editor
  (`Story.premiumOnly` toggle in `src/components/admin/StoryEditor.tsx`) —
  script picks a reasonable starting point, a human makes the actual
  editorial call.

Both scripts are idempotent (`npm run db:set-premium-only-stories` /
`npm run db:set-premium-only-word-games`) — safe to re-run after adding new
content, though a re-run will not preserve a staff member's manual
`Story.premiumOnly` corrections if it changes what the deterministic default
would pick for that row. Re-check the admin table after re-running against a
library that already has manual corrections in it.

### Why media has no Premium-exclusive slice

Media (songs/movies/videos/grammar explainers) is free-sample-vs-subscribed
only — `canAccessMediaItem(tier, item)` is `item.free || tier !== "free"`.
There's no natural difficulty axis for a video the way there is for a CEFR
level or a puzzle ladder, so unlike stories/word games it doesn't get a
second, Premium-only cut. This may change if the section grows a difficulty
dimension worth gating on.

## Where the paid badge comes from

One place, for every kind of content: `AccessRequirement` in
`src/lib/access-marks.ts` — `"free"` / `"subscription"` / `"premium-tier"`,
one `*Requirement()` function per kind, one component (`AccessMark`), one
glyph per value (🔒 and 👑), and one pair of labels
(`dict.access.subscriptionBadge` / `dict.access.premiumTierBadge`, both
locales). What to draw for a given visitor is `accessMarkFor(requirement,
tier)`, and the rule is "a mark is shown to whoever cannot open the thing" —
a subscriber who has access is told nothing.

Surfaces that print it: the story catalog, the story page, the word-game
picker, the media catalog, the search results window, and the lesson list.
The C1 pill on `/vocabulary` carries the crown too.

Two things this deliberately does NOT model, both because free-ness there is
POSITIONAL rather than a property of the row: flashcards and idioms. The
free sample is "the first N of the list", so no single card can be called
free, and `flashcardRequirement` / `idiomRequirement` therefore never return
`"free"`. That over-marks 230 cards and 5 idioms (PROGRESS.md 7.153, debt
104) and under-marks nothing — the opposite direction was the defect: until
09.09.2026 the search index called 4553 cards and 2210 puzzles open when
they were not.

`npm run check:mark-truth` holds the line: a record marked "open" must be
open to an anonymous visitor by the FREE-SAMPLE rule (`isFreeWordGamePuzzle`,
`isFreeTrialLesson`, `MediaItem.free`, `Story.isPremium`) — a different code
path from the one that sets the mark, which is what makes it a check rather
than a restatement.

## List-ordering rule

Catalog pages that mix accessible and locked items sort accessible-first
(stable sort, so it never fights whatever ordering the page already had —
e.g. media's grammar-first ordering) and render locked items with a lock
badge whose `onClick` opens the paywall (`usePaywall().openPaywall(reason)`,
`reason: "free" | "premium"`) instead of navigating. Implemented for
**stories** (`getStoryAccess` in entitlement.ts, shared by the catalog and
reader page) and **media** (`canAccessMediaItem`). **Word games** didn't need
a separate sort — `sequence` order already *is* the natural list order, and
locked-tile-opens-paywall predates this policy. **Idioms are the one
exception**: the API hides over-cap `literary` rows entirely server-side
(`capLiteraryIdioms` in `src/app/api/idioms/route.ts`) rather than sending
locked stubs for the client to render-and-paywall — a bigger response-shape
change would be needed to give idioms the same "show locked, click to
paywall" treatment as stories/media, and hasn't been judged worth it since
idioms are the one section gated by category rather than a visible list
position.

## Premium (lifetime) visual identity

Premium subscribers get a consistent gold/`amber-500` accent, distinct from
the brand-blue accent used to steer most visitors toward the annual plan:

- **Avatar**: a gold ring + crown (`MatryoshkaAvatar`'s `premium` prop) on
  every render of a real account's avatar — header (desktop dropdown +
  mobile sheet), profile page, public profile (`/u/[handle]`), and the group
  leaderboard (each member's own tier, not the viewer's).
- **Pricing/paywall**: the lifetime plan card and paywall button use the
  amber accent (`border-amber-500`/`bg-amber-500/5`) instead of the brand
  accent, with a 👑 badge and a cost-comparison line
  (`dict.pricing.lifetime.valueNote`) showing how many years of the annual
  plan it takes to break even on the one-time price.

## Free-trial constants

`FREE_TRIAL_LIMITS`, `LITERARY_IDIOM_LIMITS` (both in `entitlement.ts`) are
deliberately small, fixed counts rather than percentages — the free tier is
meant to be a taste of the product, not a meaningfully usable substitute for
subscribing. Changing these numbers is a product decision, not a technical
one; there's no test enforcing a particular value.
