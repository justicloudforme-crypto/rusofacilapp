/**
 * The media items that show their key vocabulary to a locked visitor (see
 * src/lib/story-insights.ts for the same move on stories). A pilot with a
 * control group, for the same reason as the story pilot: a rollout with
 * nothing held back cannot be evaluated afterwards.
 *
 * Selection rule, fixed before any measurement:
 *
 *   category "song" only; within each level, ordered by id,
 *   the LAST FIVE are the control and the rest are the pilot.
 *
 * Songs because they are the largest single category (100 of 275 items),
 * evenly spread across all five levels, and the clearest Spanish search
 * intent ("canciones rusas para aprender"). Holding back the last five of
 * every level rather than a flat tail keeps the control spread across A1
 * to C1, so it stays comparable level by level.
 *
 * Result: 75 pilot, 25 control. Movies, videos and grammar clips (175
 * items) are outside this experiment entirely — they keep only the
 * grammar links added in PR #55.
 *
 * Keyed by id, unlike the story pilot: media ids are hand-written slugs in
 * mediaData.json ("song-katyusha"), stable across environments, so the
 * Story.id drift problem does not apply here.
 */

const CONTROL_SONG_IDS = new Set([
  // A1
  "song-spyat-ustalye-igrushki",
  "song-ty-i-ya-takie-raznye",
  "song-ulybka",
  "song-v-trave-sidel-kuznechik",
  "song-vmeste-veselo-shagat",
  // A2
  "song-prekrasnoe-daleko",
  "song-pust-begut-neuklyuzhe",
  "song-rozovyy-vecher",
  "song-yatl-zivert",
  "song-yolochka",
  // B1
  "song-techet-reka-volga",
  "song-ty-u-menya-odna",
  "song-ty-uydyosh",
  "song-vremya-toropitsya",
  "song-ya-to-chto-nado",
  // B2
  "song-s-chistogo-lista",
  "song-v-zhizni-tak-byvaet",
  "song-vladivostok-2000",
  "song-zemlya-v-illuminatore",
  "song-zvezda-po-imeni-solntse",
  // C1
  "song-sirena-vyshe-radugi",
  "song-v-lunnom-siyanii",
  "song-ya-tebya-nikogda-ne-zabudu",
  "song-zemfira-khochesh",
  "song-zurbagan",
]);

export const MEDIA_CONTROL_SIZE = CONTROL_SONG_IDS.size;

export function isPilotMedia(item: { id: string; category: string }): boolean {
  return item.category === "song" && !CONTROL_SONG_IDS.has(item.id);
}
