import { describe, expect, it } from "vitest";
import groups from "../../docs/experiment-groups-2026-08-28.json";
import {
  MIN_PILOT_IMPRESSIONS,
  SUCCESS_EFFECT,
  actionFor,
  groupTotals,
  pageId,
  parseGscCsv,
  readout,
  toNumber,
  type GscRow,
} from "./experiment-readout";

// A tiny stand-in for the real export: three pilot pages, two control ones.
const PILOT = ["p1", "p2", "p3"];
const CONTROL = ["c1", "c2"];

function rows(spec: Record<string, [number, number]>): GscRow[] {
  return Object.entries(spec).map(([id, [impressions, position]]) => ({
    url: `https://rusofacilapp.com/es/stories/${id}`,
    impressions,
    position,
  }));
}

describe("Search Console CSV parsing", () => {
  it("reads the English, Spanish and Russian column headings alike", () => {
    // The account's interface language is not fixed, and the export takes
    // its headers from it. Guessing by column position instead would break
    // silently the day the owner switches language.
    const bodies = [
      "Top pages,Clicks,Impressions,CTR,Position\nhttps://x/es/stories/p1,3,120,2.5%,14.2\n",
      "Páginas principales,Clics,Impresiones,CTR,Posición\nhttps://x/es/stories/p1,3,120,2.5%,14.2\n",
      "Верхние страницы,Клики,Показы,CTR,Средняя позиция\nhttps://x/es/stories/p1,3,120,2.5%,14.2\n",
    ];
    for (const body of bodies) {
      expect(parseGscCsv(body)).toEqual([
        { url: "https://x/es/stories/p1", impressions: 120, position: 14.2 },
      ]);
    }
  });

  it("refuses a file whose columns it cannot identify rather than guessing", () => {
    expect(() => parseGscCsv("a,b,c\n1,2,3\n")).toThrow(/missing URL/);
    expect(() => parseGscCsv("Top pages,Clicks,Impressions,CTR,Position\n")).toThrow(/no data rows/);
  });

  it("reads thousands separators and decimal commas the way the export writes them", () => {
    expect(toNumber("1,234")).toBe(1234);
    expect(toNumber("1 234")).toBe(1234);
    expect(toNumber("12,3")).toBe(12.3);
    expect(toNumber("12.3")).toBe(12.3);
    expect(toNumber("")).toBe(0);
    expect(() => toNumber("n/a")).toThrow();
  });

  it("keeps a quoted cell containing a comma in one piece", () => {
    const csv = 'Top pages,Clicks,Impressions,CTR,Position\n"https://x/es/stories/p,1",3,120,2.5%,14.2\n';
    expect(parseGscCsv(csv)[0].impressions).toBe(120);
  });

  it("maps both locales of one page onto the same id", () => {
    expect(pageId("https://rusofacilapp.com/es/stories/abc")).toBe("abc");
    expect(pageId("https://rusofacilapp.com/ru/stories/abc/")).toBe("abc");
    expect(pageId("https://rusofacilapp.com/es/stories/abc?utm=x")).toBe("abc");
  });
});

describe("group totals", () => {
  it("counts a page missing from the export as zero, not as absent", () => {
    // The trap this exists for: GSC omits rows with no impressions, so
    // averaging over the rows present would measure only the pages that
    // did well and inflate every group.
    const t = groupTotals(rows({ p1: [100, 10], p2: [50, 20] }), PILOT);
    expect(t.pagesInGroup).toBe(3);
    expect(t.pagesWithData).toBe(2);
    expect(t.impressions).toBe(150);
    expect(t.perPage).toBe(50); // 150 / 3, not 150 / 2
  });

  it("weights average position by impressions", () => {
    const t = groupTotals(rows({ p1: [100, 10], p2: [100, 20] }), PILOT);
    expect(t.position).toBe(15);
    const skewed = groupTotals(rows({ p1: [300, 10], p2: [100, 20] }), PILOT);
    expect(skewed.position).toBe(12.5);
  });

  it("adds the two locales of one page together", () => {
    const both: GscRow[] = [
      { url: "https://x/es/stories/p1", impressions: 60, position: 10 },
      { url: "https://x/ru/stories/p1", impressions: 40, position: 10 },
    ];
    expect(groupTotals(both, PILOT).impressions).toBe(100);
  });
});

