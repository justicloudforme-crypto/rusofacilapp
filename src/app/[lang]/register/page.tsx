import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export default async function RegisterPage({
  params,
  searchParams,
}: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const query = await searchParams;
  const redirectTo =
    typeof query.redirectTo === "string" ? query.redirectTo : `/${lang}/profile`;
  const errorMessages: Record<string, string> = {
    invalid_email: dict.auth.invalidEmail,
    weak_password: dict.auth.weakPassword,
    email_taken: dict.auth.emailTaken,
    rate_limited: dict.auth.rateLimited,
  };
  const errorMessage =
    typeof query.error === "string" ? errorMessages[query.error] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.auth.registerTitle}</h1>
      <p className="mt-2 text-sm text-foreground/70">{dict.auth.registerSubtitle}</p>

      {errorMessage && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <form action="/api/auth/register" method="POST" className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{dict.auth.emailLabel}</span>
          <input
            type="email"
            name="email"
            required
            placeholder={dict.auth.emailPlaceholder}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{dict.auth.passwordLabel}</span>
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
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
        >
          {dict.auth.registerSubmit}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-foreground/50">
        {dict.auth.legalNoticeBeforeTerms}{" "}
        <Link href={`/${lang}/terms`} className="underline hover:text-foreground/70">
          {dict.footer.termsLink}
        </Link>{" "}
        {dict.auth.legalNoticeBetween}{" "}
        <Link href={`/${lang}/privacy`} className="underline hover:text-foreground/70">
          {dict.footer.privacyLink}
        </Link>
        {dict.auth.legalNoticeAfterPrivacy}
      </p>

      <Link
        href={`/${lang}/login?redirectTo=${encodeURIComponent(redirectTo)}`}
        className="mt-4 text-center text-sm text-foreground/70 hover:text-foreground"
      >
        {dict.auth.haveAccountLink}
      </Link>
    </div>
  );
}
