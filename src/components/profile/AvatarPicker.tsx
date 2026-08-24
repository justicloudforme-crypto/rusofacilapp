"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CHARACTERS, avatarIdsForCharacter, type AvatarId, type Character } from "@/lib/avatars";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

// Tapping the current avatar opens a modal grouped by character, rather
// than showing all variants flat on the page — with 6 characters × a few
// expressions each, a permanently-visible flat grid would be the same
// "wall of near-identical dolls" clutter this replaced, just bigger.
export default function AvatarPicker({
  initialAvatarId,
  labels,
  characterLabels,
  modalTitle,
  changeHint,
  closeLabel,
}: {
  initialAvatarId: AvatarId;
  labels: Record<AvatarId, string>;
  characterLabels: Record<Character, string>;
  modalTitle: string;
  changeHint: string;
  closeLabel: string;
}) {
  const router = useRouter();
  const [avatarId, setAvatarId] = useState(initialAvatarId);
  const [saving, setSaving] = useState<AvatarId | null>(null);
  const [open, setOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function selectAvatar(next: AvatarId) {
    if (next === avatarId) {
      setOpen(false);
      return;
    }
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
      setOpen(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 900);
      router.refresh();
    } catch {
      setAvatarId(previous);
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center gap-3 rounded-2xl border border-brand/15 bg-brand/5 p-3 pr-4 transition-colors hover:bg-brand/10"
      >
        <span className={justSaved ? "folk-spark-pop" : undefined}>
          <MatryoshkaAvatar id={avatarId} size={56} label={labels[avatarId]} />
        </span>
        <span className="flex flex-col items-start">
          <span className="text-sm font-medium">{labels[avatarId]}</span>
          <span className="font-mono text-xs text-brand">{changeHint}</span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            className="animate-celebration-fade-in fixed inset-0 bg-black/25 backdrop-blur-[1px] dark:bg-black/50"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={modalTitle}
            className="celebration-panel relative flex max-h-[85dvh] w-full flex-col rounded-t-3xl border border-brand/15 bg-background p-5 shadow-[0_-8px_30px_-8px_rgba(36,28,21,0.25)] sm:max-w-md sm:rounded-3xl sm:shadow-[0_1px_2px_rgba(36,28,21,0.06),0_8px_24px_-12px_rgba(36,28,21,0.35)]"
          >
            <div className="mx-auto mb-3 h-1 w-9 flex-shrink-0 rounded-full bg-foreground/15 sm:hidden" aria-hidden />
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold">{modalTitle}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-foreground/10"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
              {CHARACTERS.map((character) => (
                <div key={character} className="mb-4">
                  <p className="mb-2 font-mono text-[0.65rem] font-medium uppercase tracking-wider text-foreground/45">
                    {characterLabels[character]}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {avatarIdsForCharacter(character).map((id) => (
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
                        <MatryoshkaAvatar id={id} size={48} label={labels[id]} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
