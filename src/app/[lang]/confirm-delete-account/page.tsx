import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HashTokenForm from "@/components/auth/HashTokenForm";
import { isLocale } from "@/i18n/config";
import { getPageDictionary } from "@/i18n/page-dictionary";
import { routeAlternates } from "@/lib/site";
import { getCurrentUser } from "@/lib/auth";
import { getSubscriptionsForUser } from "@/lib/subscription";
import { hasRenewingStoreSubscription } from "@/lib/store-subscription";
import { playSubscriptionCenterUrl } from "@/lib/revenuecat-config";
import PlayDeletionWarning from "@/components/legal/PlayDeletionWarning";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/confirm-delete-account">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/confirm-delete-account") };
}

export default async function ConfirmDeleteAccountPage({
  params,
  searchParams,
}: PageProps<"/[lang]/confirm-delete-account">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getPageDictionary(lang);
  const query = await searchParams;
  // Токена здесь нет: он во фрагменте адреса, который на сервер не
  // уезжает вовсе (долг 164, тот же класс, что у сброса пароля —
  // и найден он был вместе с ним).
  const hasError = query.error === "invalid_token";

  // 7.242, долг 344. Подписку Google Play удаление не отменяет. Ссылка из
  // письма часто открывается в браузере без входа — тогда сервер не знает,
  // чья это учётная запись, и строка говорит условно («если платите через
  // Google Play…»). Вошедшему без такой подписки не показывается ничего.
  const user = await getCurrentUser();
  const playWarning: "known" | "unknown" | null = !user
    ? "unknown"
    : hasRenewingStoreSubscription(await getSubscriptionsForUser(user.id).catch(() => []))
      ? "known"
      : null;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.auth.confirmDeleteTitle}</h1>
      <p className="mt-2 text-sm text-foreground/70">{dict.auth.confirmDeleteSubtitle}</p>
      {playWarning && (
        <PlayDeletionWarning
          lang={lang}
          certainty={playWarning}
          href={playWarning === "known" ? playSubscriptionCenterUrl() : undefined}
        />
      )}

      {hasError && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {dict.auth.invalidResetToken}
        </p>
      )}

      <HashTokenForm
        action="/api/auth/confirm-account-deletion"
        lang={lang}
        missingLabel={dict.auth.invalidResetToken}
        className="mt-6 flex flex-col gap-3"
      >
        <button
          type="submit"
          className="tap rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 active:bg-red-700"
        >
          {dict.auth.confirmDeleteButton}
        </button>
      </HashTokenForm>
    </div>
  );
}
