// Run the rendered-surface check against a freshly built production server,
// as part of `npm run verify` — the gate that runs before a merge.
//
// Why it belongs there. lint, typecheck and 465 unit tests were all green
// for the ten days every lesson page on production rendered nothing but
// "Something went wrong" (incident №1). None of them opens a browser, and
// none of them could have: the failure was a regex that only throws under
// the `u` flag, built at runtime from database content, inside a client
// component. The only check that can see that class is one that renders the
// page. So it has to run automatically, not when someone remembers to.
//
// Starts `next start` on its own port, waits for it to answer, runs the
// check with its positive control, and stops the server whatever happens.
//
// "Stops the server" is harder than it looks, and getting it wrong cost a
// CI run 56 minutes on 29.08.2026. The check itself finished in a second —
// 17 families ok, control 2/2, 0 problems — and then the step simply never
// returned, so "Upload Playwright report" and "Post Run" never started.
//
// Reproduced and measured rather than guessed. The old code did
// `spawn("npx", ["next", "start", …])` and `child.kill("SIGKILL")`. That
// kills npx, not the server npx started: after the kill the grandchild was
// still alive with PPID 1, still answering 200 on the port, and this
// process still held two open Socket handles — the stdout/stderr pipes the
// grandchild had inherited. Node cannot exit while those are open, so the
// step hung forever.
//
// Three changes, each pulling in the same direction:
//   1. spawn the local `next` binary directly, one process layer fewer
//   2. `detached: true` makes the child a process-group leader, so
//      `process.kill(-pid)` reaches every process it started
//   3. exit explicitly with the check's status instead of waiting for the
//      event loop to drain, and destroy the pipes first
// The third alone would have fixed the hang; the first two are what
// actually stop the server, which is the part that matters on a machine
// that keeps running afterwards.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Deliberately not 3000/3100/3111: those are dev, the e2e webServer, and the
// port used for manual probing. A verify run must not adopt whatever server
// happens to be listening there and report on the wrong build.
const PORT = 3123;
const BASE = `http://localhost:${PORT}`;

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/es`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

/** Kill the child AND everything it started, then let go of its pipes. */
function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  // Negative pid = the whole process group, which is why the child is
  // spawned detached. SIGTERM first so Next can close its listener; SIGKILL
  // straight after, because a graceful shutdown is not worth waiting on
  // here and a lingering listener is exactly what we are preventing.
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    try {
      process.kill(-server.pid, signal);
    } catch {
      // Already gone, or no such group — either way there is nothing to kill.
    }
  }
  // The pipes are what kept the event loop alive after the old kill.
  for (const stream of [server.stdout, server.stderr]) {
    try {
      stream?.destroy();
    } catch {
      // nothing to do
    }
  }
}

async function main() {
  // The local binary, not npx: one fewer process between us and the server.
  const nextBin = join(process.cwd(), "node_modules", ".bin", "next");
  if (!existsSync(nextBin)) {
    console.error(`cannot find ${nextBin} — run npm ci first`);
    return 1;
  }
  const server = spawn(nextBin, ["start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
    // Its own process group, so one kill reaches every process it forks.
    detached: true,
  });
  let serverLog = "";
  server.stdout.on("data", (d) => { serverLog += d.toString(); });
  server.stderr.on("data", (d) => { serverLog += d.toString(); });

  const stop = () => stopServer(server);
  // Covers a cancelled run too: a killed step must not leave a server behind.
  process.on("exit", stop);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => { stop(); process.exit(130); });
  }

  try {
    if (!(await waitForServer())) {
      console.error(`could not start next start on ${PORT}. Server output:\n${serverLog.slice(-800)}`);
      return 1;
    }
    // --control is not optional here. A gate that cannot demonstrate it
    // finds a broken render is a gate that passes everything.
    // --ci is passed straight through: it drops the content-count
    // assertions, which CI's empty database cannot satisfy, and keeps
    // everything that identifies a broken render.
    const passthrough = process.argv.slice(2).filter((a) => a === "--ci");
    const run = spawnSync(
      process.execPath,
      ["scripts/check-rendered-surface.mjs", `--base=${BASE}`, "--control", ...passthrough],
      { stdio: "inherit" }
    );
    // Layout runs on the SAME server, in the same step, and both statuses
    // are reported. Rendered-surface answers "is the page there"; this one
    // answers "is it the right shape" — two defects found on production
    // 29.08.2026 (a see-through sticky header, a footer row 428px wide in a
    // 320px viewport) were invisible to the first check and are exactly
    // what the second measures. Running it second and not short-circuiting
    // means one verify run names every problem it can see, rather than
    // hiding the layout ones behind a content failure.
    const layout = spawnSync(
      process.execPath,
      ["scripts/check-layout-geometry.mjs", `--base=${BASE}`, "--control", ...passthrough],
      { stdio: "inherit" }
    );
    return (run.status ?? 1) || (layout.status ?? 1);
  } finally {
    stop();
  }
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => {
      // Explicit exit, not a drained event loop. This is the belt to the
      // process-group kill's braces: even if some handle outlives the
      // server, the step still ends and CI moves on.
      process.exit(code);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
