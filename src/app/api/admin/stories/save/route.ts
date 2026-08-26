import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { estimateReadingMinutes, validateStoryInput } from "@/lib/stories";
import { invalidateStoryCatalogCache } from "@/lib/stories-catalog";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" && body.id ? body.id : null;

  const result = validateStoryInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // A staff save is exactly the "human reviewed this" signal — stamping it
  // here means seed/generation scripts (prisma/seed-stories.ts) can tell a
  // hand-edited row apart from one that's only ever seen batch content and
  // refuse to silently overwrite it.
  const data = { ...result.value, reviewedAt: new Date(), readingMinutes: estimateReadingMinutes(result.value.text) };
  const story = id
    ? await db.story.update({ where: { id }, data })
    : await db.story.create({ data });
  await invalidateStoryCatalogCache();

  return NextResponse.json({ ok: true, id: story.id });
}
