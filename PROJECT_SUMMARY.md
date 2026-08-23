# RusoFácilapp — Project Summary

Last updated: 2026-08-22. This file now covers **multiple independent work
threads** that happened in separate, concurrent Claude Code windows on this
same repo — read the section relevant to what you're picking up. §0
(gamification celebration catalog) is a closed-out thread; §1-11 is an
earlier, unrelated session about the production audio/subtitle pipeline —
still fully valid standing knowledge about the app's infrastructure, just not
about gamification; the un-numbered **"Word-games" section** (placed right
after §11, before §12 "This window's session") covers the Crucigrama/Sopa
de Letras feature — **not closed out**, has explicit pending steps, read
its own §12.5-12.6 subsections before touching word-games.

Live site: **https://rusofacilapp.com**

## 0. Session: Gamification Celebration Catalog (this window, closed out 2026-08-22)

**Status: done.** Target reached and exceeded — no open task, nothing
blocking. Safe to close this window; a new session picking this thread back
up should start by reading this section, then skimming
`src/components/celebration/catalog/index.ts` to confirm the count still
matches reality.

### 0.1 What was built
A full gamification layer for lesson/flashcard completions:
- **Streaks**: `src/lib/streaks.ts` (+ `streaks.test.ts`) computes "days in a
  row" from existing `LessonProgress`/`FlashcardProgress` rows — no schema
  changes. Wired into `src/app/[lang]/profile/page.tsx`'s progress tab.
- **Celebration system**: `CelebrationModal` (win) / `EncouragementModal`
  (fail) — shown on lesson pass/fail and streamed into the flashcard
  mini-games (`RecallApp`, `FillBlankApp`, `MatchApp`/`MatchBoard`,
  `AnswerPad`, `VocabularyApp`) for in-gameplay micro-celebrations.
- **Sound**: `src/lib/sound.ts` — Web Audio API oscillator synthesis (no
  audio files, zero network weight). `SoundToggle.tsx` in the Navbar,
  localStorage-backed (`rusofacil-sound-enabled`).
- **The catalog** (the core architectural deliverable): a hand-built,
  statically-registered library of **153 unique win/fail micro-animation
  scenarios** (89 win + 64 fail), built up over ~20 incremental batches per
  the user's explicit "small batches of 5–8, quality over speed" directive,
  closing out past the original 150 target.

### 0.2 Architecture (read this before adding any new scenario)
- `src/components/celebration/catalog/index.ts` — single source of truth.
  Each entry: `{ id, outcome: "win"|"fail", category: "everyday"|"streak"|
  "milestone", load: () => import(...) }`. `load` is a dynamic import.
- `ScenarioStage.tsx` — wraps each `load` in `next/dynamic({ssr:false})`,
  cached per-id in a module-scope `Map` so bundle weight never scales with
  catalog size — only scenarios actually rolled get their JS chunk fetched.
- `pickScenario.ts` — `createScenarioPicker(pool, historySize=4)` gives
  anti-repeat random selection; `CelebrationModal` and `EncouragementModal`
  each keep their own independent pool/history so win and fail rotations
  never cross-contaminate.
- `everyday` scenarios are what the two modals randomize across day-to-day;
  `streak`/`milestone` are held back, opted into explicitly via a `variant`
  prop (e.g. a correct-answer streak, a level-up/exam pass).
- Every scenario file (under `catalog/characters/`, `music/`, `home/`,
  `patterns/`, `seasons/`, `fail/`) carries a mandatory "Story beats:"
  header comment naming each animation phase, its timing, and which CSS
  class/keyframe drives it — a hard house style, keep following it.
- **CSS keyframe reuse is a load-bearing discipline, not a nicety.** New
  scenarios are expected to reuse an existing `@keyframes` under a new
  semantic class name (e.g. `.karavai-raise { animation: carrot-raise ...}`)
  whenever the motion is genuinely the same shape, rather than duplicating.
  The later batches in this session got very good at this — batch 20 shipped
  12 scenarios on only 6 new keyframes. `src/app/globals.css` groups every
  batch's additions under a labeled `/* === catalog/ Nth wave === */` block,
  each followed by that wave's keyframes, then every new class name gets
  appended to the single shared `@media (prefers-reduced-motion: reduce)`
  block near the end of the file — never skip that last step.

### 0.3 Recurring gotchas worth knowing before touching this code
1. **Two classes, each with their own `animation` shorthand, on the same
   element silently conflict** — the second's `animation:` property fully
   replaces the first's rather than layering on top. Hit this twice
   (`MatryoshkaShawlTwirl`, `PancakeFaceSplat`, `BearHoneyHeadStuck`). Fix:
   either fold both motions into one keyframe/class, or split across two
   nested elements (outer holds one animation, inner holds the other).
2. **A CSS `animation` on `transform` fully overrides any static inline
   `transform`** on that same element. For a fixed angle + a continuous
   spin (e.g. `KaruselIceSpin`, `MatryoshkaDizzySpin`), you need a 3-level
   nest: outer span = static rotate (fixed position on a circle), middle
   span = the one that carries the animated rotate, inner element = the
   actual visible glyph/shape with no transform of its own.
