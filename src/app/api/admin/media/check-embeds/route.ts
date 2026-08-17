import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { getAllMedia, saveEmbedStatuses } from "@/lib/media/data";
import { checkMediaEmbeds } from "@/lib/media/checkEmbeds";
import type { EmbedStatus } from "@/lib/media/types";

export async function POST() {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 503 });
  }

  const items = await getAllMedia();
  const results = await checkMediaEmbeds(
    items.map((item) => ({ id: item.id, youtubeVideoId: item.youtubeVideoId })),
    apiKey,
  );

  const updates: { id: string; embedStatus: EmbedStatus; note?: string }[] = [];
  for (const r of results) {
    const embedStatus: EmbedStatus | null =
      r.outcome === "ok" ? "ok" : r.outcome === "blocked" || r.outcome === "unavailable" ? "blocked" : null;
    if (embedStatus) updates.push({ id: r.id, embedStatus, note: r.reason });
  }

  await saveEmbedStatuses(updates);

  return NextResponse.json({
    checked: results.length,
    ok: results.filter((r) => r.outcome === "ok").length,
    broken: results.filter((r) => r.outcome === "blocked" || r.outcome === "unavailable").length,
    checkFailed: results.filter((r) => r.outcome === "check_failed").length,
    results: results.map((r) => ({ id: r.id, outcome: r.outcome, reason: r.reason })),
  });
}
