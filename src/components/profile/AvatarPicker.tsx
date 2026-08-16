"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AVATAR_IDS, type AvatarId } from "@/lib/avatars";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

export default function AvatarPicker({
  initialAvatarId,
  labels,
}: {
  initialAvatarId: AvatarId;
  labels: Record<AvatarId, string>;
}) {
  const router = useRouter();
  const [avatarId, setAvatarId] = useState(initialAvatarId);
  const [saving, setSaving] = useState<AvatarId | null>(null);

  async function selectAvatar(next: AvatarId) {
    if (next === avatarId) return;
    const previous = avatarId;
    setAvatarId(next);
    setSaving(next);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: next }),
      });
      if (!res.ok) throw new Error("request failed");
      router.refresh();
    } catch {
      setAvatarId(previous);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
      {AVATAR_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => selectAvatar(id)}
          aria-pressed={avatarId === id}
          title={labels[id]}
          disabled={saving !== null}
          className={`flex flex-col items-center gap-1 rounded-2xl border p-2 transition-colors disabled:opacity-70 ${
            avatarId === id
              ? "border-brand bg-brand/5"
              : "border-black/10 hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.05]"
          }`}
        >
          <MatryoshkaAvatar id={id} size={44} label={labels[id]} />
        </button>
      ))}
    </div>
  );
}