3. Twice this session a stray **Cyrillic character crept into a file path**
   typed by hand (`MatryoshkaTopplеOver.tsx` with a Cyrillic е; a
   `vasiliipetrов` directory typo). Both were caught immediately — one by
   `ls` showing the odd filename, one by the OS permission error refusing
   to `mkdir` outside the home directory — and cleaned up before verification
   ran. Worth a quick `find … -regex '.*[Α-Яа-яЁё].*'` sanity check if this
   ever happens again and doesn't surface as loudly.
4. A second, unrelated Claude Code session (`visual-studio-13` as of
   2026-08-22, name may change) was active on this same repo throughout —
   doing a DB/deploy audit (this is exactly the audio/Turso work in §1
   below). Standing practice: never revert its changes, route around any
   unrelated build breakage it introduces, re-read shared files (esp.
   `src/dictionaries/es.json`/`ru.json`) immediately before editing since
   they may have changed underneath.

### 0.4 Verification ritual (repeat for any future batch)
`npx tsc --noEmit -p .` → `npx eslint <changed paths>` → validate both
dictionary JSONs parse → `npx vitest run` (144 tests, 21 files, must stay
green) → start `npm run dev` in the background, curl
`/es/courses/a1/1?tab=exercises` and `/es/vocabulary` with a hand-HMAC-signed
session cookie for the test account (`cmsnx7ztr000588ncy3bx1x2d`,
`sessionVersion 0`, signed per `src/lib/session-token.ts`'s
`userId.version.hmac-sha256(SESSION_SECRET)` scheme) expecting 200 + no
error lines in the log → `pkill -f "next dev"` to leave no stray server
running.

### 0.5 If picking this thread back up
Nothing is broken or half-finished. The only real "next step" is a product
decision the user hasn't made yet: whether to keep growing the catalog past
153, move on to a different feature, or leave it as-is. Don't start a new
batch unprompted.

## 1. What this is

A Russian-learning platform for Spanish speakers (Mexico-focused). Courses
A1→B2 (30 lessons each, 120 total), 325 short stories (A1→C1), a glossary
of grammar reference terms, flashcards, idioms, exams every 10 lessons, and
a media gallery (songs/grammar-explainer videos/movie clips) with bilingual
subtitles. Subscription-gated via Stripe (currently in test mode — no real
charges are live commercially yet, confirmed with the user).

## 2. Stack

- **Next.js 16 (App Router, webpack build)**, React 19, TypeScript, Tailwind.
- **Prisma 7** as the ORM, with **two different driver adapters** depending
  on environment (see §4 — this matters a lot):
  - Local dev: `@prisma/adapter-better-sqlite3` against `file:./dev.db`.
  - Production: `@prisma/adapter-libsql` against Turso (`TURSO_DATABASE_URL`
    / `TURSO_AUTH_TOKEN`, set in Vercel's env, not in the local `.env`).
- **Hosting: Vercel**, project `rusofacilapp` (org `rusofacilappcom`).
  **No git remote is configured in this local checkout** — deploys go
  through `vercel --prod` run directly from local disk, not git push/CI.
  There is a `.github/workflows/ci.yml` but it has never actually run
  against a real GitHub remote.
- **Database: Turso (libsql)**, database name `rusofacilapp-prod`, free
  tier (5GB storage, 500M reads/10M writes per month included — current
  usage is tiny, ~11MB before this session's data landed, still far under
  the limit even now).
- **File storage: Vercel Blob.** Two separate stores:
  - The original store (`BLOB_READ_WRITE_TOKEN`) — **private**, used only
    for student voice-pronunciation recordings (`src/lib/voice-storage.ts`)
    and DB backups (`src/lib/backup.ts`).
  - A **second, public store** (`AUDIO_BLOB_READ_WRITE_TOKEN` +
    `AUDIO_BLOB_STORE_ID`) created this session specifically for narration
    audio, after discovering the first store was private-only and couldn't
    serve `<audio src>` directly. This is where all 21,867 audio clips now
    live. Project is on **Vercel Pro** (upgraded this session — Blob's
    Hobby-tier limit is only 10,000 "Advanced Operations"/month and a
    bulk migration blows through that instantly, triggering a **30-day
    full store lockout**, not just throttling — learned this the hard way,
    see §7).
- **AI integrations**:
  - **OpenAI** (`gpt-4o-mini-tts`, voice `onyx`) — all narration audio.
    Whisper (`whisper-1`) — used only to *audit* generated clips (transcribe
    back and diff against source text) before caching them, never for
    anything user-facing.
  - **Anthropic Claude** (`claude-sonnet-5` by default, overridable via
    `ANTHROPIC_MODEL`) — generates bilingual (RU/ES) subtitles for the
    media gallery from YouTube captions, and full `VideoLessonData` JSON
    for admin-authored video lessons.
  - **Upstash Redis** — shared rate-limiting + TTL cache across serverless
    instances. **Not currently set in Vercel's production env** (only
    exists in local `.env`) — production silently falls back to an
    in-memory `Map`, which is weaker (per-instance, not shared) but not
    broken. Worth fixing but low urgency.
- **Resend** — transactional email (password reset, account deletion).
- **yt-dlp** (CLI, not npm) — pulls YouTube captions for the subtitle
  pipeline. Lives at `~/Library/Python/3.9/bin` on this machine, not on
  default `PATH` — prepend it each session if you need it.

## 3. Voice/audio policy — READ THIS BEFORE TOUCHING ANY AUDIO CODE

**"Write Once, Lock Forever."** This is a standing, repeatedly-reaffirmed
project rule:

