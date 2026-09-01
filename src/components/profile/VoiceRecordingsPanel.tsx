"use client";

import { useEffect, useState } from "react";
import {
  MAX_RECORDINGS,
  deleteAllRecordings,
  formatBytes,
  usageFor,
  type StorageUsage,
} from "@/lib/voice-recordings-store";
import type { Locale } from "@/i18n/config";
import { plural, type PluralForms } from "@/lib/plural";

/**
 * How much of THIS device the student's practice recordings are using, and
 * the button that removes them.
 *
 * It has to be a client component and it has to be here rather than on the
 * server, because the data it reports does not exist on any server: since
 * 30.08.2026 a recording never leaves the browser it was made in (see
 * src/lib/voice-recordings-store.ts). That also means the figure describes
 * the device being looked at and no other — a student who recorded on
 * their phone sees zero on their laptop, which is the truth and is worth
 * saying, so `deviceNote` does.
 *
 * Every string arrives as a prop from the page's dictionary. Nothing here
 * is written in a language.
 */
export default function VoiceRecordingsPanel({
  ownerScope,
  locale,
  heading,
  description,
  deviceNote,
  usageLabel,
  emptyLabel,
  deleteLabel,
  deletedLabel,
  unavailableLabel,
}: {
  ownerScope: string;
  locale: Locale;
  heading: string;
  description: string;
  deviceNote: string;
  /** Carries {count}, {max} and {size}. */
  /** "{count} de {max} grabaciones" — agrees with {max}, the number the
   * noun stands next to. */
  usageLabel: PluralForms;
  emptyLabel: string;
  deleteLabel: string;
  /** Carries {count}. */
  /** Agrees with {count}. */
  deletedLabel: PluralForms;
  unavailableLabel: string;
}) {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [deleted, setDeleted] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    usageFor(ownerScope)
      .then((result) => {
        if (!cancelled) setUsage(result);
      })
      .catch(() => {
        // Storage that will not open reads the same as "nothing stored"
        // from the outside, and the difference matters: one means there is
        // nothing to delete, the other means we cannot tell.
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerScope, deleted]);

  async function handleDelete() {
    try {
      const removed = await deleteAllRecordings(ownerScope);
      setDeleted(removed);
    } catch {
      setUnavailable(true);
    }
  }

  return (
    <div className="border-t border-black/10 pt-5 dark:border-white/30">
      <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">{heading}</span>
      <p className="mt-1 text-sm text-foreground/60">{description}</p>
      <p className="mt-1 text-sm text-foreground/60">{deviceNote}</p>

      {unavailable ? (
        <p className="mt-3 text-sm text-foreground/60">{unavailableLabel}</p>
      ) : usage === null ? (
        // No skeleton: an IndexedDB read of a few dozen rows resolves in a
        // frame or two, and a flashing placeholder would be the slowest
        // thing on screen.
        <p className="mt-3 text-sm text-foreground/40">·</p>
      ) : usage.count === 0 ? (
        <p className="mt-3 text-sm text-foreground/60">{emptyLabel}</p>
      ) : (
        <p className="mt-3 text-sm">
          {plural(locale, MAX_RECORDINGS, usageLabel, {
            count: usage.count,
            max: MAX_RECORDINGS,
            size: formatBytes(usage.bytes, locale),
          })}
        </p>
      )}

      {deleted !== null && (
        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
          {plural(locale, deleted, deletedLabel, { count: deleted })}
        </p>
      )}

      <button
        type="button"
        onClick={handleDelete}
        disabled={unavailable || !usage || usage.count === 0}
        className="tap mt-3 rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
      >
        {deleteLabel}
      </button>
    </div>
  );
}
