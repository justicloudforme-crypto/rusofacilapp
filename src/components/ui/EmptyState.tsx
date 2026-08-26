import type { ReactNode } from "react";

/**
 * AUDIT.md found /word-games rendering a silent empty grid (zero tiles, no
 * message) when a level/type combination has no puzzles yet — this is the
 * shared component to fill that and similar gaps.
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border border-black/10 px-6 py-10 text-center dark:border-white/30 ${className}`}
    >
      {icon && (
        <div className="mb-1 text-4xl" aria-hidden>
          {icon}
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-foreground/60">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