- Once a narration clip exists in the `AudioAsset` cache for a given
  `(contentType, contentId, itemKey)`, it is **permanent**. Editing the
  source text (a typo fix, a reword) **never** triggers automatic
  re-synthesis — see `src/lib/audio-assets.ts`'s `ensureAudioAsset()`.
  Re-narrating one specific item only ever happens via an explicit
  `--force` flag scoped narrowly (never a blanket re-narrate).
- A single voice, **`onyx`**, is used everywhere **except** legitimate
  multi-character story dialogue, which uses a small cast
  (`ash`/`echo`/`nova`/`shimmer`) assigned per character — see
  `prisma/generate-story-audio-cast.ts`.
- **Never generate audio dynamically at request time.** Everything is
  pre-generated by a `prisma/generate-*-audio.ts` CLI script, cached in
  `AudioAsset`, uploaded to Blob, and only ever *played back* by the app.
  `SpeakButton.tsx` falls back to the browser's free `speechSynthesis` API
  only when no `audioUrl` was resolved — this fallback is what "sounds
  wrong" reports have always turned out to be a symptom of.
- **Never run a new paid TTS generation without the user's explicit
  go-ahead**, even a single sentence. Always report what's missing and
  wait for approval.

## 4. Database structure & the dev.db ↔ Turso sync problem (important!)

This is the single most important thing to understand before doing a
"global audit."

### 4.1 Two independent databases
- **Local `dev.db`** (SQLite file, gitignored) — what `npm run dev` uses.
- **Production Turso** — what the live site uses.

These are **not automatically kept in sync**. Content gets seeded into
each independently (local via `npm run db:seed-*` / admin panel against
local dev server; production via the admin panel against the live site,
or via one-off scripts pointed at Turso credentials). This already caused
two real, confirmed production incidents this session:

