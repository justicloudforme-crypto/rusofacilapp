import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { invalidateFlashcardIndex } from "@/lib/flashcards/cache";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : "";
  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  await db.flashcardCard.deleteMany({ where: { id } });
  await invalidateFlashcardIndex();
  return NextResponse.json({ ok: true });
}
