import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runBackup } from "@/lib/backup";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run un-gated, even accidentally

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Triggered by the daily Vercel Cron entry in vercel.json (GET, per
// Vercel's cron convention). Also safe to hit manually with the same
// Authorization header for an on-demand backup before a risky migration.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const result = await runBackup();
  return NextResponse.json({ ok: true, ...result });
}
