import type { InputHTMLAttributes } from "react";

/**
 * The visual track is 24px tall (standard toggle proportions), but the
 * whole <label> row is min-h-11 (44px) — the tap target, not the visible
 * track, is what has to clear the mobile minimum.
 */
export default function Switch({
  label,
  className = "",
  disabled,
  ...rest
}: { label?: string; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <label
      className={`tap flex min-h-11 w-fit items-center gap-3 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${className}`}
    >
      <span className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full bg-neutral-300 transition-colors has-[:checked]:bg-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background dark:bg-neutral-600">
        <input type="checkbox" disabled={disabled} className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" {...rest} />
        <span className="pointer-events-none inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[1.375rem]" />
      </span>
      {label && <span className="text-sm font-medium">{label}</span>}
    </label>
  );
}
