/**
 * Reads out the "тело тонким страницам" experiment from four Search Console
 * CSV exports. Everything about WHY — periods, how to produce the exports,
 * the pre-registered threshold, what to do with each verdict — is in
 * docs/experiment-readout-2026-09-25.md. The arithmetic is in
 * src/lib/experiment-readout.ts, where the unit suite can reach it. This
 * file is only the command line.
 *
 *   npx tsx scripts/experiment-readout.ts <dir-with-the-four-csv-files>
 *
 * Expected in that directory:
 *   stories-base.csv  stories-read.csv  media-base.csv  media-read.csv
 *
 * Touches nothing but those files and docs/experiment-groups-2026-08-28.json
 * — no database, no network, no credentials.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SUCCESS_EFFECT,
  actionFor,
  parseGscCsv,
  readout,
  type GroupTotals,
  type Readout,
} from "../src/lib/experiment-readout";

type Groups = {
  storyPilot: string[];
  storyControl: string[];
  mediaPilot: string[];
  mediaControl: string[];
};

function fmt(n: number, digits = 2): string {
  return Number.isFinite(n) ? n.toFixed(digits) : String(n);
}

function print(name: string, result: Readout): void {
  console.log(`\n=== ${name} ===`);
  console.log("                       pages  with data   impressions  per page   avg position");
  const rows: [string, GroupTotals][] = [
    ["pilot,   baseline", result.pilotBase],
    ["pilot,   readout ", result.pilotRead],
    ["control, baseline", result.controlBase],
    ["control, readout ", result.controlRead],
  ];
  for (const [label, t] of rows) {
    console.log(
      `  ${label}  ${String(t.pagesInGroup).padStart(4)}  ${String(t.pagesWithData).padStart(8)}  ` +
        `${String(t.impressions).padStart(12)}  ${fmt(t.perPage).padStart(8)}  ${fmt(t.position).padStart(12)}`,
    );
  }
  console.log(`\n  growth, pilot   R = ${fmt(result.growthPilot)}`);
  console.log(`  growth, control R = ${fmt(result.growthControl)}`);
  console.log(`  EFFECT  R_pilot / R_control = ${fmt(result.effect)}   (threshold ${SUCCESS_EFFECT})`);
  console.log(
    `  position shift: pilot ${fmt(result.positionShiftPilot)}, control ${fmt(result.positionShiftControl)}, ` +
      `difference ${fmt(result.positionSupport)} (negative = pilot improved more)`,
  );
  console.log(`\n  VERDICT: ${result.verdict}`);
  console.log(`  ACTION : ${actionFor(result)}`);
}

function main(): void {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: npx tsx scripts/experiment-readout.ts <dir-with-the-four-csv-files>");
    console.error("see docs/experiment-readout-2026-09-25.md for how to produce them");
    process.exit(1);
  }

  const groups = JSON.parse(
    readFileSync(join(process.cwd(), "docs", "experiment-groups-2026-08-28.json"), "utf8"),
  ) as Groups;
  console.log(
    `groups: stories ${groups.storyPilot.length}/${groups.storyControl.length}, ` +
      `media ${groups.mediaPilot.length}/${groups.mediaControl.length} (pilot/control)`,
  );

  const read = (file: string) => parseGscCsv(readFileSync(join(dir, file), "utf8"));

  print("STORIES", readout(read("stories-base.csv"), read("stories-read.csv"), groups.storyPilot, groups.storyControl));
  print("MEDIA (songs)", readout(read("media-base.csv"), read("media-read.csv"), groups.mediaPilot, groups.mediaControl));

  console.log(
    "\nWhen writing this up: the media CONTROL is not fully untouched — PR #57 widened\n" +
      "the grammar-link source for every media item (median 1097 -> 1113 chars). The\n" +
      "stories control is untouched. See docs/experiment-readout-2026-09-25.md.",
  );
}

main();
