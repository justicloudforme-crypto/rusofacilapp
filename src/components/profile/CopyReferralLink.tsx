"use client";

import { useState } from "react";

export default function CopyReferralLink({ link, copyLabel, copiedLabel }: {
  link: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older WebView, denied permission)
      // — the link is still selectable/readable in the input, so there's
      // nothing to recover from here.
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input
        type="text"
        readOnly
        value={link}
        onFocus={(event) => event.target.select()}
        className="w-full rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm outline-none dark:border-white/15 dark:bg-white/10"
      />
      <button
        type="button"
        onClick={onCopy}
        className="flex-shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
      >
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
