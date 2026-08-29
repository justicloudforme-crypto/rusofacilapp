/**
 * The arithmetic of the "тело тонким страницам" readout, kept here rather
 * than in scripts/experiment-readout.ts so it is covered by the unit suite.
 * The procedure it implements — periods, exports, threshold, what each
 * verdict means — is docs/experiment-readout-2026-09-25.md.
 *
 * Everything in this file is pure: no filesystem, no network, no database.
 * Search Console is the owner's Google account and the CSV export is manual
 * by design; the script only feeds those files in here.
 */

/** Pre-registered 28.08.2026, a month before the readout. Changing any of
 * these AFTER the numbers are known would turn the measurement into a
 * justification — that is the one thing the whole design is guarding. */
export const SUCCESS_EFFECT = 1.3;
export const INCONCLUSIVE_FLOOR = 1.0;
/** Below this many pilot impressions in the readout window the ratio of two
 * near-zero numbers is noise, so the verdict is "not enough data", not
 * "negative". */
export const MIN_PILOT_IMPRESSIONS = 200;
/** Average position only ever supports EXTENDING an inconclusive result; it
 * can never make one positive on its own. Positions improve downwards. */
export const POSITION_SUPPORT = -0.5;

export type GscRow = { url: string; impressions: number; position: number };

export type GroupTotals = {
  impressions: number;
  perPage: number;
  position: number;
  pagesWithData: number;
  pagesInGroup: number;
};

export type Verdict = "POSITIVE" | "INCONCLUSIVE" | "NEGATIVE" | "NOT_ENOUGH_DATA";

export type Readout = {
  pilotBase: GroupTotals;
  pilotRead: GroupTotals;
  controlBase: GroupTotals;
  controlRead: GroupTotals;
  growthPilot: number;
  growthControl: number;
  effect: number;
  positionShiftPilot: number;
  positionShiftControl: number;
  positionSupport: number;
  verdict: Verdict;
};

/** One CSV line, honouring quoted cells (page titles can contain commas). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** "1 234", "1,234", "12,3" — Search Console writes whichever its interface
 * locale uses, and a silently wrong parse here would move the verdict. */
export function toNumber(cell: string | undefined): number {
  if (cell === undefined || cell.trim() === "") return 0;
  const cleaned = cell.replace(/[\s ]/g, "");
  const normalised = /^-?\d+,\d{1,2}$/.test(cleaned)
    ? cleaned.replace(",", ".")
    : cleaned.replace(/,/g, "");
  const n = Number(normalised);
  if (Number.isNaN(n)) throw new Error(`cannot read ${JSON.stringify(cell)} as a number`);
  return n;
}

/** GSC's column headers differ by interface language (ES/RU/EN all in use
 * on this account), so columns are found by meaning, not by position. */
export function parseGscCsv(text: string): GscRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV has no data rows");
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const urlCol = header.findIndex((h) => /page|páginas|paginas|страниц|url/.test(h));
  const imprCol = header.findIndex((h) => /impression|impresion|показ/.test(h));
  const posCol = header.findIndex((h) => /position|posición|posicion|позиц/.test(h));
  if (urlCol < 0 || imprCol < 0 || posCol < 0) {
    throw new Error(`missing URL/impressions/position column in [${header.join(", ")}]`);
  }
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return {
      url: (cells[urlCol] ?? "").trim(),
      impressions: toNumber(cells[imprCol]),
      position: toNumber(cells[posCol]),
    };
  });
}

/** The page id a Search Console URL refers to: its last path segment, query
 * and trailing slash removed. Both locales of one page (/es/… and /ru/…)
 * map to the same id and are summed — the block shipped in both. */
export function pageId(url: string): string {
  return url.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() ?? "";
}

export function groupTotals(rows: GscRow[], ids: string[]): GroupTotals {
  const wanted = new Set(ids);
  let impressions = 0;
  let weightedPosition = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const id = pageId(row.url);
    if (!wanted.has(id)) continue;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
    seen.add(id);
  }
  return {
    impressions,
    // Divided by the GROUP size, never by the number of rows that showed
    // up: GSC omits pages with zero impressions, so dividing by survivors
    // would quietly round every group up to only its winners.
    perPage: impressions / ids.length,
    position: impressions > 0 ? weightedPosition / impressions : NaN,
    pagesWithData: seen.size,
    pagesInGroup: ids.length,
  };
}

export function ratio(after: number, before: number): number {
  if (before === 0) return after === 0 ? NaN : Infinity;
  return after / before;
}

export function readout(
  base: GscRow[],
  read: GscRow[],
  pilotIds: string[],
  controlIds: string[],
): Readout {
  const pilotBase = groupTotals(base, pilotIds);
  const pilotRead = groupTotals(read, pilotIds);
  const controlBase = groupTotals(base, controlIds);
  const controlRead = groupTotals(read, controlIds);

  const growthPilot = ratio(pilotRead.perPage, pilotBase.perPage);
  const growthControl = ratio(controlRead.perPage, controlBase.perPage);
  const effect = ratio(growthPilot, growthControl);

  const positionShiftPilot = pilotRead.position - pilotBase.position;
  const positionShiftControl = controlRead.position - controlBase.position;

  let verdict: Verdict;
  if (pilotRead.impressions < MIN_PILOT_IMPRESSIONS) verdict = "NOT_ENOUGH_DATA";
  else if (effect >= SUCCESS_EFFECT) verdict = "POSITIVE";
  else if (effect >= INCONCLUSIVE_FLOOR) verdict = "INCONCLUSIVE";
  else verdict = "NEGATIVE";

  return {
    pilotBase,
    pilotRead,
    controlBase,
    controlRead,
    growthPilot,
    growthControl,
    effect,
    positionShiftPilot,
    positionShiftControl,
    positionSupport: positionShiftPilot - positionShiftControl,
    verdict,
  };
}

export function actionFor(result: Readout): string {
  switch (result.verdict) {
    case "NOT_ENOUGH_DATA":
      return `extend to 25.12.2026 and read out again — the pilot had ${result.pilotRead.impressions} impressions, floor is ${MIN_PILOT_IMPRESSIONS}`;
    case "POSITIVE":
      return "roll the block out to the control group and to the rest of the library";
    case "INCONCLUSIVE":
      return result.positionSupport <= POSITION_SUPPORT
        ? `extend to 25.12.2026 — average position supports it (${result.positionSupport.toFixed(2)} <= ${POSITION_SUPPORT})`
        : "extend to 25.12.2026, block stays on the pilot only";
    case "NEGATIVE":
      return "remove the block from the pilot pages and restore them to their earlier form";
  }
}
