import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const query = await searchParams;
  const redirectTo =
    typeof query.redirectTo === "string" ? query.redirectTo : `/${lang}/profile`;
  const hasError = query.error === "invalid_email";
  const isRateLimited = query.error === "rate_limited";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.auth.loginTitle}</h1>
      <p className="mt-2 text-sm text-foreground/70">{dict.auth.loginSubtitle}</p>

      {hasError && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {dict.auth.invalidEmail}
        </p>
      )}
      {isRateLimited && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          {dict.auth.rateLimited}
        </p>
      )}

      <form action="/api/auth/login" method="POST" className="mt-6 flex flex-col gap-4">
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
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
        >
          {dict.auth.submit}
        </button>
      </form>
    </div>
  );
}
