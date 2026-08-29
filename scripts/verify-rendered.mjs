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
import { spawn, spawnSync } from "node:child_process";
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

async function main() {
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  let serverLog = "";
  server.stdout.on("data", (d) => { serverLog += d.toString(); });
  server.stderr.on("data", (d) => { serverLog += d.toString(); });

  const stop = () => { if (!server.killed) server.kill("SIGKILL"); };
  process.on("exit", stop);

  try {
    if (!(await waitForServer())) {
      console.error(`could not start next start on ${PORT}. Server output:\n${serverLog.slice(-800)}`);
      process.exitCode = 1;
      return;
    }
    // --control is not optional here. A gate that cannot demonstrate it
    // finds a broken render is a gate that passes everything.
    const run = spawnSync(
      process.execPath,
      ["scripts/check-rendered-surface.mjs", `--base=${BASE}`, "--control"],
      { stdio: "inherit" }
    );
    process.exitCode = run.status ?? 1;
  } finally {
    stop();
  }
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
