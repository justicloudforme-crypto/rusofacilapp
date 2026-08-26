"use client";

import { useEffect } from "react";

/**
 * Locks background scroll while `active` is true (open drawer, open
 * fullscreen search) — neither MobileMenu.tsx's bottom sheet nor Modal.tsx
 * did this before; the backdrop blocked taps but the page underneath could
 * still scroll on touch. Ref-counts via a data attribute so two consumers
 * open at once (in practice shouldn't happen, but cheap to make safe)
 * don't fight over restoring `overflow`.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const openCount = Number(body.dataset.scrollLockCount ?? "0") + 1;
    body.dataset.scrollLockCount = String(openCount);
    body.style.overflow = "hidden";
    return () => {
      const remaining = Number(body.dataset.scrollLockCount ?? "1") - 1;
      body.dataset.scrollLockCount = String(remaining);
      if (remaining <= 0) {
        delete body.dataset.scrollLockCount;
        body.style.overflow = previousOverflow;
      }
    };
  }, [active]);
}