1. **`Story` and `GlossaryTerm` primary keys diverged between the two
   databases.** Both tables use Prisma's `@default(cuid())` with no fixed
   id — the *same* logical story/term seeded independently into each DB
   ends up with a *different* random id in each. When this session's
   audio migration synced `AudioAsset` rows to Turso using **local** ids
   as `contentId`, **315 of 325 stories and 46 of 91 glossary terms**
   became unreachable in production (the id the live page looks up by
   didn't match the id the audio was filed under). **Fixed** via
   `prisma/remap-audio-content-ids.ts`, which maps local id → prod id by
   a stable *content* key (title+author for Story, slug for GlossaryTerm
   — the same keys `prisma/sync-to-production.ts`, a pre-existing script,
   already uses) and corrects `AudioAsset.contentId` in place.
   - `Idiom` and `FlashcardCard` were **not** affected — their ids are
     mostly human-assigned slugs (`idiom-c1-vor-shapka-gorit`,
     `abs2-selfesteem`), not random cuids, so they're stable across
     both databases.
   - `Lesson`, `Exam` content uses deterministic slug keys (`b2-30`, not
     a cuid) — never affected by this class of bug at all.
2. **Two entire tables' worth of generated content never reached
   production**, full stop — not an id mismatch, just never synced:
   - `AudioAsset` (21,867 rows) — the *entire* professionally-narrated
     audio library existed only in `dev.db` until this session. Fixed via
     `prisma/sync-audio-assets-to-turso.ts`.
   - `MediaOverride.subtitles` (232 of 233 rows) — same story for the
     media gallery's bilingual subtitles. Fixed via
     `prisma/sync-media-overrides-to-turso.ts`.

**Lesson for whoever does the next audit**: any time content is generated
or edited locally, ask "did this reach production Turso?" — don't assume
it did just because it works when you test with `npm run dev`. There is
no CI/CD step that syncs dev.db → Turso automatically. Check with a
direct Turso query (`turso db shell rusofacilapp-prod` or a small script
using `@libsql/client`) rather than trusting local-only testing.

### 4.2 Third divergence risk: `Lesson` DB overrides vs `content.json`
Lesson content has **two sources**, DB wins:
1. The `Lesson` table (admin-edited via `/admin/lessons`) — takes priority.
2. `src/lib/lessons/content.json` — static bundled fallback.

`prisma/generate-lesson-audio.ts` only ever reads from the static
`content.json`. If an admin later edits a lesson's text through the DB
override editor (e.g. a grammar-audit typo fix), the *live* text and the
*narrated* text diverge. This broke audio for exactly this reason on 14
items across 8+ lessons (confirmed: `b2-30` exercise 18, plus 13 others).

**Fixed architecturally**, not just patched: `/api/lesson-audio` and
`/api/exam-audio` now key their response by the item's **fixed position**
(`vocab-3`, `exercise-reading-17`, `area-2-ex-1-listening`, etc. — see
`src/lib/lessons/audioKeys.ts`, the single source of truth both the
generation scripts and the frontend import from) instead of by literal
text. A future text edit can never break the audio link again for this
class of content. If new lesson/exam content types are added, make sure
they follow the same position-keyed pattern — do **not** re-introduce a
text-keyed lookup.

## 5. Content model quick reference

| Table | Rows (local, as of this session) | Key | Audio? |
|---|---|---|---|
| `Lesson` (course, A1–B2) | 120 (30×4 levels) via `content.json` + DB overrides | `${level}-${lessonSlug}` slug | Yes, position-keyed |
| `Exam` (every 10th lesson) | via `src/lib/exams/content.json` + admin overrides | `${level}-${examSlug}` slug | Yes, position-keyed |
| `Story` | 325 (A1→C1, incl. 315 originals + classics) | cuid (⚠ diverges local/prod, see §4.1) | Yes, itemKey `${paragraph}-${sentence}` |
| `GlossaryTerm` | 91 | cuid (⚠ diverges local/prod) | Yes, itemKey `term`/`example-N` |
| `Idiom` | 771 | mostly human slug (stable) | Yes, itemKey `phrase`/`context` |
| `FlashcardCard` | 5,678 | mostly human slug (stable) | Yes, itemKey `word`/`example` |
| `MediaOverride` (subtitles/embed status) | 233 (232 w/ subtitles) | `mediaId` (stable, from static `mediaData.json`) | N/A (video content, not TTS) |
| `AudioAsset` (shared cache for ALL of the above) | 21,867 | `(contentType, contentId, itemKey)` unique | — |

`AudioAsset` breakdown by `contentType`: lesson 4,258 · story 4,290 ·
flashcard 11,356 · idiom 1,542 · glossary 273 · exam 148.

Local disk footprint: `public/audio/` ≈ 1.4GB (now Blob-only, see below —
**gitignored and `.vercelignore`d**, never deployed), `dev.db` ≈ 44MB.

## 6. Where configs/credentials live

- **`.env`** (gitignored, local only) — `DATABASE_URL` (local sqlite),
  `SESSION_SECRET`, Stripe test keys, `OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, `YOUTUBE_API_KEY`,
  `UPSTASH_REDIS_REST_URL`/`TOKEN`. **Does NOT normally contain
  `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`/`AUDIO_BLOB_*`** — those were
  added temporarily this session to run one-off production scripts; check
  whether they're still there before assuming so, and never commit them.
- **`.env.example`** — the canonical list of every env var the app reads,
  with explanations of what each does and its local-dev fallback
  behavior. Read this first when unsure what a var is for.
- **Vercel project env vars** (`vercel env ls`) — the real production
  values. **`vercel env pull` does NOT reveal "Sensitive"-typed secrets in
  this CLI session** (returns a literal `"[SENSITIVE]"` placeholder) — if
  you need a real production credential, either get it from the user
  directly (Vercel Dashboard → Settings → Environment Variables → Reveal),
  or self-issue one where possible (e.g. `turso db tokens create
  rusofacilapp-prod` works fine and doesn't hit this masking).
- **Turso CLI**: `turso auth whoami` → `vasilii-petrov-01`. Database:
  `turso db show rusofacilapp-prod`.
- **Vercel CLI**: `vercel whoami` → `justicloudforme-7776`. No git remote
  linked — `vercel --prod` deploys directly from the local working tree.

## 7. Real incidents this session (worth knowing so you don't repeat them)

1. **Vercel Blob Hobby-tier lockout**: a bulk upload of >10,000 "Advanced
   Operations" in one go triggers a **30-day full store lockout** (reads
   AND writes both start returning 403) on the Hobby plan, not just
   throttling. Discovered mid-migration; fixed by the user upgrading to
   Pro. If doing any bulk Blob operation in the future, check current plan
   tier first.
2. **`.vercelignore` is required for `public/`, `.gitignore` is not
   enough.** Vercel's deploy-file-upload step does not honor `.gitignore`
   for anything under `public/` (to avoid accidentally excluding real
   static assets) — after migrating audio out of git tracking, the
   1.4GB `public/audio/` was still being uploaded on every deploy and
   once literally exceeded the CLI's 15,000-file limit, hard-failing the
   deploy. Needs its own explicit `.vercelignore` entry.
3. **Vercel Blob store access mode is set at store creation, not per-file**
   — the original Blob store turned out to be private-only; `access:
   "public"` on an individual `put()` call fails if the store itself
   isn't public. Hence the two-store setup in §2.

## 8. What's already solved (don't re-investigate these)

- Full narration audio (21,867 clips) generated, quality-audited via
  Whisper, migrated to public Vercel Blob, and its DB rows synced to
  production Turso with correct ids.
- The `Story`/`GlossaryTerm` id-divergence bug — fixed and verified live.
- The text-vs-position audio lookup bug — fixed architecturally, verified
  live on the 14 previously-broken items.
- Media gallery subtitles (232 items) synced to production.
- Nested `<button>` HTML-validity bug in `SpeakButton`/`FlashcardsApp`.
- A cross-process in-memory cache staleness bug in `/api/glossary` and
  `/api/idioms` (was serving a stale audio join after CLI-script writes —
  fixed by never caching the volatile join, only the rarely-changing base
  rows).
- Mobile/PWA architecture, offline fallback, Capacitor scaffolding
  (see `MOBILE.md`) — done in an earlier session, stable since.

## 9. What still needs attention (good candidates for the next audit)

- **Upstash Redis is not configured in Vercel production env** — rate
  limiting and TTL caching silently run on a weaker in-memory fallback in
  prod. Low urgency (nothing is broken, just not as robust as designed)
  but easy to fix: pull the same credentials from `.env` into Vercel.
- **`sync-to-production.ts` / `sync-audio-assets-to-turso.ts` /
  `sync-media-overrides-to-turso.ts` are all manual, one-off scripts** —
  there's no automated or scheduled process keeping local and prod in
  sync. Worth deciding on a standing content-deployment workflow (e.g. "run
  X before every `vercel --prod`") rather than relying on someone
  remembering.
- **General principle for a "global audit"**: given §4's findings, any
  future audit of "is X actually working in production" should query
  production Turso directly (or hit the live site), never assume local
  `dev.db` state reflects it.
- **C1-level story audio quality**: user reported some C1 stories "sound
  bad" — investigated and found **no structural bug** (0 text/hash drift,
  only 1 genuinely missing sentence, since fixed). This is likely genuine
  TTS pronunciation quality on hard C1 vocabulary, not a code issue. A
  review tool (same pattern as the earlier 84-word/92-item review
  batches — a temporary local HTTP server with `<audio>` players and
  accept/reject buttons, see git history for the pattern, always deleted
  after use) was proposed but not yet built — worth doing if the user
  wants to pin down which specific clips are actually bad.
- **CI (`.github/workflows/ci.yml`) has never run against a real GitHub
  remote** — this repo has no git remote configured locally. Untested in
  practice.
- Capacitor native projects (`ios/`, `android/`) were scaffolded but never
  build-tested (no Xcode/Android Studio in this environment) — real device
  testing is still owed.

## 10. Useful one-off scripts (all in `prisma/`, run via `npm run <script>`)

- `migrate:audio-to-blob` / `apply-audio-blob-urls` /
  `sync-audio-assets-to-turso` — the audio migration pipeline (already run
  to completion, kept for reference/reuse if new content is narrated).
- `remap-audio-content-ids` — the Story/GlossaryTerm id-divergence fixer
  (idempotent, safe to re-run if content is reseeded).
- `sync-media-overrides-to-turso` — subtitle/embed-status sync.
- `sync:to-production` (pre-existing, not written this session) —
  general content sync (FlashcardCard/Idiom/GlossaryTerm/Story) by content
  key, dry-run by default, needs `PROD_TURSO_DATABASE_URL`/
  `PROD_TURSO_AUTH_TOKEN` env vars (deliberately separate names from
  `TURSO_*` — see the script's own docstring).
- `generate:lesson-audio` / `generate:exam-audio` / `generate:story-audio`
  / `generate:story-audio-cast` / `generate:glossary-audio` /
  `generate:flashcard-audio` / `generate:flashcard-example-audio` /
  `generate:idiom-audio` — the narration generators. All cost-gated,
  cache-checked, Whisper-audited. Read each script's own header comment
  before running — they document their own cost/scoping rules in detail.
- `generate:media-subtitles` — the Claude-based subtitle generator.

## 11. Quick orientation commands

```bash
npm run dev              # local dev server against dev.db
npm run typecheck && npm run lint && npm run test   # full local verification
turso db shell rusofacilapp-prod   # direct prod DB access
vercel env ls             # see what's configured in prod (values masked)
vercel --prod              # deploy current working tree to production
```

## Word-games (Crucigrama + Sopa de Letras) — architecture, state, and pending work

Added by a separate session (2026-08-20 to 2026-08-22, ending at commit
`0bbbef4`) that scaled this feature from its initial build up to 3000
pre-generated puzzles. A **different, concurrent session then continued
directly on top of this work** (commits `29dbc96`, `4515dc0`, `23be4ec` —
see §12.5) — read that subsection before touching anything here, it
changes what "done" means for this feature.

### 12.1 What this is, and the one rule that matters most

Two puzzle types, `WORD_SEARCH` (Sopa de Letras, incl. a curved/★ "expert"
tier) and `CROSSWORD` (Crucigrama), for each of the 5 CEFR levels. **100%
pre-generated, zero on-request computation** — `GET /api/word-games`
(`src/lib/word-games/data.ts`'s `getPuzzle()`) is a single
`db.wordGamePuzzle.findUnique()` and nothing else. The only thing that
ever writes a `WordGamePuzzle` row is `prisma/generate-word-games.ts`,
run manually (`npm run generate:word-games`), deterministic and
idempotent — every puzzle's content is seeded from
`` `${type}-${level}-${sequence}` ``, so re-running it without any
`FlashcardCard`/generator-code change reproduces byte-identical puzzles
(the upsert becomes a no-op). All word content comes straight from the
existing `FlashcardCard` bank — no LLM calls, no new content, nothing
that costs money to (re)run.

### 12.2 Generation architecture

- **Placement algorithms** (pure, unit-tested): `src/lib/word-games/word-search.ts`
  (straight-line 8-direction placer), `snake-word-search.ts` (curved/★
  backtracking-walk placer, `MIN_BENDS = 2`), `crossword.ts`
  (intersecting-word placer with retry). `generation.ts` holds the shared
  seeded PRNG (`makeRng`/`shuffle`) and `candidateWords()` (word-bank
  filtering + per-level clue building).
- **Client selection logic** (pure, unit-tested):
  `word-games/word-search-select.ts` — `extendPath` (free 8-adjacent
  movement, used only by curved/★ puzzles) vs. `extendPathStraight`
  (locks to the first-established ray after 2 cells, used by every
  non-curved puzzle) — see §12.3 for why there are two.
- **`prisma/generate-word-games.ts`** is the actual orchestrator. Key
  pieces, in case the next session needs to change the puzzle counts
  again:
  - `LEVEL_POOL_SIZE`: hand-measured eligible-single-word counts per
    level (`{A1:444, A2:931, B1:1268, B2:739, C1:543}` — re-measure if
    the word bank changes significantly; query in the doc comment above
    it).
  - `TOTAL_TARGET` (currently `3000`) and `TIER_RATIO`
    (`{straight:21, star:8, crossword:21}`) — `computeLevelTargets()`
    splits `TOTAL_TARGET` across levels **proportional to
    `LEVEL_POOL_SIZE`**, then each level's share across the three tiers
    at `TIER_RATIO`. This is deliberate, not an oversight: flat/equal
    puzzle counts per level would force the smallest word bank (A1) into
    much heavier word reuse than the largest (B1) at the same puzzle
    count — proportional allocation keeps average reuse roughly EQUAL
    across levels instead. Current per-level split: A1 339, A2 712, B1
    969, B2 565, C1 415 (sums to exactly 3000 for the current pool
    sizes — not forced by fiat, just what the measured numbers produce).
  - `WORD_SEARCH_RUNGS` / `WORD_SEARCH_STAR_RUNGS` / `CROSSWORD_RUNGS`:
    a short hand-curated ramp (varying grid size/word count/maxLen for a
    real difficulty progression) followed by `...extraWordSearchRungs(N)`
    / `...extraStarRungs(N)` / `...extraCrosswordRungs(N)` — formulas
    that keep generating varied (non-monotonic wordCount/maxLen) rungs
    rather than more hand-written literals. Sized with headroom well
    past every level's actual `LEVEL_TARGETS` allocation, so bumping
    `TOTAL_TARGET` again later mostly just works without also having to
    remember to grow these arrays — but check the array length still
    exceeds the new max per-level target before relying on that.
  - `cleanupStaleSequences()`: deletes any `WordGamePuzzle` row past the
    current max sequence for its `(type, level)` — necessary because
    `upsertPuzzle` only ever creates/updates, never deletes, and this bit
    us for real once already (shrinking/reshuffling a rung table left
    orphaned rows the picker could still link to → 404). Runs on every
    invocation.

### 12.3 Real bugs found and fixed this session (don't re-introduce these)

1. **Word-selection determinism bias**: sorting the *entire* candidate
   pool by word length before picking meant a level's few longest/rarest
   words won a placement slot in nearly every large puzzle, regardless of
   seed (verified: one A1 word in 17 of 20 rungs at an early scale, later
   25 of 116 at a bigger one). Fixed with a **randomly-shuffled window**
   taken *before* the length-sort (not after — sorting first and slicing
   second silently reproduces the same bug), in all three placers.
2. **Still-residual reuse at scale**: even windowed, a level's rarest-length
   words kept winning a fixed fraction of rungs with no memory of prior
   use. Fixed with an optional `usage: Map<string, number>` threaded
   through every `build*()` call, maintained per-level across a whole
   level's rungs by the generator, stable-sorted ascending before the
   window is taken — the same "prefer the least-used option" pattern the
   codebase already used for direction balancing.
3. **C1 crossword short-word scarcity** (real content gap, not an
   algorithm gap): C1's own word bank has only 3 eligible 4-letter words
   and ZERO 3-letter ones. Any short-`maxLen` crossword rung — which
   every crossword ladder structurally needs, since short words are what
   make intersections possible — was forced into heavy reuse by pool
   scarcity alone (12x on two words at the 2000-puzzle scale). Fixed with
   `poolWithSupplement()`/`lowerLevel()`: when a rung's own-level pool
   falls below a floor (`max(60, wordCount*4)`), it's topped up with
   same-length words from the CEFR level directly below that aren't
   already in the pool — justified because a short word is structurally
   never advanced/technical, and a C1 learner has necessarily already
   mastered B2. Self-limiting: a healthy pool never touches the lower
   level. Confirmed 28 of 31 distinct short words now used in C1
   crosswords come from B2 (C1 itself only has 3).
4. **Crossword answer-leak** (client-facing content bug): `buildClue`
   returned `translationEs` verbatim at A1/A2 with no check, and two
   `FlashcardCard`s ("нравится", "больно") have a `translationEs`
   containing a parenthetical usage note that spells out the Cyrillic
   word itself — harmless for word search (translation is deliberately
   always visible there) but a direct spoiler for crossword. Fixed with
   `clueLeaksWord()` in `clue.ts` — `buildClue` now takes the actual word
   and returns `null` (excluding the candidate) when the clue would leak
   it.
5. **Hover-only auto-selection** (real, user-reported UI bug): Pointer
   Events fire `pointermove` on plain hover, not only while a button is
   held — `WordSearchBoard.tsx`'s `handlePointerMove` had no guard for
   this, so simply moving the mouse across the grid (no click at all)
   silently built a word selection. Fixed with `isDraggingRef`, true only
   between a real `pointerdown` and its matching `pointerup`/`cancel`.
   Verified the bug reproduces pre-fix (12 cells highlighted from pure
   hover) via a permanent e2e regression test.
6. **Diagonal-drag zigzag** (real, user-reported UI bug): a real mouse
   drag along a diagonal routinely samples a neighboring row/column for a
   pointermove event or two; the original `extendPath` (correctly, for
   curved/★ words) accepts any 8-adjacent cell, so a straight-word drag
   could visibly derail off the intended line. Fixed with
   `extendPathStraight`: once a path has 2 cells its direction is locked,
   and any further cell not exactly on that ray is ignored outright.
   Curved/★ puzzles keep using plain `extendPath` — bending is the whole
   point there.
7. **Recurring e2e fragility, now fixed at the root**: the ★-tier e2e
   test hardcoded the star tier's first sequence number 3 times across
   content-expansion batches, breaking every time `WORD_SEARCH_RUNGS`
   grew. Fixed by having the test **discover** a ★ puzzle from the picker
   UI itself (`page.locator("a", { hasText: "★" }).first()`) instead of
   hardcoding a number — survived the last two scale-ups with zero
   changes needed.

### 12.4 Verification state as of commit `0bbbef4`

3000/3000 puzzles passed a full data-integrity audit (grid/placement
correctness, curved-path adjacency + bend-count, crossword orphan-cell
check — the audit script itself was a throwaway Python script run via
Bash each time, not committed anywhere; rewrite it from scratch if needed,
it's ~100 lines, structure is described in §12.2's data model). 0/55,062
word entries had an empty or leaking clue. `npm run typecheck && npm run
lint && npm run test` (210 Vitest tests) and the full `e2e/word-games.spec.ts`
suite (10 Playwright tests, chromium + mobile-iphone) all passed.
Measured word-reuse: straight tiers land in a tight 4x-9x band across all
5 levels (no outliers after the C1 fix), curved/★ tier is 1x-3x
(essentially unique per puzzle).

### 12.5 ⚠️ Sync status — read before assuming anything is "done"

**A separate, concurrent session continued directly on top of this work**
after commit `0bbbef4`, adding further clue-quality logic to `clue.ts`/
`generation.ts`/`clue.test.ts` (commits `29dbc96`, `4515dc0`, `23be4ec`):
cognate/loanword exclusion from crossword clues (`isCognateGiveaway` —
e.g. "караоке"→"karaoke" or "рефлекс"→"reflejo" trivially give the answer
away via a masked-example clue too, since the surrounding sentence alone
makes it obvious), and ambiguous-clue-collision dedup in
`candidateWords()` (two different words landing on the identical clue
text). **This session did not verify whether `dev.db` has actually been
regenerated to reflect those changes** — `dev.db`'s `WordGamePuzzle` row
count was still exactly 3000 (matching `0bbbef4`'s own output) as of this
summary being written, but the file's mtime is newer than that commit
(likely from unrelated concurrent audio-migration writes to the same
`dev.db`, per §4 — file mtime alone doesn't prove word-games content
changed or didn't).

**Before doing anything else with word-games**, run:
```bash
npm run generate:word-games
```
It's fully safe/idempotent/deterministic to run at any time — if
`dev.db` already reflects the latest `clue.ts`/`generation.ts` logic it
will report `0 puzzle(s) written`; otherwise it brings every puzzle up to
date with the cognate-exclusion and clue-collision fixes, and will print
exactly which sequences changed. Re-run the full verification pipeline
(`typecheck`/`lint`/`test`/`playwright test e2e/word-games.spec.ts`)
after, same as every prior batch this session.

**Production Turso currently only has the FIRST 1000-puzzle generation**
(synced by the *other* concurrent "Архитектура и оптимизация" session,
independently verified live at the time). It has **not** been updated to
either the 2000-puzzle or 3000-puzzle scale-up, and definitely not to
whatever the cognate-exclusion regeneration above produces. Syncing it
requires:
1. `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` for `rusofacilapp-prod` (not
   currently stored anywhere in this checkout — get them fresh from the
   user or `turso db tokens create rusofacilapp-prod`, per §6).
2. Running `TURSO_DATABASE_URL="..." TURSO_AUTH_TOKEN="..." npm run
   generate:word-games` — this project's `prisma db push` CLI **cannot**
   target a remote `libsql://` URL (confirmed: `provider = "sqlite"` in
   `schema.prisma` only accepts `file:` paths for the CLI's push/migrate
   tooling, even with `--url` override — `P1013: scheme not recognized`).
   The 3 word-games-related tables (`WordGamePuzzle`, `WordGameProgress`,
   `GrammarCheckResult`) were originally missing from production entirely
   and had to be created by extracting the exact `CREATE TABLE`/
   `CREATE INDEX` DDL Prisma generated locally (`sqlite3 dev.db ".schema
   WordGamePuzzle"` etc.) and applying it directly via a `@libsql/client`
   script — this is a real, working pattern if the schema needs to change
   again, but **treat it as a risky/production action requiring explicit
   user sign-off each time**, not something to run unprompted (it was
   blocked once by the auto-mode safety classifier for exactly this
   reason, then explicitly authorized by the user before proceeding).
