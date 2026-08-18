import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getRateLimiter } from "@/lib/rate-limit";

// Server-backed mirror of src/lib/reading-progress.ts's localStorage map —
// same rationale as /api/flashcard-progress: a 401 here just means "stay
// local," not an error the client needs to surface.
const readingLimiter = getRateLimiter("readingProgress", 60_000, 60);

interface StoryProgressPayload {
  currentPage: number;
  queueIndex: number | null;
  totalPages: number;
  percent: number;
  isCompleted: boolean;
  updatedAt: number;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await db.storyReadingProgress.findMany({ where: { userId: user.id } });
  const map: Record<string, StoryProgressPayload> = {};
  for (const row of rows) {
    map[row.storyId] = {
      currentPage: row.currentPage,
      queueIndex: row.queueIndex,
      totalPages: row.totalPages,
      percent: row.percent,
      isCompleted: row.isCompleted,
      updatedAt: row.updatedAt.getTime(),
    };
  }
  return NextResponse.json({ progress: map });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (await readingLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const storyId = typeof body?.storyId === "string" ? body.storyId : "";
  const totalPagesRaw = typeof body?.totalPages === "number" ? body.totalPages : NaN;
  const currentPageRaw = typeof body?.currentPage === "number" ? body.currentPage : NaN;
  const queueIndex =
    typeof body?.queueIndex === "number" && Number.isFinite(body.queueIndex) ? body.queueIndex : null;

  if (!storyId || !Number.isFinite(totalPagesRaw) || !Number.isFinite(currentPageRaw)) {
    return NextResponse.json({ error: "Invalid storyId, currentPage or totalPages" }, { status: 400 });
  }

  const totalPages = Math.max(1, Math.round(totalPagesRaw));
  const currentPage = Math.min(Math.max(1, Math.round(currentPageRaw)), totalPages);
  const isCompleted = currentPage >= totalPages;
  const percent = isCompleted ? 100 : Math.round((currentPage / totalPages) * 100);

  const row = await db.storyReadingProgress.upsert({
    where: { userId_storyId: { userId: user.id, storyId } },
    update: { currentPage, queueIndex, totalPages, percent, isCompleted },
    create: { userId: user.id, storyId, currentPage, queueIndex, totalPages, percent, isCompleted },
  });

  return NextResponse.json({ ok: true, updatedAt: row.updatedAt.getTime() });
}
