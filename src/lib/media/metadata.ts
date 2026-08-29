import { shortenTitle, truncateForMeta } from "@/lib/site";

/**
 * The meta description for one media page.
 *
 * Why the Russian side needed its own builder. Measured on the live site
 * 30.08.2026: all 275 /ru media pages shared FIVE descriptions between
 * them — the text was one sentence with only the level substituted in, so
 * 70 pages could carry the identical string. The Spanish side already had
 * `item.description`, hand-written per item. Naming the item in the Russian
 * sentence makes each page describe itself, and the titles are unique, so
 * the descriptions are too.
 *
 * Pure and exported so the test can check it against the real
 * mediaData.json rather than against a copy of this logic.
 */
const KIND_RU: Record<string, string> = {
  song: "песня",
  movie: "фильм",
  video: "видео",
  grammar: "видеоурок грамматики",
};

/** Leaves room for the fixed part of the Russian sentence below inside the
 * 155 characters Google shows; the longest media title is 112. */
const TITLE_BUDGET = 60;

export function mediaDescription(
  lang: string,
  item: { title: string; level: string; category: string; description: string },
): string {
  if (lang !== "ru") return truncateForMeta(item.description);
  const kind = KIND_RU[item.category] ?? "видео";
  return truncateForMeta(
    `«${shortenTitle(item.title, TITLE_BUDGET)}» — ${kind} уровня ${item.level} с субтитрами, разбором лексики и упражнениями.`,
  );
}

/** What the page served before 30.08.2026. Frozen media pages must keep
 * serving exactly this until the 25.09 readout, so it lives here next to
 * its replacement rather than inline in the page, where the two could
 * drift apart unnoticed. */
export function frozenMediaDescription(
  lang: string,
  item: { level: string; description: string },
): string {
  return lang === "ru"
    ? `Изучайте русский язык через видео и музыку с субтитрами и упражнениями, уровень ${item.level}, в RusoFácilapp.`
    : item.description;
}