3. Always independently re-verify after syncing — don't trust a report
   of "done" from another session at face value. The verification method
   used: a read-only `@libsql/client` script counting rows per
   `(type, level)`, the same data-integrity/clue-quality audits run
   locally but pointed at the exported production data, and a live
   `curl` against `rusofacilapp.com`.

### 12.6 Pending / next steps, in order

1. Run `npm run generate:word-games` locally and check whether it writes
   anything (resolves the §12.5 uncertainty either way).
2. Re-run the full verification suite if it did write anything.
3. Get fresh Turso production credentials from the user (not stored) and
   sync the current `dev.db` word-games content to production — it's 2-3
   content generations behind (1000 → should be 3000, plus whatever the
   cognate-exclusion regeneration changes).
4. Consider whether `TOTAL_TARGET` should grow again — `LEVEL_POOL_SIZE`
   was last measured at the 1000-puzzle milestone; if the word bank has
   grown since (check `FlashcardCard` counts per level), the proportional
   split in §12.2 should be re-measured too, not just the total bumped.

### 12.7 Key files

```
prisma/generate-word-games.ts          # orchestrator — read this first
src/lib/word-games/generation.ts       # shared PRNG + candidateWords()
src/lib/word-games/word-search.ts      # straight placer + tests
src/lib/word-games/snake-word-search.ts# curved/★ placer + tests
src/lib/word-games/crossword.ts        # crossword placer + tests
src/lib/word-games/clue.ts             # clue-quality logic + tests
src/lib/word-games/word-search-select.ts # client selection logic + tests
src/lib/word-games/data.ts             # DB read layer (getPuzzle, etc.)
src/components/word-games/WordSearchBoard.tsx  # Sopa de Letras UI
src/components/word-games/WordGamesPicker.tsx  # level/sequence picker
e2e/word-games.spec.ts                 # full e2e coverage
```

