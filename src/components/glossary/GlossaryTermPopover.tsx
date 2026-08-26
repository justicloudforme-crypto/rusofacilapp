"use client";

import { useId, useRef, useState } from "react";
import type { GlossaryTermData } from "./GlossaryApp";
import GlossaryTermCardBody from "./GlossaryTermCardBody";
import GlossaryPopoverCard from "./GlossaryPopoverCard";
import { broadcastPopoverOpen, markGlossaryDiscovered, markTermSeen } from "@/lib/glossary-client";

/** Wraps an already-known term occurrence (found by GlossaryText inside a
 * paragraph) so tapping the word shows the definition card — no fetch
 * needed, the data was already loaded in bulk by loadGlossaryTerms(). For
 * a single manually-placed term where the data isn't preloaded, use
 * GlossaryTermTooltip instead (lazy per-slug fetch).
 *
 * Click-only by design, not hover: a hover-to-open/mouseleave-to-close
 * interaction has an inherent gap the instant the cursor crosses from the
 * trigger word to the card itself (which lives in a portal, not inside the
 * trigger's own DOM), closing the card before the student can reach it to
 * scroll a long definition. Click also works identically on touch, so
 * there's one interaction model everywhere rather than two. All the
 * close-on-X behavior (outside click, Escape, scroll, another card
 * opening) lives in GlossaryPopoverCard.
 */
export default function GlossaryTermPopover({
  term,
  children,
  className,
}: {
  term: GlossaryTermData;
  children: React.ReactNode;
  /** Extra classes on the trigger button — lets a call site like
   * LessonGlossaryTerms render this as a chip instead of the default
   * inline dotted-underline word, without duplicating the open/close logic
   * above. */
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          markGlossaryDiscovered();
          markTermSeen(term.slug);
          if (open) {
            setOpen(false);
          } else {
            broadcastPopoverOpen(id);
            setOpen(true);
          }
        }}
        aria-expanded={open}
        className={
          className ??
          "tap cursor-help rounded-sm border-b border-dotted border-primary/50 font-medium text-inherit underline-offset-2 hover:border-primary active:border-primary dark:border-primary-400/60 dark:hover:border-primary-400 dark:active:border-primary-400"
        }
      >
        {children}
      </button>
      {open && (
        <GlossaryPopoverCard id={id} anchorRef={triggerRef} onRequestClose={() => setOpen(false)}>
          <GlossaryTermCardBody term={term} />
        </GlossaryPopoverCard>
      )}
    </span>
  );
}
