import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, createSession } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/i18n/config";

// "Sign out other devices" — bumps sessionVersion (invalidating every
// previously-issued session token at once, see session-token.ts) and then
// immediately re-issues a fresh cookie for THIS device/browser, so the one
// used to click the button stays signed in. A plain form POST (no client
// JS) — same pattern as the existing logout/cancel-subscription buttons.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/${lang}/login`, request.url), { status: 303 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  await createSession(updated.id, updated.sessionVersion);

  return NextResponse.redirect(
    new URL(`/${lang}/profile?tab=security&loggedOutEverywhere=1`, request.url),
    { status: 303 }
  );
}
