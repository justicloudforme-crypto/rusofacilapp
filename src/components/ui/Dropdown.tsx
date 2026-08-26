"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * The disclosure-panel interaction pattern ProfileMenu.tsx already had
 * (outside-click via pointerdown, Escape to close, close on route change) —
 * pulled out so PracticeMenu and the reworked LanguageSwitcher don't each
 * copy it a third time. ProfileMenu.tsx itself is rebuilt on this too.
 */
export default function Dropdown({
  trigger,
  children,
  align = "right",
  panelClassName = "",
  rootClassName = "",
}: {
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "left" | "right";
  panelClassName?: string;
  rootClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className={`relative ${rootClassName}`}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-50 mt-2 rounded-2xl border border-black/10 bg-background p-2 shadow-lg dark:border-white/10 ${
            align === "right" ? "right-0" : "left-0"
          } ${panelClassName}`}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
