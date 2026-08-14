import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { GLOSSARY_LIST_CACHE_PREFIX, validateGlossaryInput } from "@/lib/glossary";
import { cacheInvalidate } from "@/lib/cache";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : null;

  const result = validateGlossaryInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const data = {
    ...result.value,
    relatedLessons: JSON.stringify(result.value.relatedLessons),
    examples: JSON.stringify(result.value.examples),
  };

  try {
    const term = id
      ? await db.glossaryTerm.update({ where: { id }, data })
      : await db.glossaryTerm.create({ data });
    cacheInvalidate(GLOSSARY_LIST_CACHE_PREFIX);
    return NextResponse.json({ ok: true, id: term.id });
  } catch {
    // Most likely a unique-slug collision with another entry.
    return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }
}
