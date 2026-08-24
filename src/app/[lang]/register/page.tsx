import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import MatryoshkaMark from "@/components/MatryoshkaMark";

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
  const referralCode = typeof query.ref === "string" ? query.ref : "";
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
      <div className="rounded-3xl border border-brand/15 bg-background p-7 shadow-[0_1px_2px_rgba(36,28,21,0.06),0_8px_24px_-12px_rgba(36,28,21,0.18)]">
        <div className="flex justify-center">
          <MatryoshkaMark size={40} />
        </div>
        <h1 className="mt-4 text-center font-serif text-2xl font-bold tracking-tight">
          {dict.auth.registerTitle}
        </h1>
        <p className="mt-2 text-center text-sm text-foreground/70">{dict.auth.registerSubtitle}</p>

        {errorMessage && (
          <p className="mt-4 rounded-lg bg-brand-accent/10 px-3 py-2 text-sm text-brand-accent">
            {errorMessage}
          </p>
        )}

        {referralCode && (
          <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            {dict.auth.referralInviteNotice}
          </p>
        )}

        <form action="/api/auth/register" method="POST" className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {referralCode && <input type="hidden" name="ref" value={referralCode} />}
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{dict.auth.emailLabel}</span>
            <input
              type="email"
              name="email"
              required
              placeholder={dict.auth.emailPlaceholder}
              className="rounded-lg border border-brand/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand"
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
              className="rounded-lg border border-brand/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <button
            type="submit"
            className="tap rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-light active:bg-brand-light"
          >
            {dict.auth.registerSubmit}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-foreground/50">
          {dict.auth.legalNoticeBeforeTerms}{" "}
          <Link href={`/${lang}/terms`} className="tap underline hover:text-brand active:text-brand">
            {dict.footer.termsLink}
          </Link>{" "}
          {dict.auth.legalNoticeBetween}{" "}
          <Link href={`/${lang}/privacy`} className="tap underline hover:text-brand active:text-brand">
            {dict.footer.privacyLink}
          </Link>
          {dict.auth.legalNoticeAfterPrivacy}
        </p>

        <Link
          href={`/${lang}/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="tap mt-4 block text-center text-sm text-foreground/70 hover:text-brand active:text-brand"
        >
          {dict.auth.haveAccountLink}
        </Link>
      </div>
    </div>
  );
}
