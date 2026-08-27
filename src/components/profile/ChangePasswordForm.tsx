"use client";

import { useState, type FormEvent } from "react";

export default function ChangePasswordForm({
  currentPasswordLabel,
  newPasswordLabel,
  saveLabel,
  savedLabel,
  invalidCurrentPasswordLabel,
  weakPasswordLabel,
  minLength,
}: {
  currentPasswordLabel: string;
  newPasswordLabel: string;
  saveLabel: string;
  savedLabel: string;
  invalidCurrentPasswordLabel: string;
  weakPasswordLabel: string;
  minLength: number;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "invalid_current_password" | "weak_password" | "error">("idle");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setStatus("saved");
        setCurrentPassword("");
        setNewPassword("");
        return;
      }
      const body = await res.json().catch(() => null);
      setStatus(body?.error === "weak_password" ? "weak_password" : "invalid_current_password");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{currentPasswordLabel}</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setStatus("idle");
          }}
          className="rounded-lg border border-black/15 bg-white/60 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20 dark:bg-white/10"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{newPasswordLabel}</span>
        <input
          type="password"
          required
          minLength={minLength}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            setStatus("idle");
          }}
          className="rounded-lg border border-black/15 bg-white/60 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20 dark:bg-white/10"
        />
      </label>
      <div className="flex items-center gap-3">
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
        {status === "invalid_current_password" && (
          <span className="text-sm text-red-600 dark:text-red-400">{invalidCurrentPasswordLabel}</span>
        )}
        {status === "weak_password" && (
          <span className="text-sm text-red-600 dark:text-red-400">{weakPasswordLabel}</span>
        )}
      </div>
    </form>
  );
}
