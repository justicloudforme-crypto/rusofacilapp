import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function ConfirmDeleteAccountPage({
  params,
  searchParams,
}: PageProps<"/[lang]/confirm-delete-account">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
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

      {token && (
        <form
          action="/api/auth/confirm-account-deletion"
          method="POST"
          className="mt-6 flex flex-col gap-3"
        >
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            {dict.auth.confirmDeleteButton}
          </button>
        </form>
      )}
    </div>
  );
}
