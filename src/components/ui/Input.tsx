import { forwardRef, type InputHTMLAttributes } from "react";

// text-base (16px), never text-sm — a <16px font-size on a focused input is
// what makes iOS Safari auto-zoom the page (see AUDIT.md §4, the single
// most widespread mobile bug found: nearly every form input in the app was
// text-sm). min-h-11 keeps the tap target >=44px regardless of padding.
const INPUT_BASE =
  "min-h-11 w-full rounded-lg border bg-transparent px-3 py-2 text-base outline-none transition-colors " +
  "focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }
>(({ label, error, hint, id, className = "", ...rest }, ref) => {
  const inputId = id ?? (rest.name as string | undefined);
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={inputId}>
      {label && <span className="font-medium">{label}</span>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`${INPUT_BASE} ${
          error ? "border-danger focus-visible:border-danger" : "border-primary/20 focus-visible:border-primary"
        } ${className}`}
        {...rest}
      />
      {error && (
        <span id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </span>
      )}
      {!error && hint && (
        <span id={`${inputId}-hint`} className="text-xs text-foreground/50">
          {hint}
        </span>
      )}
    </label>
  );
});
Input.displayName = "Input";

export default Input;
