import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isLevelSlug, isLessonSlug } from "@/lib/courses";
import { getRateLimiter } from "@/lib/rate-limit";
import { deleteVoiceSubmission, saveVoiceSubmission } from "@/lib/voice-storage";

const MAX_BYTES = 10 * 1024 * 1024;
const SUBMISSIONS_PER_ITEM_LIMIT = 5;

// Defends against a runaway client (buggy tab stuck in a retry loop, or a
// script) hammering disk + DB with uploads — not a substitute for auth,
// just a cheap backstop so one misbehaving client can't starve everyone
// else during a burst.
const uploadLimiter = getRateLimiter("voiceUpload", 60_000, 12);

function keyHash(itemKey: string): string {
  return createHash("sha1").update(itemKey).digest("hex").slice(0, 16);
}

/** Best-effort trim to the N most recent attempts per item — removes both
 * the DB rows and their audio files. Runs after the response is already
 * on its way to the client, so a slow disk/DB doesn't add latency to the
 * upload itself. Overshooting the limit by a row or two under concurrent
 * uploads for the same item is acceptable (it's a soft disk-usage cap, not
 * a correctness guarantee) — worth noting explicitly since this file has
 * no transaction wrapping the read + delete. */
async function trimOldSubmissions(userId: string, level: string, lessonSlug: string, itemKey: string) {
  try {
    const older = await db.voiceSubmission.findMany({
      where: { userId, level, lessonSlug, itemKey },
      orderBy: { createdAt: "desc" },
      skip: SUBMISSIONS_PER_ITEM_LIMIT,
      select: { id: true, audioUrl: true },
    });
    if (older.length === 0) return;

    await db.voiceSubmission.deleteMany({ where: { id: { in: older.map((row) => row.id) } } });
    await Promise.all(
      older.map((row) =>
        deleteVoiceSubmission(row.audioUrl).catch(() => {
          // File/blob already gone (e.g. a previous cleanup raced this one) — fine.
        })
      )
    );
  } catch {
    // Cleanup is a housekeeping nicety; a failure here must never surface
    // as an error on the (already-sent) upload response.
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (await uploadLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const level = typeof form?.get("level") === "string" ? String(form.get("level")) : "";
  const lessonSlug = typeof form?.get("lesson") === "string" ? String(form.get("lesson")) : "";
  const itemKey = typeof form?.get("itemKey") === "string" ? String(form.get("itemKey")) : "";
  const file = form?.get("file");

  if (!isLevelSlug(level) || !isLessonSlug(level, lessonSlug)) {
    return NextResponse.json({ error: "invalid_lesson" }, { status: 400 });
  }
  if (!itemKey) {
    return NextResponse.json({ error: "missing_item_key" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  // randomUUID (not just Date.now()) so two uploads for the same item in
  // the same millisecond — two browser tabs, a double-click — never
  // collide on the filename and silently overwrite each other.
  const filename = `${keyHash(itemKey)}-${Date.now()}-${randomUUID()}.webm`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const audioUrl = await saveVoiceSubmission(user.id, `${level}-${lessonSlug}`, filename, bytes);

  const submission = await db.voiceSubmission.create({
    data: { userId: user.id, level, lessonSlug, itemKey, audioUrl },
  });

  // Fire-and-forget: the student doesn't need to wait on housekeeping to
  // see their upload confirmed.
  void trimOldSubmissions(user.id, level, lessonSlug, itemKey);

  return NextResponse.json({
    id: submission.id,
    audioUrl: submission.audioUrl,
    createdAt: submission.createdAt,
  });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") ?? "";
  const lessonSlug = searchParams.get("lesson") ?? "";
  const itemKey = searchParams.get("itemKey") ?? "";

  if (!isLevelSlug(level) || !isLessonSlug(level, lessonSlug) || !itemKey) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  // Backed by the composite index on (userId, level, lessonSlug, itemKey)
  // in prisma/schema.prisma — an index-only lookup, not a table scan, so
  // this stays cheap no matter how many submissions accumulate overall.
  const submissions = await db.voiceSubmission.findMany({
    where: { userId: user.id, level, lessonSlug, itemKey },
    orderBy: { createdAt: "desc" },
    take: SUBMISSIONS_PER_ITEM_LIMIT,
    select: { id: true, audioUrl: true, createdAt: true },
  });

  return NextResponse.json({ submissions });
}