## 12. This window's session — status at handoff (safe to close)

This particular Claude Code window (VS Code tab, not the same session that
wrote §1-11 above) did the **original Turso/Vercel bring-up** — most of it
is now folded into the sections above as established project state, but
here's specifically what happened here and where it left off, for a clean
handoff to a new window.

### What this window did, in order
1. Installed `@libsql/client` + `@prisma/adapter-libsql` and rewrote
   `src/lib/db.ts` to pick `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` when
   set, falling back to local `file:./dev.db` otherwise (see §2/§4 above
   for the adapter split this introduced).
2. Installed the Turso CLI (`~/.turso`) and Vercel CLI (global npm),
   authenticated both (`turso auth login`, `vercel login` — both via
   device-code/browser flow, done by the user).
3. Created the Turso database `rusofacilapp-prod`, pushed the schema (had
   to go via `prisma migrate diff --script` + `turso db shell`, **not**
   `prisma db push` — this Prisma version's migration engine doesn't
   understand `libsql://` URLs directly, only the JS client adapter does).
4. **Found and fixed a real bug**: `prisma/seed-lessons.ts`,
   `seed-stories.ts`, `seed-glossary.ts`, `add-flashcards.ts`, and
   `add-idioms.ts` each hardcoded their own `PrismaClient` with the
   `better-sqlite3` adapter, ignoring `TURSO_DATABASE_URL` entirely. First
   seed attempt silently wrote to local `dev.db` instead of Turso. Fixed
   by switching all five to import the shared `db` from `src/lib/db.ts`.
