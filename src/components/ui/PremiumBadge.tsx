import type { ReactNode } from "react";

/**
 * The ONLY place gold/premium-colored badge markup should be written.
 * Consolidates 8 hand-copied crown/star badges (3 of them byte-identical —
 * see AUDIT.md §3) into one component. Non-clickable by construction: it
 * renders a <span>, never a <button>/<a>, and `npm run check:tokens` fails
 * the build if a premium token ever ends up on an element with onClick/href.
 */
export default function PremiumBadge({
  icon = "👑",
  children,
  size = "md",
  className = "",
}: {
  icon?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const padding = size === "sm" ? "px-2 py-0.5 text-[0.7rem]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-premium-500/15 font-medium text-premium-700 dark:text-premium-300 ${padding} ${className}`}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}
