import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { joinGroupByInviteCode, GroupError } from "@/lib/groups";
import { getRateLimiter } from "@/lib/rate-limit";
import { defaultLocale, isLocale } from "@/i18n/config";

const joinGroupLimiter = getRateLimiter("joinGroup", 60_000, 20);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const code = String(formData.get("code") ?? "");

  const user = await getCurrentUser();
  if (!user) {
    const url = new URL(`/${lang}/login`, request.url);
    url.searchParams.set("redirectTo", `/${lang}/groups/join?code=${encodeURIComponent(code)}`);
    return NextResponse.redirect(url, { status: 303 });
  }

  if (await joinGroupLimiter.check(user.id)) {
    return NextResponse.redirect(new URL(`/${lang}/groups?error=rate_limited`, request.url), { status: 303 });
  }

  try {
    const group = await joinGroupByInviteCode(user.id, code);
    return NextResponse.redirect(new URL(`/${lang}/groups/${group.id}`, request.url), { status: 303 });
  } catch (error) {
    const errorCode = error instanceof GroupError ? error.message : "unknown";
    return NextResponse.redirect(new URL(`/${lang}/groups?error=${errorCode}`, request.url), { status: 303 });
  }
}