describe("verdict, against the threshold pre-registered on 28.08.2026", () => {
  // Baseline is the same in every case below, so only the readout moves.
  const base = rows({ p1: [300, 10], p2: [300, 10], p3: [300, 10], c1: [300, 10], c2: [300, 10] });

  it("calls it positive only when the pilot outgrows the control by the threshold", () => {
    // control doubles; pilot has to do 1.3x better than that, i.e. 2.6x.
    const read = rows({ p1: [780, 9], p2: [780, 9], p3: [780, 9], c1: [600, 10], c2: [600, 10] });
    const result = readout(base, read, PILOT, CONTROL);
    expect(result.growthControl).toBeCloseTo(2);
    expect(result.effect).toBeCloseTo(SUCCESS_EFFECT);
    expect(result.verdict).toBe("POSITIVE");
    expect(actionFor(result)).toMatch(/roll the block out/);
  });

  it("calls a smaller lead inconclusive rather than a win", () => {
    const read = rows({ p1: [700, 10], p2: [700, 10], p3: [700, 10], c1: [600, 10], c2: [600, 10] });
    const result = readout(base, read, PILOT, CONTROL);
    expect(result.effect).toBeLessThan(SUCCESS_EFFECT);
    expect(result.verdict).toBe("INCONCLUSIVE");
    expect(actionFor(result)).toMatch(/25\.12\.2026/);
  });

  it("lets average position argue for extending, never for a win", () => {
    // Same inconclusive effect, but the pilot gained 2 positions on the
    // control. That may only change the WORDING of "extend".
    const read = rows({ p1: [700, 8], p2: [700, 8], p3: [700, 8], c1: [600, 10], c2: [600, 10] });
    const result = readout(base, read, PILOT, CONTROL);
    expect(result.positionSupport).toBeCloseTo(-2);
    expect(result.verdict).toBe("INCONCLUSIVE");
    expect(actionFor(result)).toMatch(/position supports it/);
  });

  it("calls it negative when the pilot grows less than the control", () => {
    const read = rows({ p1: [400, 10], p2: [400, 10], p3: [400, 10], c1: [900, 10], c2: [900, 10] });
    const result = readout(base, read, PILOT, CONTROL);
    expect(result.verdict).toBe("NEGATIVE");
    expect(actionFor(result)).toMatch(/remove the block/);
  });

  it("refuses to call a verdict on near-zero traffic", () => {
    // A pilot that fell to 30 impressions while the control fell to 1
    // produces a huge ratio out of nothing. That is the failure mode the
    // floor exists for — it must not read as a success.
    const read = rows({ p1: [10, 40], p2: [10, 40], p3: [10, 40], c1: [1, 40], c2: [0, 0] });
    const result = readout(base, read, PILOT, CONTROL);
    expect(result.effect).toBeGreaterThan(SUCCESS_EFFECT);
    expect(result.pilotRead.impressions).toBeLessThan(MIN_PILOT_IMPRESSIONS);
    expect(result.verdict).toBe("NOT_ENOUGH_DATA");
  });
});

describe("the frozen group lists", () => {
  it("matches the group sizes the experiment was designed with", () => {
    // These are the sizes PROGRESS.md records; if the JSON is ever
    // regenerated and comes out different, the experiment is not the one
    // that was started on 28.08.2026.
    expect(groups.storyPilot).toHaveLength(50);
    expect(groups.storyControl).toHaveLength(15);
    expect(groups.mediaPilot).toHaveLength(75);
    expect(groups.mediaControl).toHaveLength(25);
  });

  it("keeps the four groups disjoint", () => {
    const all = [...groups.storyPilot, ...groups.storyControl, ...groups.mediaPilot, ...groups.mediaControl];
    expect(new Set(all).size).toBe(all.length);
  });
});
