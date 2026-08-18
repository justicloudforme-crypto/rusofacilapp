import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setPublicProfileEnabled } from "@/lib/public-profile";
import { getRateLimiter } from "@/lib/rate-limit";

const publicProfileLimiter = getRateLimiter("publicProfileToggle", 60_000, 20);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (await publicProfileLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const enabled = body?.enabled === true;

  const handle = await setPublicProfileEnabled(user.id, enabled);

  return NextResponse.json({ enabled, handle });
}
