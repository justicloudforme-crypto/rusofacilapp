"use client";

import { useState, type FormEvent } from "react";

export default function DeleteAccountForm({
  lang,
  warningLabel,
  passwordLabel,
  submitLabel,
  sentLabel,
  invalidPasswordLabel,
}: {
  lang: string;
  warningLabel: string;
  passwordLabel: string;
  submitLabel: string;
  sentLabel: string;
  invalidPasswordLabel: string;
}) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "invalid_password" | "error">("idle");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/auth/request-account-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, lang }),
      });
      if (res.ok) {
        setStatus("sent");
        setPassword("");
        return;
      }
      setStatus("invalid_password");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{sentLabel}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
      <p className="text-sm text-red-600 dark:text-red-400">{warningLabel}</p>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">{passwordLabel}</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setStatus("idle");
          }}
          className="rounded-lg border border-black/15 bg-white/60 px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-white/20 dark:bg-white/10"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "sending"}
          className="tap w-fit rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 active:bg-red-700 disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {status === "invalid_password" && (
          <span className="text-sm text-red-600 dark:text-red-400">{invalidPasswordLabel}</span>
        )}
      </div>
    </form>
  );
}
