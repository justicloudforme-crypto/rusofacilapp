import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { leaveOrDeleteGroup } from "@/lib/groups";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/${lang}/login`, request.url), { status: 303 });
  }

  await leaveOrDeleteGroup(user.id, groupId);

  return NextResponse.redirect(new URL(`/${lang}/groups`, request.url), { status: 303 });
}
