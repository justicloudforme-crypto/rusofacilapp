import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { GLOSSARY_LIST_CACHE_PREFIX } from "@/lib/glossary";
import { cacheInvalidate } from "@/lib/cache";

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

  await db.glossaryTerm.deleteMany({ where: { id } });
  cacheInvalidate(GLOSSARY_LIST_CACHE_PREFIX);
  return NextResponse.json({ ok: true });
}
