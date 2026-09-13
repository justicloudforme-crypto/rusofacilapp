import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HashTokenForm from "@/components/auth/HashTokenForm";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { routeAlternates } from "@/lib/site";

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

  const dict = await getDictionary(lang);
  const query = await searchParams;
  // Токена здесь нет: он во фрагменте адреса, который на сервер не
  // уезжает вовсе (долг 164, тот же класс, что у сброса пароля —
  // и найден он был вместе с ним).
  const hasError = query.error === "invalid_token";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.auth.confirmDeleteTitle}</h1>
      <p className="mt-2 text-sm text-foreground/70">{dict.auth.confirmDeleteSubtitle}</p>

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
