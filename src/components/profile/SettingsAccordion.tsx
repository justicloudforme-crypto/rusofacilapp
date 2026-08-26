"use client";

import { useState, type ReactNode } from "react";

export interface AccordionSection {
  id: string;
  icon: ReactNode;
  heading: string;
  content: ReactNode;
}

// Groups the old personal/avatar/appearance/language/security tabs into one
// "Settings" tab, one section open at a time — these are opened rarely
// (once per account, per the 2026-08-26 /profile redesign brief), unlike
// progress which is checked daily, so they no longer need their own top-
// level tab slots.
export default function SettingsAccordion({
  sections,
  defaultOpenId,
}: {
  sections: AccordionSection[];
  defaultOpenId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? sections[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-3">
      {sections.map((section) => {
        const open = section.id === openId;
        return (
          <div key={section.id} className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/30">
            <button
              type="button"
              className="tap flex min-h-11 w-full items-center gap-2.5 px-5 py-4 text-left transition-colors hover:bg-black/[.02] active:bg-black/[.02] dark:hover:bg-white/[.04] dark:active:bg-white/[.04]"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : section.id)}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-text">
                {section.icon}
              </span>
              <h2 className="flex-1 font-serif text-lg font-semibold text-foreground">{section.heading}</h2>
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className={`h-5 w-5 flex-shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
              >
                <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {open && <div className="border-t border-black/10 p-5 dark:border-white/30 sm:p-6">{section.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
