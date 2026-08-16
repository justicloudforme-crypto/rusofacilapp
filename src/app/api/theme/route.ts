import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isThemePreference, THEME_COOKIE } from "@/lib/theme";

// Sets the site-wide display-mode cookie (light/dark/reading) read by
// [lang]/layout.tsx on every request. No auth required — it's a per-browser
// display preference, not account data, and ThemeSwitcher.tsx already
// applies the change instantly on the client; this just makes it survive a
// reload/new tab.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const theme = typeof body?.theme === "string" ? body.theme : "";
  if (!isThemePreference(theme)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }

  const response = NextResponse.json({ theme });
  response.cookies.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
