"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY_POPOVER_OPEN_EVENT } from "@/lib/glossary-client";

const CARD_WIDTH = 320;
const GAP = 8;
const MAX_CARD_HEIGHT = 360;

/**
 * Shared floating-card renderer for GlossaryTermPopover and
 * GlossaryTermTooltip. Rendered through a portal into `document.body` with
 * `position: fixed`, computed from the trigger's own bounding rect —
 * deliberately NOT `position: absolute` inside the trigger's own DOM
 * subtree, because several call sites (e.g. LessonGlossaryTerms' scrollable
 * chip list) sit inside an `overflow-y-auto` ancestor that would otherwise
 * clip the card.
 *
 * Owns ALL of its own close behavior (outside click, Escape, mutual
 * exclusion, ancestor scroll) rather than leaving it to each caller, for
 * one specific reason: because this card lives in a portal — physically
 * outside the trigger's DOM subtree — a naive "outside click" check against
 * only the trigger's ref would treat every click *inside this card itself*
 * (a related-lesson link, the speak button, selecting text) as "outside"
 * and close it before the click could register. Centralizing the check
 * here, against both the trigger AND this card's own ref, fixes that once
 * for every call site instead of once per call site. The same reasoning
 * applies to scroll: a naive window-level "any scroll closes the card"
 * listener also fires for scrolling *inside* the card's own definition
 * text (mouse wheel), which would make the card impossible to read past
 * its visible height — `onScroll` below explicitly ignores scroll events
 * whose target is inside this card.
 */
export default function GlossaryPopoverCard({
  id,
  anchorRef,
  onRequestClose,
  children,
}: {
  /** Unique id for this popover instance (e.g. from useId()) — broadcast
   * via GLOSSARY_POPOVER_OPEN_EVENT on open, and used here to close this
   * card if a *different* id's card opens, so only one is ever visible. */
  id: string;
  anchorRef: RefObject<HTMLElement | null>;
  onRequestClose: () => void;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<{
    top: number;
    left: number;
    width: number;
    tailLeft: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(window.innerWidth - GAP * 2, CARD_WIDTH);
    const anchorCenter = rect.left + rect.width / 2;
    const left = Math.max(GAP, Math.min(anchorCenter - width / 2, window.innerWidth - width - GAP));
    // The card can get pushed off-center from the trigger near a viewport
    // edge (clamped above) — the tail must track the trigger's real
    // position within the card, not just sit at the card's midpoint,
    // otherwise it points at the wrong word once clamping kicks in.
    const tailLeft = Math.max(12, Math.min(anchorCenter - left, width - 12));
    // The card opens upward from `top` (translateY(-100%) below), so its
    // available room is the space between the trigger and the top of the
    // viewport, also capped relative to viewport height so it can't eat
    // most of a short mobile screen. Long content scrolls inside the card
    // (see the inner div below) rather than growing past this cap.
    const maxHeight = Math.max(120, Math.min(MAX_CARD_HEIGHT, window.innerHeight * 0.5, rect.top - GAP * 2));
    setStyle({ top: rect.top - GAP, left, width, tailLeft, maxHeight });
    // Recompute fresh each time this mounts (i.e. each time the popover
    // opens) — anchorRef's identity is stable, so this intentionally only
    // depends on the mount itself.
  }, [anchorRef]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      const insideAnchor = anchorRef.current?.contains(target) ?? false;
      const insideCard = cardRef.current?.contains(target) ?? false;
      if (!insideAnchor && !insideCard) onRequestClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onRequestClose();
    }
    function onOtherOpen(e: Event) {
      if ((e as CustomEvent<{ id: string }>).detail?.id !== id) onRequestClose();
    }
    function onScroll(e: Event) {
      // A stale-positioned card floating over unrelated content after the
      // PAGE scrolls is worse than just closing it — but scrolling *inside*
      // this card (reading a long definition) must never close it.
      if (cardRef.current?.contains(e.target as Node)) return;
      onRequestClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(GLOSSARY_POPOVER_OPEN_EVENT, onOtherOpen);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onRequestClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(GLOSSARY_POPOVER_OPEN_EVENT, onOtherOpen);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onRequestClose);
    };
  }, [id, anchorRef, onRequestClose]);

  if (!style || typeof document === "undefined") return null;

  return createPortal(
    <span
      ref={cardRef}
      role="tooltip"
      style={{
        position: "fixed",
        top: style.top,
        left: style.left,
        width: style.width,
        transform: "translateY(-100%)",
      }}
      className="z-50 block rounded-xl border border-black/10 bg-background text-left text-xs shadow-lg dark:border-white/15"
    >
      <span
        style={{ maxHeight: style.maxHeight }}
        className="block overflow-y-auto overscroll-contain rounded-xl p-3.5"
      >
        {children}
      </span>
      {/* Tail pointing down at the trigger word — makes the card-to-word
       * link unambiguous at a glance, especially once several terms sit
       * close together (see the mutual-exclusion/clipping fix above). */}
      <span
        aria-hidden
        style={{ left: style.tailLeft }}
        className="absolute -bottom-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-black/10 bg-background dark:border-white/15"
      />
    </span>,
    document.body,
  );
}
