import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { validateStoryInput } from "@/lib/stories";
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

  const story = id
    ? await db.story.update({ where: { id }, data: result.value })
    : await db.story.create({ data: result.value });
  await invalidateStoryCatalogCache();

  return NextResponse.json({ ok: true, id: story.id });
}
