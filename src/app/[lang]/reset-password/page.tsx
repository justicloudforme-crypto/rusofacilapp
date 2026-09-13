import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import HashTokenForm from "@/components/auth/HashTokenForm";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/reset-password">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/reset-password") };
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const query = await searchParams;
  // Токена здесь НЕТ и быть не может: он приезжает во фрагменте адреса,
  // которого сервер не видит по построению (долг 164). Читает его
  // HashTokenForm уже в браузере.
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

      <HashTokenForm
        action="/api/auth/reset-password"
        lang={lang}
        missingLabel={dict.auth.invalidResetToken}
        className="mt-6 flex flex-col gap-4"
      >
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
      </HashTokenForm>
    </div>
  );
}
