import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/forgot-password">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/forgot-password") };
}

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: PageProps<"/[lang]/forgot-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const query = await searchParams;
  const sent = query.sent === "1";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.auth.forgotTitle}</h1>
      <p className="mt-2 text-sm text-foreground/70">{dict.auth.forgotSubtitle}</p>

      {sent ? (
        <p className="mt-6 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {dict.auth.forgotSent}
        </p>
      ) : (
        <form action="/api/auth/forgot-password" method="POST" className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="lang" value={lang} />
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
            className="tap rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {dict.auth.forgotSubmit}
          </button>
        </form>
      )}

      <Link
        href={`/${lang}/login`}
        className="tap mt-4 text-center text-sm text-foreground/70 hover:text-foreground active:text-foreground"
      >
        {dict.auth.haveAccountLink}
      </Link>
    </div>
  );
}
