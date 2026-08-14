import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { IDIOM_LIST_CACHE_PREFIX, validateIdiomInput } from "@/lib/idioms";
import { cacheInvalidate } from "@/lib/cache";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : null;

  const result = validateIdiomInput(body);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const idiom = id
      ? await db.idiom.update({ where: { id }, data: result.value })
      : await db.idiom.create({ data: result.value });
    cacheInvalidate(IDIOM_LIST_CACHE_PREFIX);
    return NextResponse.json({ ok: true, id: idiom.id });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 409 });
  }
}
