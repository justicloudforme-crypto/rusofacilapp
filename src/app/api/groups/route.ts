import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createGroup, GroupError } from "@/lib/groups";
import { getRateLimiter } from "@/lib/rate-limit";
import { defaultLocale, isLocale } from "@/i18n/config";

// A student creates at most a handful of groups ever — this only exists to
// stop a scripted client from spamming Group rows.
const createGroupLimiter = getRateLimiter("createGroup", 60_000, 10);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const name = String(formData.get("name") ?? "");

  const user = await getCurrentUser();
  if (!user) {
    const url = new URL(`/${lang}/login`, request.url);
    url.searchParams.set("redirectTo", `/${lang}/groups`);
    return NextResponse.redirect(url, { status: 303 });
  }

  if (await createGroupLimiter.check(user.id)) {
    return NextResponse.redirect(new URL(`/${lang}/groups?error=rate_limited`, request.url), { status: 303 });
  }

  try {
    const group = await createGroup(user.id, name);
    return NextResponse.redirect(new URL(`/${lang}/groups/${group.id}`, request.url), { status: 303 });
  } catch (error) {
    const code = error instanceof GroupError ? error.message : "unknown";
    return NextResponse.redirect(new URL(`/${lang}/groups?error=${code}`, request.url), { status: 303 });
  }
}
