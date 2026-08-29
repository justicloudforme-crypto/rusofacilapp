import { pathToFileURL } from "node:url";

/**
 * True only when this module's file is the one Node was asked to run.
 *
 * Why every CLI script in prisma/ and scripts/ needs it. Those files each
 * ended with a bare `main()` at the top level, so *importing* one ran it —
 * connecting to whatever database the environment pointed at, and in many
 * cases writing to it or calling a paid API. That is not hypothetical: on
 * 29.08.2026 a read-only audit script imported prisma/ensure-schema-sync.ts
 * for its schema parser and the production schema migrator ran, announcing
 * itself in the output. `src/lib/schema-sync.test.ts` imports the same
 * module, so `npm run test` in a shell that happened to carry
 * TURSO_DATABASE_URL would have pointed that migrator at production too.
 *
 * A survey then found the same shape in 53 of the 58 files under prisma/
 * and scripts/, none of them guarded. Only one other was actually imported
 * anywhere (scripts/experiment-readout.ts, by its own test), but "only one
 * is reachable today" is a property of today's import graph, not of the
 * code — and adding one import is all it takes to change it.
 *
 * This is the same principle as VERCEL_ENV vs NODE_ENV in
 * deploy-environment.ts: the signal has to be something a bystander cannot
 * satisfy by accident. `NODE_ENV=production` is set by `next build`,
 * `next start` and every e2e run, so it cannot tell a deploy from a laptop.
 * Being the process entry point cannot be satisfied by an import, ever.
 *
 * Usage, at the bottom of a script:
 *
 *     if (isEntryPoint(import.meta.url)) {
 *       main().catch(...)
 *     }
 *
 * `import.meta.url` is passed in rather than read here, because inside this
 * module it would always be this module's own path.
 */
export function isEntryPoint(importMetaUrl: string): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return importMetaUrl === pathToFileURL(argv1).href;
  } catch {
    // argv[1] is not a resolvable path (some runners pass a flag there).
    // Refusing to run is the safe answer: a script that does not execute
    // is recoverable, one that writes to production by accident is not.
    return false;
  }
}
