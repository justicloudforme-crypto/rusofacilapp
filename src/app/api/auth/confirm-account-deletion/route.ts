import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { destroySession } from "@/lib/auth";
import { getLatestSubscription } from "@/lib/subscription";
import { getStripe } from "@/lib/stripe";
import { decodeVerificationToken, matchesCurrentPassword } from "@/lib/verification-token";
import { deleteAllVoiceSubmissionsForUser } from "@/lib/voice-storage";
import { defaultLocale, isLocale } from "@/i18n/config";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  const fail = () => {
    const url = new URL(`/${lang}/confirm-delete-account`, request.url);
    url.searchParams.set("token", token);
    url.searchParams.set("error", "invalid_token");
    return NextResponse.redirect(url, { status: 303 });
  };

  const decoded = decodeVerificationToken(token, "delete_account");
  if (!decoded) return fail();

  const user = await db.user.findUnique({ where: { id: decoded.userId } });
  if (!user?.passwordHash || !matchesCurrentPassword(decoded.fingerprint, user.passwordHash)) {
    return fail();
  }

  // Best-effort: stop billing before removing the row — if this fails
  // (already canceled, Stripe unreachable), the deletion still proceeds;
  // an orphaned Stripe subscription with no matching user is a billing
  // problem to reconcile manually, not a reason to block account deletion.
  const subscription = await getLatestSubscription(user.id);
  const stripe = getStripe();
  if (stripe && subscription?.stripeSubscriptionId) {
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId).catch(() => {});
  }

  // All of the user's rows (subscriptions, progress, flashcard/story
  // progress, voice submissions) cascade-delete with this one query — see
  // `onDelete: Cascade` on each relation in schema.prisma. The one thing
  // Prisma's cascade can't touch is the audio files/blobs VoiceSubmission
  // rows point to; remove the whole per-user prefix in one shot rather
  // than per-file, and before the DB rows are gone so this can still be
  // attempted even if it fails silently on that clean-up branch.
  await deleteAllVoiceSubmissionsForUser(user.id).catch(() => {});

  await db.user.delete({ where: { id: user.id } });
  await destroySession();

  return NextResponse.redirect(new URL(`/${lang}?accountDeleted=1`, request.url), { status: 303 });
}
