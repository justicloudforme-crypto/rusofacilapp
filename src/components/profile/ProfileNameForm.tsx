"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function ProfileNameForm({
  initialName,
  namePlaceholder,
  saveLabel,
  savedLabel,
}: {
  initialName: string | null;
  namePlaceholder: string;
  saveLabel: string;
  savedLabel: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setStatus("idle");
        }}
        placeholder={namePlaceholder}
        maxLength={100}
        className="w-full rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm outline-none focus:border-primary dark:border-white/15 dark:bg-white/10 sm:max-w-xs"
      />
      <button
        type="submit"
        disabled={status === "saving"}
        className="tap rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85 disabled:opacity-60"
      >
        {saveLabel}
      </button>
      {status === "saved" && (
        <span className="text-sm text-emerald-600 dark:text-emerald-400">{savedLabel}</span>
      )}
    </form>
  );
}
