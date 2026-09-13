import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { destroySession } from "@/lib/auth";
import { getSubscriptionsForUser } from "@/lib/subscription";
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
    url.searchParams.set("error", "invalid_token");
    // Долг 164, тот же класс: токен возвращается во фрагменте.
    url.hash = `token=${encodeURIComponent(token)}`;
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
  // Every Stripe-backed row, not just the newest one: a user who bought
  // Premium on top of a monthly plan has two rows, the Premium one is
  // newer, and cancelling "the newest" would leave the monthly plan
  // billing a card that no longer has an account behind it.
  const subscriptions = await getSubscriptionsForUser(user.id);
  const stripe = getStripe();
  if (stripe) {
    for (const row of subscriptions) {
      if (row.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(row.stripeSubscriptionId).catch(() => {});
      }
    }
  }

  // All of the user's rows (subscriptions, progress, flashcard/story
  // progress, voice submissions) cascade-delete with this one query — see
  // `onDelete: Cascade` on each relation in schema.prisma. The one thing
  // Prisma's cascade can't touch is the audio files/blobs VoiceSubmission
  // rows point to; remove the whole per-user prefix in one shot rather
  // than per-file, and before the DB rows are gone so this can still be
  // attempted even if it fails silently on that clean-up branch.
  //
  // ДОЛГ 167: отказ уборки больше НЕ МОЛЧИТ. Раньше здесь стоял
  // `.catch(() => {})`, и это была дыра, измеренная тремя сиротами: строка
  // `User` удалялась следующей командой в любом случае, поэтому сбой
  // уборки не откатывал удаление, не писался в журнал и не уходил в
  // Sentry — а вместе со строкой исчезал и id, по которому объект можно
  // было бы найти. Найти его после этого нечем в принципе.
  //
  // Падать по-прежнему НЕЛЬЗЯ, и это решение, а не упущение: удаление
  // учётной записи — обещание, данное человеку и записанное в политике,
  // и застревать оно из-за файла не имеет права. Разница с прежним
  // поведением ровно одна и она вся: теперь об этом становится известно.
  // Второй путь (`prisma/delete-test-accounts.ts`) поступает НАОБОРОТ —
  // отказывается удалять строку, — потому что там никто не ждёт ответа.
  try {
    await deleteAllVoiceSubmissionsForUser(user.id);
  } catch (error) {
    console.error("confirm-account-deletion: уборка записей голоса не удалась", user.id, error);
    Sentry.captureException(error, {
      tags: { area: "account-deletion", step: "voice-blob-cleanup" },
      extra: { userId: user.id },
    });
  }

  await db.user.delete({ where: { id: user.id } });
  await destroySession();

  return NextResponse.redirect(new URL(`/${lang}?accountDeleted=1`, request.url), { status: 303 });
}
