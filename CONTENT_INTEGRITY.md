# Content integrity: protecting reviewed translations from batch overwrite

## The incident this prevents

`prisma/seed-stories.ts` matches rows by `(title, author)` and unconditionally
calls `db.story.update()` on every re-run. If `prisma/stories-data.ts` is
regenerated (e.g. by an AI translation pass) and the seed script is run again,
any manual correction made directly on a previously-seeded row — through
`/admin` — is silently replaced. The same shape of risk exists in
`prisma/seed-glossary.ts`, which upserts by slug.

Neither script has any way to tell "content nobody has reviewed since it was
last (re)generated" apart from "content a human already checked and fixed."

## The mechanism

`Story.reviewedAt` and `GlossaryTerm.reviewedAt` (both `DateTime?`, both
`null` until touched) are stamped with the current time by the `/admin` save
routes (`src/app/api/admin/stories/save`, `src/app/api/admin/glossary/save`)
every time a staff member saves that row through the editor. A staff save
*is* the human-review event — there's no separate "mark as reviewed" toggle
to remember to set.

`seed-stories.ts` and `seed-glossary.ts` check `reviewedAt` before
overwriting an existing row:

- `reviewedAt` is `null` → the row has only ever been written by a seed
  script, safe to overwrite with fresh batch content.
- `reviewedAt` is set → a human edited this row directly; the script skips
  it and logs a warning instead of overwriting.
- Pass `--force` (`npm run db:seed-stories -- --force`,
  `npm run db:seed-glossary -- --force`) to overwrite reviewed rows anyway —
  for a deliberate bulk correction you know supersedes prior manual edits.

## What this does not cover

- `prisma/add-flashcards.ts` / `prisma/add-idioms.ts` are create-only today
  (no `.update()` call), so they carry no overwrite risk yet. If either ever
  grows an update/upsert path, it should get the same `reviewedAt` treatment
  — `FlashcardCard`/`Idiom` don't have the column yet because nothing writes
  over them today.
- This protects against *batch scripts* overwriting *reviewed* rows. It does
  not protect against a human saving bad content through `/admin` itself —
  that stamps `reviewedAt` just the same, by design (the admin editor is the
  trusted path).
- The daily full-DB backup (`src/lib/backup.ts`, Vercel Blob, 14-day
  retention) remains the last line of defense for anything this doesn't
  catch — a whole-database snapshot, not per-row versioning.
