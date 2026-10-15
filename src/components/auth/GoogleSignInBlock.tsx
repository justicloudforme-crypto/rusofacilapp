import GoogleMark from "@/components/auth/GoogleMark";
import NativeGoogleSignInButton from "@/components/auth/NativeGoogleSignInButton";
import { googleButtonMode, isGoogleSignInEnabled } from "@/lib/google-auth/config";
import { isNativeShellRequest, nativeShellVersionOfRequest } from "@/lib/native-shell";

/**
 * «Continuar con Google» / «Войти через Google» над формой входа и
 * регистрации (заход 7.267).
 *
 * ВСЁ ЗА ФЛАГОМ: пока в Vercel нет GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET,
 * этот блок не рисует НИЧЕГО — ни кнопки, ни разделителя, ни пустой
 * обёртки, и страница совпадает с тем, что было до захода.
 *
 * В браузере — обычная ссылка на `/api/auth/google/start` (без JS, без
 * сторонних скриптов на странице). В приложении — только нативная кнопка
 * и только в оболочке с плагином (1.0.16+); веб-ссылки в приложении нет
 * никогда: из WebView она уходит в Chrome.
 */
export type GoogleLabels = { button: string; divider: string; pending: string; failed: string; unverified: string; ambiguous: string };

export function googleLabels(auth: {
  googleButton: string;
  googleDivider: string;
  googlePending: string;
  googleFailed: string;
  googleUnverified: string;
  googleAmbiguous: string;
}): GoogleLabels {
  return {
    button: auth.googleButton,
    divider: auth.googleDivider,
    pending: auth.googlePending,
    failed: auth.googleFailed,
    unverified: auth.googleUnverified,
    ambiguous: auth.googleAmbiguous,
  };
}

export default async function GoogleSignInBlock({
  lang,
  redirectTo,
  labels,
}: {
  lang: string;
  redirectTo: string;
  labels: GoogleLabels;
}) {
  const inApp = await isNativeShellRequest();
  const mode = googleButtonMode({
    enabled: isGoogleSignInEnabled(),
    inApp,
    shellVersion: inApp ? await nativeShellVersionOfRequest() : null,
  });
  if (mode === "none") return null;

  const buttonClass =
    "tap flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-primary/20 bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 active:border-primary/40";

  return (
    <div className="mt-6" data-google-signin={mode}>
      {mode === "web" ? (
        <a href={`/api/auth/google/start?lang=${encodeURIComponent(lang)}&redirectTo=${encodeURIComponent(redirectTo)}`} className={buttonClass}>
          <GoogleMark />
          <span>{labels.button}</span>
        </a>
      ) : (
        <NativeGoogleSignInButton lang={lang} redirectTo={redirectTo} className={buttonClass} labels={labels} />
      )}
      <div className="mt-6 flex items-center gap-3 text-xs text-foreground/50" aria-hidden="true">
        <span className="h-px flex-1 bg-primary/15" />
        <span>{labels.divider}</span>
        <span className="h-px flex-1 bg-primary/15" />
      </div>
    </div>
  );
}
