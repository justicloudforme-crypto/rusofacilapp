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
  _request: Request,
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
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      // Private and short-lived: this is the student's own voice, not a
      // static asset — no shared/public caching.
      "Cache-Control": "private, max-age=300",
    },
  });
}
