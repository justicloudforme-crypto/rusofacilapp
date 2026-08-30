import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * A second, separate Vitest project for SCENARIO runs: whole sequences of
 * real events replayed against a real (throwaway, local) database, as
 * opposed to `npm run test`, which mocks the database away entirely.
 *
 * It is a separate config on purpose, and the separation is load-bearing.
 * `npm run test` is guaranteed to open no database connection at all —
 * `npm run check:no-db-in-tests` proves that by pointing all five
 * credential variables at a socket it owns and watching nothing connect
 * (PROGRESS.md 7.32). A scenario needs the opposite: a real Prisma client
 * writing real rows, because the thing under test is what a sequence of
 * webhook deliveries LEAVES BEHIND, which a mocked writer cannot answer.
 * Keeping the two in one config would mean either weakening that guarantee
 * or never writing a scenario.
 *
 * The include glob below and `npm run test`'s (`src/**\/*.test.ts`) do not
 * overlap, so neither runner can pick up the other's files.
 *
 * Every scenario file is responsible for pointing the database at a
 * temporary file of its own BEFORE importing anything from src/ — see
 * scripts/scenarios/subscription-lifecycle.scenario.ts.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/scenarios/**/*.scenario.ts"],
    // A scenario replays a sequence and prints a table; the default 5s is
    // not enough for the first run, which also builds the schema.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // The printed step-by-step table IS the result here — an assertion
    // that says "premium" does not show which step it survived. Vitest
    // buffers console output through its reporter by default and drops it
    // for passing tests; this sends it straight to stdout.
    disableConsoleIntercept: true,
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "server-only": path.resolve(dirname, "./vitest.stubs/server-only.ts"),
    },
  },
});
