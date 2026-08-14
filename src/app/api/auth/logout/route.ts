import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function POST(request: NextRequest) {
  await destroySession();

  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  return NextResponse.redirect(new URL(`/${lang}`, request.url), { status: 303 });
}
