"use client";

import { useState, useSyncExternalStore } from "react";
import GoogleMark from "@/components/auth/GoogleMark";
import { nativeGoogleSignInAvailable, signInWithGoogleNatively } from "@/lib/google-auth/native-client";

/**
 * Кнопка входа через Google внутри приложения (заход 7.267). Окно выбора
 * аккаунта — системное (Credential Manager), не страница в WebView.
 * Без плагина в оболочке кнопки нет совсем: старую сборку она бы молча
 * подвела.
 */
const noSubscribe = () => () => {};

export default function NativeGoogleSignInButton({
  lang,
  redirectTo,
  className,
  labels,
}: {
  lang: string;
  redirectTo: string;
  className: string;
  labels: { button: string; divider: string; pending: string; failed: string; unverified: string; ambiguous: string };
}) {
  // Плагин либо есть в этой сборке оболочки, либо нет — за время жизни
  // страницы ответ не меняется; на сервере — «нет».
  const available = useSyncExternalStore(noSubscribe, nativeGoogleSignInAvailable, () => false);
  const [state, setState] = useState<"idle" | "pending" | "failed" | "unverified" | "ambiguous">("idle");

  if (!available) return null;

  async function onClick() {
    setState("pending");
    const result = await signInWithGoogleNatively({ lang, redirectTo });
    if (result.ok) {
      window.location.assign(result.redirectTo);
      return;
    }
    if (result.error === "google_cancelled") setState("idle");
    else if (result.error === "google_unverified") setState("unverified");
    else if (result.error === "google_ambiguous") setState("ambiguous");
    else setState("failed");
  }

  const message =
    state === "failed" ? labels.failed : state === "unverified" ? labels.unverified : state === "ambiguous" ? labels.ambiguous : null;

  return (
    <>
      <button type="button" onClick={onClick} disabled={state === "pending"} className={`${className} disabled:opacity-60`}>
        <GoogleMark />
        <span>{state === "pending" ? labels.pending : labels.button}</span>
      </button>
      {message && (
        <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {message}
        </p>
      )}
    </>
  );
}
