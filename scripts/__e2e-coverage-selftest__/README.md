Fixtures for `node scripts/check-e2e-coverage.mjs --self-test`.

They exist so the check can be shown to fail before its "0 problems" is
believed — the rule in PROGRESS.md 4.1. They are never collected by
Playwright (they live under `scripts/`, not `e2e/`) and never by Vitest
(which only includes `src/**/*.test.{ts,tsx}`).
