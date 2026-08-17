/**
 * Validates every media item's `youtubeVideoId` against the real YouTube
 * Data API v3 `videos.list` endpoint (`part=status,contentDetails`), NOT
 * `yt-dlp`/oEmbed.
 *
 * Why not yt-dlp/oEmbed (see rusofasil_media_content_policy memory,
 * "Embed-restriction audit and new sourcing rule"): both were confirmed
 * unreliable at sourcing time — `playable_in_embed` and oEmbed's 200/404
 * both came back clean for songs the user later saw fail with "Video
 * unavailable" on the live site.
 *
 * Why `status.embeddable` alone still isn't enough (discovered running
 * this exact check against the very song the user reported broken,
 * song-ty-uydyosh / CGblT4FasEo): the Data API returned
 * `status.embeddable: true` for it too — the official API has the same
 * blind spot as yt-dlp for *this specific* video. What it did surface,
 * once `contentDetails` was requested too, was `regionRestriction.blocked:
 * ["RU"]` — country-level blocks are a separate field from `embeddable`
 * entirely. This app's audience is Mexico, and `TARGET_REGION` below
 * checks specifically against that, but it won't explain every failure:
 * a video can still break for reasons no `videos.list` field exposes
 * (a transient CDN/licensing glitch, a restriction that applies only to
 * signed-out or age-gated viewers, etc.). Treat this checker as a strong
 * first line of defense that catches the majority of real cases (deleted
 * videos, terminated channels, explicit embeddable=false, region blocks
 * against MX) — not a 100% guarantee. A direct user report of "Video
 * unavailable" is still stronger evidence than this check passing, and
 * should win when the two disagree (see the manual override on
 * song-ty-uydyosh in mediaData.json).
 *
 * Either way, this can't be fixed by a smarter single check alone — a
 * rightsholder can retroactively claim a video or a channel can be
 * terminated at any time after this check passes, so it has to be
 * *re-run* periodically, which is what `prisma/check-media-embeds.ts` is
 * for.
 */

export type EmbedCheckOutcome = "ok" | "blocked" | "unavailable" | "check_failed";

export interface EmbedCheckResult {
  id: string;
  youtubeVideoId: string;
  outcome: EmbedCheckOutcome;
  /** Human-readable reason, e.g. "privacyStatus=private" or "not found". */
  reason?: string;
}

interface YouTubeVideosListResponse {
  items?: Array<{
    id: string;
    status?: {
      uploadStatus?: string;
      privacyStatus?: string;
      embeddable?: boolean;
    };
    contentDetails?: {
      regionRestriction?: {
        /** If present, the video is blocked ONLY in these countries. */
        blocked?: string[];
        /** If present, the video is ONLY available in these countries (allowlist). */
        allowed?: string[];
      };
    };
  }>;
}

// This platform's audience is Spanish-speaking learners in Mexico — a
// region-restriction check with no target country is nearly useless (most
// restrictions are music-label deals blocking a handful of *other*
// countries), so this is the one country that actually matters here.
// Confirmed necessary in practice: `status.embeddable` returned `true` for
// a song the user directly saw fail with "Video unavailable", and the only
// other signal `videos.list` exposes is `contentDetails.regionRestriction`
// — which requesting `part=status` alone does NOT include.
const TARGET_REGION = "MX";

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos";
// videos.list accepts up to 50 ids per request.
const BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Checks a batch of {id, youtubeVideoId} pairs. `youtubeVideoId` may repeat
 * across `id`s only in theory (the build script asserts uniqueness), but
 * this function is written defensively against that anyway.
 */
export async function checkMediaEmbeds(
  entries: { id: string; youtubeVideoId: string }[],
  apiKey: string,
): Promise<EmbedCheckResult[]> {
  const results: EmbedCheckResult[] = [];

  for (const batch of chunk(entries, BATCH_SIZE)) {
    const idParam = batch.map((e) => e.youtubeVideoId).join(",");
    const url = `${YOUTUBE_API_URL}?part=status,contentDetails&id=${encodeURIComponent(idParam)}&key=${apiKey}`;

    let payload: YouTubeVideosListResponse;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        for (const entry of batch) {
          results.push({
            ...entry,
            outcome: "check_failed",
            reason: `YouTube API HTTP ${res.status}: ${body.slice(0, 200)}`,
          });
        }
        continue;
      }
      payload = (await res.json()) as YouTubeVideosListResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : "network error";
      for (const entry of batch) {
        results.push({ ...entry, outcome: "check_failed", reason: message });
      }
      continue;
    }

    const byVideoId = new Map(payload.items?.map((item) => [item.id, item]) ?? []);

    for (const entry of batch) {
      const item = byVideoId.get(entry.youtubeVideoId);
      if (!item) {
        // Not returned at all = deleted, private, or never existed.
        results.push({ ...entry, outcome: "unavailable", reason: "not returned by videos.list (deleted/private)" });
        continue;
      }
      const status = item.status;
      if (!status || status.uploadStatus !== "processed") {
        results.push({ ...entry, outcome: "unavailable", reason: `uploadStatus=${status?.uploadStatus}` });
        continue;
      }
      if (status.privacyStatus !== "public") {
        results.push({ ...entry, outcome: "unavailable", reason: `privacyStatus=${status.privacyStatus}` });
        continue;
      }
      if (status.embeddable === false) {
        results.push({ ...entry, outcome: "blocked", reason: "status.embeddable=false" });
        continue;
      }
      const region = item.contentDetails?.regionRestriction;
      if (region?.blocked?.includes(TARGET_REGION)) {
        results.push({ ...entry, outcome: "blocked", reason: `regionRestriction.blocked includes ${TARGET_REGION}` });
        continue;
      }
      if (region?.allowed && !region.allowed.includes(TARGET_REGION)) {
        results.push({
          ...entry,
          outcome: "blocked",
          reason: `regionRestriction.allowed=[${region.allowed.join(",")}] excludes ${TARGET_REGION}`,
        });
        continue;
      }
      results.push({ ...entry, outcome: "ok" });
    }
  }

  return results;
}
