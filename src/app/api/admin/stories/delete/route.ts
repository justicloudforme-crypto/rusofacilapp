import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { defaultLocale, isLocale } from "@/i18n/config";
import { invalidateStoryCatalogCache } from "@/lib/stories-catalog";
import { invalidateSearchIndex } from "@/lib/search/index-server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const id = String(formData.get("id") ?? "");

  const storiesUrl = new URL(`/${lang}/admin/stories`, request.url);

  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (id) {
    await db.story.deleteMany({ where: { id } });
    await invalidateStoryCatalogCache();
    // Индекс поиска печатает название этого объекта — правка названия
    // без сброса означала бы, что поиск до пяти минут находит старое.
    await invalidateSearchIndex();
  }

  return NextResponse.redirect(storiesUrl, { status: 303 });
}
