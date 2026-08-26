"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Bottom sheet below `sm`, centered dialog at `sm`+ — reuses the exact
 * fixed-inset-x-0-bottom-0 + rounded-t-3xl + max-h-[85dvh] + pb-safe
 * architecture MobileMenu.tsx already established (and already found the
 * "must portal to document.body, not render inline" bug for — see that
 * file's comment). closeLabel is required rather than defaulted to an
 * English string: this is a UI-kit primitive with no dictionary access of
 * its own, and CLAUDE.md's rule is no hardcoded text, not even in a
 * screen-reader-only aria-label.
 */
export default function Modal({
  open,
  onClose,
  title,
  closeLabel,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="animate-celebration-fade-in fixed inset-0 bg-black/25 backdrop-blur-[1px] dark:bg-black/50"
      />

      <div
        className={`sheet-slide-up fixed inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-primary/15 bg-background pb-safe shadow-[0_-8px_30px_-8px_rgba(27,20,15,0.25)] sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:w-full sm:max-w-md sm:rounded-3xl sm:border ${className}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 flex-shrink-0 rounded-full bg-foreground/15 sm:hidden" aria-hidden />

        {title && (
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="tap flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-neutral-200/60 active:bg-neutral-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
