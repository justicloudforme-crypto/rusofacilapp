import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readVoiceSubmission } from "@/lib/voice-storage";

// Serves one recording's audio bytes to its owner only. Recordings live in
// a private Blob store (see voice-storage.ts) precisely so this ownership
// check is the only way to hear one — a bare <audio src> pointed at the
// raw storage URL would either fail (private) or let anyone with the URL
// listen in (public), neither of which is right for a personal
// pronunciation recording.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const submission = await db.voiceSubmission.findUnique({
    where: { id },
    select: { userId: true, audioUrl: true },
  });
  if (!submission || submission.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { body, contentType } = await readVoiceSubmission(submission.audioUrl);

  // Byte ranges, because Safari asks for them before it will play media —
  // it opens with `Range: bytes=0-1` and expects a 206. A route that
  // answers every request with 200 and the whole file works in Chrome and
  // Firefox and can leave Safari showing its own broken control instead of
  // a player. Named here as one of two candidate causes for the iOS report
  // this route was fixed for; it could not be confirmed on this machine
  // (Playwright's WebKit is not iOS Safari — it plays a file with the
  // wrong Content-Type and no range support at all), but answering ranges
  // is what an HTTP media endpoint is supposed to do either way.
  const total = body.length;
  const range = request.headers.get("range");
  const common = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    // Private and short-lived: this is the student's own voice, not a
    // static asset — no shared/public caching.
    "Cache-Control": "private, max-age=300",
  };

  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && total > 0) {
    const start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2] || 0));
    const end = match[1] ? (match[2] ? Math.min(Number(match[2]), total - 1) : total - 1) : total - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...common, "Content-Range": `bytes */${total}` },
      });
    }
    const slice = body.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(slice), {
      status: 206,
      headers: {
        ...common,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(slice.length),
      },
    });
  }

  return new NextResponse(new Uint8Array(body), {
    headers: { ...common, "Content-Length": String(total) },
  });
}
