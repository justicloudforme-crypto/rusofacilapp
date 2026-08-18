"use client";

import { useState } from "react";
import CopyReferralLink from "./CopyReferralLink";

export default function PublicProfileToggle({
  origin,
  lang,
  initialEnabled,
  initialHandle,
  toggleLabel,
  copyLabel,
  copiedLabel,
}: {
  origin: string;
  lang: string;
  initialEnabled: boolean;
  initialHandle: string | null;
  toggleLabel: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [handle, setHandle] = useState(initialHandle);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch("/api/public-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = (await res.json()) as { enabled: boolean; handle: string | null };
      setEnabled(data.enabled);
      if (data.handle) setHandle(data.handle);
    } catch {
      // Leave state as it was — the checkbox just won't visually flip,
      // which is an honest reflection of "the save didn't happen".
    } finally {
      setSaving(false);
    }
  }

  const link = handle ? `${origin}/${lang}/u/${handle}` : null;

  return (
    <div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={enabled} disabled={saving} onChange={toggle} className="h-4 w-4" />
        {toggleLabel}
      </label>
      {enabled && link && (
        <div className="mt-3">
          <CopyReferralLink link={link} copyLabel={copyLabel} copiedLabel={copiedLabel} />
        </div>
      )}
    </div>
  );
}
