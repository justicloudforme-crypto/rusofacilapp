import { NextResponse } from "next/server";

import { isLocale, locales } from "@/i18n/config";
import { pwaManifest } from "@/lib/pwa-manifest";

/**
 * МАНИФЕСТ ЭТОЙ ЛОКАЛИ — ДОЛГ 83 (заход 7.217).
 *
 * До 19.09.2026 манифест был один на обе локали: человек, читающий сайт
 * по-русски, ставил на домашний экран приложение с испанским описанием.
 * Соглашение Next `app/manifest.ts` локали не знает по построению —
 * адрес у него ровно один, — поэтому локальные манифесты живут своим
 * маршрутом, а содержимое им обоим собирает `src/lib/pwa-manifest.ts`.
 *
 * Статический: локаль известна из адреса, ничего из запроса не читается.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(pwaManifest(lang), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
