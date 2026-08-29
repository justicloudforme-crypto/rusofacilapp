// The 330 frozen URLs must not change until 25.09.2026.
//
// They are the measured variable of the "body for thin pages" experiment
// (65 stories + 100 songs, both locales). If the freeze is broken, the
// experiment's readout on 25.09 is worthless — and it has to be found now,
// not then.
//
// Production against production, across a deploy boundary. Comparing a local
// build against production does NOT work and was tried: the local dev.db
// does not contain those story rows, so every page differed and the run
// reported "30 of 30 changed" — a number about the two databases, not about
// the deploy (PROGRESS.md 2.1).
//
//   node scripts/check-frozen-delta.mjs --baseline=<file.json>
//
// The baseline is a capture of the same 330 URLs taken on production BEFORE
// the deploy under test: [{url, status, title, description, canonical, h1}, …].
// There is no capture mode here on purpose — the frozen set is defined by
// which URLs the baseline lists, so a capture with no baseline would have to
// guess it, and guessing which pages are frozen is exactly the mistake this
// check exists to catch.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASELINE = arg("baseline", "");
const CONCURRENCY = Number(arg("concurrency", "8"));

const FIELDS = ["title", "description", "canonical", "h1"];

// Attribute matching is case-insensitive (PROGRESS.md 4.2) and entities are
// decoded before any comparison or length (4.3).
const decode = (s) =>
  s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–");
const pick = (html, re) => decode((html.match(re)?.[1] ?? "").replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

function fieldsOf(html) {
  return {
    title: pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    description: pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
    canonical: pick(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i),
    h1: pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
  };
}

async function capture(urls) {
  const out = [];
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
        try {
          const res = await fetch(url, { redirect: "manual" });
          const html = res.status === 200 ? await res.text() : "";
          out.push({ url, status: res.status, ...fieldsOf(html) });
        } catch (error) {
          out.push({ url, status: 0, title: "", description: "", canonical: "", h1: "", error: String(error).slice(0, 60) });
        }
      }
    })
  );
  return out;
}

function compare(base, now) {
  const byUrl = new Map(now.map((r) => [r.url, r]));
  const changed = Object.fromEntries(FIELDS.map((f) => [f, []]));
  const statusChanged = [];
  let compared = 0;
  for (const b of base) {
    const n = byUrl.get(b.url);
    if (!n) continue;
    compared++;
    if (b.status !== n.status) statusChanged.push(`${b.url} ${b.status} → ${n.status}`);
    for (const f of FIELDS) if (b[f] !== n[f]) changed[f].push(b.url);
  }
  return { changed, statusChanged, compared };
}

async function main() {
  if (!BASELINE) {
    console.log("give --baseline=<file.json> — a production capture from before the deploy");
    process.exitCode = 1;
    return;
  }

  const base = JSON.parse(readFileSync(BASELINE, "utf8"));
  console.log(`baseline: ${BASELINE}`);
  console.log(`frozen URLs in it: ${base.length}`);
  if (base.length !== 330) console.log(`  NOTE: expected 330 frozen URLs (165 pages x 2 locales), got ${base.length}`);

  const now = await capture(base.map((r) => r.url));
  const { changed, statusChanged, compared } = compare(base, now);

  console.log(`\n--- frozen: production now vs production at the baseline (must be 0) ---`);
  for (const f of FIELDS) {
    console.log(`    ${f.padEnd(12)}: ${changed[f].length} changed${changed[f].length ? " → " + changed[f].slice(0, 3).join(", ") : ""}`);
  }
  console.log(`    status      : ${statusChanged.length} changed${statusChanged.length ? " → " + statusChanged.slice(0, 3).join(", ") : ""}`);
  console.log(`    non-200 now : ${now.filter((r) => r.status !== 200).length}`);
  console.log(`    compared    : ${compared}/${base.length}`);

  // A zero has to earn belief. Plant one change per field into a copy of the
  // fresh capture and require the comparison to report exactly those.
  console.log(`\n--- control: planted changes must be found ---`);
  const planted = now.map((r) => ({ ...r }));
  const targets = {};
  FIELDS.forEach((f, i) => {
    const victim = planted[i % planted.length];
    targets[f] = victim.url;
    victim[f] = `PLANTED-${f}`;
  });
  const controlResult = compare(base, planted);
  let caught = 0;
  for (const f of FIELDS) {
    const found = controlResult.changed[f].includes(targets[f]);
    caught += found ? 1 : 0;
    console.log(`    ${f.padEnd(12)}: ${found ? "caught" : "MISSED"}  ${targets[f].replace("https://rusofacilapp.com", "")}`);
  }
  // And a status change must be visible too.
  const statusVictim = planted[0];
  statusVictim.status = 404;
  const statusCaught = compare(base, planted).statusChanged.length > 0;
  console.log(`    ${"status".padEnd(12)}: ${statusCaught ? "caught" : "MISSED"}`);
  console.log(`    planted ${FIELDS.length + 1}, caught ${caught + (statusCaught ? 1 : 0)}`);

  const controlOk = caught === FIELDS.length && statusCaught;
  const clean = FIELDS.every((f) => changed[f].length === 0) && statusChanged.length === 0 && compared === base.length;
  console.log(clean && controlOk ? "\nPASS — freeze intact" : "\nFAIL");
  process.exitCode = clean && controlOk ? 0 : 1;
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
