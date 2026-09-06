import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { serializeFlashcardData, validateFlashcardInput } from "@/lib/flashcards";
import { invalidateFlashcardIndex } from "@/lib/flashcards/cache";
import { invalidateSearchIndex } from "@/lib/search/index-server";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : null;

  const result = validateFlashcardInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const data = serializeFlashcardData(result.value);

  try {
    const card = id
      ? await db.flashcardCard.update({ where: { id }, data })
      : await db.flashcardCard.create({ data });
    await invalidateFlashcardIndex();
    // Индекс поиска печатает название этого объекта — правка названия
    // без сброса означала бы, что поиск до пяти минут находит старое.
    await invalidateSearchIndex();
    return NextResponse.json({ ok: true, id: card.id });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 409 });
  }
}
