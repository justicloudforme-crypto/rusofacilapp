"use client";

import { useId, useRef, useState } from "react";
import type { GlossaryTermData } from "./GlossaryApp";
import GlossaryTermCardBody from "./GlossaryTermCardBody";
import GlossaryPopoverCard from "./GlossaryPopoverCard";
import { broadcastPopoverOpen, markTermSeen } from "@/lib/glossary-client";

/**
 * Wraps a piece of text (e.g. "aspecto perfectivo" inside a grammar
 * explanation) so tapping it shows a popover with the glossary definition —
 * the "всплывающие понятия" (pop-up concepts) piece of the planned
 * glossary feature. Not yet wired into any lesson content (that would mean
 * deciding how to auto-detect terms inside long prose blocks without
 * false-positive substring matches — a content-integration decision left
 * for a follow-up), but self-contained and ready to use anywhere a
 * specific term is already known statically, e.g.:
 *   <GlossaryTermTooltip slug="aspecto-perfectivo">aspecto perfectivo</GlossaryTermTooltip>
 *
 * Click-only (see GlossaryTermPopover's doc comment for why hover was
 * dropped) and lazy: only fetches the definition on first open, not on
 * page load.
 */
export default function GlossaryTermTooltip({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const [term, setTerm] = useState<GlossaryTermData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function ensureLoaded() {
    if (fetched || loading) return;
    setLoading(true);
    fetch(`/api/glossary/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { term?: GlossaryTermData } | null) => {
        setTerm(body?.term ?? null);
        setFetched(true);
        setLoading(false);
      })
      .catch(() => {
        setFetched(true);
        setLoading(false);
      });
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    ensureLoaded();
    markTermSeen(slug);
    broadcastPopoverOpen(id);
    setOpen(true);
  }

  return (
    <span className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="cursor-help border-b border-dotted border-foreground/40 font-medium text-foreground underline-offset-2 hover:border-foreground/70"
      >
        {children}
      </button>
      {open && (
        <GlossaryPopoverCard id={id} anchorRef={triggerRef} onRequestClose={() => setOpen(false)}>
          {loading && <span className="text-foreground/50">…</span>}
          {!loading && term && <GlossaryTermCardBody term={term} />}
          {!loading && !term && fetched && (
            <span className="text-foreground/50">Sin definición todavía.</span>
          )}
        </GlossaryPopoverCard>
      )}
    </span>
  );
}