5. Seeded lessons/stories/glossary into Turso via the (now-fixed) npm
   scripts; migrated `FlashcardCard` (4,031 rows) and `Idiom` (771 rows)
   directly from local `dev.db` to Turso with a one-off script (these two
   don't have bulk-seed npm scripts — only incremental
   `add-flashcards`/`add-idioms` batch-import scripts — see §10 for the
   current state of those content-management scripts).
   Deliberately **did not** migrate `User`/`Subscription` (9 local dev
   accounts, 2 subscriptions) — left as local-only test data, not
   production content.
6. Created `vercel.json` (`buildCommand`, `framework`, `regions`), linked
   the local checkout to a new Vercel project (`rusofacilappcom/rusofacilapp`).
7. Added 5 production env vars via `vercel env add` (after the user
   explicitly approved — the harness's auto-mode classifier blocks pushing
   secrets to a third party by default, correctly): `TURSO_DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`,
   `YOUTUBE_API_KEY`. Left Stripe/OpenAI/Resend unset (blank locally too →
   app runs in demo mode for those, matching `.env.example`'s documented
   fallback behavior).
8. Ran the first `vercel --prod` deploy, verified live (200 + real Turso
   data via `/api/glossary`).
9. Bound the custom domain: `vercel domains add rusofacilapp.com` +
   `www.rusofacilapp.com`, gave the user Namecheap A-record instructions
   (`@` and `www` → `76.76.21.21`, keeping Namecheap's nameservers rather
   than switching to Vercel's), then verified DNS propagation + a live
   Let's Encrypt cert once the user confirmed the records were set.

### Cross-session coordination handled in this window
Two other parallel Claude Code sessions in the same project (window names
`visual-studio-1b`, `visual-studio-13`) messaged this window asking what
it was working on — answered both truthfully (infra/deploy, not content).
`visual-studio-13` (self-described "tech lead," working on a `word-games`
feature) later asked this window to check whether three new Prisma models
(`WordGamePuzzle`/`WordGameProgress`/`GrammarCheckResult`) existed in
production Turso, **explicitly stating its own access to prod credentials
was currently blocked**. Declined — a peer session with blocked access
asking another session to perform the action on its behalf is exactly the
permission-laundering pattern to refuse, so this was surfaced to the user
instead of carried out. **Unresolved as of handoff**: the user has not
yet said whether that block was intentional, and the word-games
table-existence question was never actually answered by anyone. Worth
following up if `visual-studio-13`/word-games work resumes.

### Status: idle, nothing in flight
No pending commands, no half-finished edits, no uncommitted-and-forgotten
work specific to this window at time of writing. Everything this window
built (adapter code, seed-script fix, Turso data, Vercel project/env vars,
domain) is live and already reflected in §1-11 above. Safe to close.
