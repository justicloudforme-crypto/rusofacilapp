"use client";

import { useEffect, useState } from "react";
import { isGlossaryDiscovered, markGlossaryDiscovered } from "@/lib/glossary-client";
import type { Dictionary } from "@/i18n/dictionaries";

/** Its four strings used to be Spanish literals inside this file, so a
 * student reading the Russian interface got a Spanish onboarding nudge on
 * every lesson's grammar tab. Same class as debt 16, one level down: not a
 * key left untranslated in the dictionary, but a string that never reached
 * the dictionary at all. Enforced by src/lib/ui-strings.test.ts. */
type GlossaryHintDict = Dictionary["lesson"]["glossaryHint"];

/**
 * One-time onboarding nudge so a student learning fully on their own (no
 * teacher — see the platform's core philosophy) discovers that highlighted
 * grammar terms are clickable, without anyone telling them. Shows a live
 * preview of the exact visual style GlossaryTermPopover uses (dotted
 * underline), so the hint teaches by demonstrating, not just describing.
 * Dismissible, and permanently gone the moment the student actually clicks
 * a real term anywhere (see GlossaryTermPopover) — whichever happens
 * first is enough, no need to keep nagging after that.
 */
export default function GlossaryHint({ dict }: { dict: GlossaryHintDict }) {
  // Starts hidden on both server and first client render (matches SSR
  // output, no hydration mismatch); corrected right after mount once
  // localStorage is readable.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!isGlossaryDiscovered());
  }, []);

  if (!visible) return null;

  function dismiss() {
    markGlossaryDiscovered();
    setVisible(false);
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5 text-xs leading-5 text-foreground/70 dark:border-primary-400/25 dark:bg-primary-400/[0.06]">
      <span className="flex-1">
        {dict.intro}{" "}
        <span className="cursor-help rounded-sm border-b border-dotted border-primary/50 font-medium text-foreground dark:border-primary-400/60">
          {dict.sample}
        </span>{" "}
        {dict.rest}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={dict.dismissLabel}
        className="tap flex-shrink-0 text-foreground/40 transition-colors hover:text-foreground active:text-foreground"
      >
        ×
      </button>
    </div>
  );
}
