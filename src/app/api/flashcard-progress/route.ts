import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRateLimiter } from "@/lib/rate-limit";

// Server-backed mirror of src/lib/flashcard-progress.ts's localStorage map —
// lets "known" flags survive a device switch or app reinstall. Unauthenticated
// requests are not an error here: the client falls back to localStorage-only
// and calls this route opportunistically, so a 401 is just "stay local."
const flashcardLimiter = getRateLimiter("flashcardProgress", 60_000, 60);

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await db.flashcardProgress.findMany({ where: { userId: user.id } });
  const map: Record<string, { known: boolean; updatedAt: number }> = {};
  for (const row of rows) {
    map[row.cardId] = { known: row.known, updatedAt: row.updatedAt.getTime() };
  }
  return NextResponse.json({ progress: map });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (flashcardLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const cardId = typeof body?.cardId === "string" ? body.cardId : "";
  const known = typeof body?.known === "boolean" ? body.known : null;

  if (!cardId || known === null) {
    return NextResponse.json({ error: "Invalid cardId or known" }, { status: 400 });
  }

  const row = await db.flashcardProgress.upsert({
    where: { userId_cardId: { userId: user.id, cardId } },
    update: { known },
    create: { userId: user.id, cardId, known },
  });

  return NextResponse.json({ ok: true, updatedAt: row.updatedAt.getTime() });
}
