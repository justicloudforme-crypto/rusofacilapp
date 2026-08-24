import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const errorMessages: Record<string, string> = {
    invalid_token: dict.auth.invalidResetToken,
    weak_password: dict.auth.weakPassword,
    rate_limited: dict.auth.rateLimited,
  };
  const errorMessage =
    typeof query.error === "string" ? errorMessages[query.error] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.auth.resetTitle}</h1>
      <p className="mt-2 text-sm text-foreground/70">{dict.auth.resetSubtitle}</p>

      {errorMessage && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      {!token ? (
        <p className="mt-6 text-sm text-foreground/60">{dict.auth.invalidResetToken}</p>
      ) : (
        <form action="/api/auth/reset-password" method="POST" className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="token" value={token} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{dict.auth.newPasswordLabel}</span>
            <input
              type="password"
              name="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              placeholder={dict.auth.passwordPlaceholder}
              className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
            />
          </label>
          <button
            type="submit"
            className="tap rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {dict.auth.resetSubmit}
          </button>
        </form>
      )}
    </div>
  );
}
