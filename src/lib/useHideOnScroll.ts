"use client";

import { useEffect, useState } from "react";

const HIDE_THRESHOLD_PX = 12;
const TOP_BUFFER_PX = 80;

/**
 * True once the user has scrolled down past a small net threshold (not
 * hidden on every 1-2px of scroll jitter from a finger resting on the
 * screen), false again once they scroll up past the same threshold, and
 * always false near the top of the page. Returns false unconditionally
 * (bar never hides) when the OS prefers-reduced-motion is set — hiding a
 * fixed nav bar is itself a motion effect, not just a CSS transition to
 * strip, so this skips the behavior entirely rather than making it instant.
 */
export function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lastY = window.scrollY;
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (Math.abs(delta) > HIDE_THRESHOLD_PX) {
          setHidden(delta > 0 && y > TOP_BUFFER_PX);
          lastY = y;
        }
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}
