"use client";

import { useState } from "react";
import { useIsNativeShell } from "@/lib/native-shell-client";
import { APP_DISPLAY_NAME } from "@/lib/brand";
import { shareApp, shareUrlFor, type ShareOutcome } from "@/lib/share-app";

/**
 * Кнопка «Compartir la app» (заход 7.266). Строки приходят готовыми от
 * страницы, как у `CopyReferralLink`. Подтверждение на экране — только
 * когда ссылка скопирована (окно «Поделиться» говорит само за себя); если
 * не удалось ни поделиться, ни скопировать — ссылка показывается текстом.
 */
export default function ShareAppButton({
  label,
  copiedLabel,
  failedLabel,
  message,
  variant = "solid",
}: {
  label: string;
  copiedLabel: string;
  failedLabel: string;
  message: string;
  variant?: "solid" | "quiet";
}) {
  const native = useIsNativeShell();
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function onShare() {
    if (busy) return;
    setBusy(true);
    const result = await shareApp({ text: message, title: APP_DISPLAY_NAME, native });
    setBusy(false);
    setOutcome(result);
    if (result === "copied") setTimeout(() => setOutcome(null), 2500);
  }

  const className =
    variant === "solid"
      ? "tap inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
      : "tap inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-foreground/70 underline-offset-4 hover:underline active:underline";

  return (
    <div className="flex flex-col items-center gap-1" data-rf-share>
      <button type="button" onClick={onShare} disabled={busy} className={className}>
        {outcome === "copied" ? copiedLabel : label}
      </button>
      <span aria-live="polite" className="text-xs text-foreground/60">
        {outcome === "failed" ? `${failedLabel} ${shareUrlFor({ native, userAgent: navigator.userAgent })}` : ""}
      </span>
    </div>
  );
}
