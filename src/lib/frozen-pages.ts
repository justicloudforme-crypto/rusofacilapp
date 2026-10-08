import groups from "../../docs/experiment-groups-2026-08-28.json";
import { fitTitle } from "./site";

/**
 * Which story and media pages are frozen for the "тело тонким страницам"
 * experiment until 25.09.2026.
 *
 * Why a page needs to ask. The experiment compares a pilot group against a
 * control group; anything that changes one group and not the other, or that
 * changes either group at all, moves the thing being measured. A <title> is
 * exactly such a thing — it is what Google shows and part of what it ranks
 * on. So when a shared code path improves titles for a whole route family,
 * the frozen members of that family have to keep the title they had on
 * 28.08.2026, byte for byte, even though it is a worse title. That backlog
 * is written down in PROGRESS.md and comes due after the readout.
 *
 * Source of truth is docs/experiment-groups-2026-08-28.json — the same
 * manifest the readout script reads, frozen from the live site when the
 * experiment started. It is used rather than story-pilot.ts/media-pilot.ts
 * because those two files are themselves frozen (media-pilot.ts does not
 * even export a control-group predicate), and because one manifest that
 * both the readout and the pages agree on cannot drift from itself.
 *
 * frozen-pages.test.ts checks the manifest against the group predicates
 * that ARE exported, so a wrong id here fails loudly rather than quietly
 * un-freezing a page.
 */
const FROZEN_IDS: ReadonlySet<string> = new Set([
  ...groups.storyPilot,
  ...groups.storyControl,
  ...groups.mediaPilot,
  ...groups.mediaControl,
]);

/** 165 pages: 50 + 15 stories, 75 + 25 songs. */
export const FROZEN_PAGE_COUNT = FROZEN_IDS.size;

/** True for a story id or a media id inside the experiment. Ids never
 * collide across the two (stories are cuids, media ids are slugs), so one
 * set answers for both. */
export function isFrozenPage(id: string): boolean {
  return FROZEN_IDS.has(id);
}

/**
 * The <title> for a story or media page, fitted to the SERP ceiling.
 *
 * Until 7.258 the 165 pages of the experiment got their 28.08.2026 title
 * byte for byte here (191 URLs over 70 characters). The measuring period
 * ended on 25.09.2026, so the branch is gone (долг 4) and every page goes
 * through `fitTitle`. `id` stays in the signature so both callers keep one
 * place to ask; `check:thaw` guards that no freeze branch returns.
 */
export function contentPageTitle(
  _id: string,
  base: string,
  qualifier: string,
  shortQualifier?: string,
): string {
  return fitTitle(base, qualifier, shortQualifier);
}
