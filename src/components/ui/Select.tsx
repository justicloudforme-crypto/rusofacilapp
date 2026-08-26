import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";

const SELECT_BASE =
  "min-h-11 w-full appearance-none rounded-lg border bg-transparent px-3 py-2 pr-9 text-base outline-none transition-colors " +
  "focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; children: ReactNode }
>(({ label, error, id, className = "", children, ...rest }, ref) => {
  const selectId = id ?? (rest.name as string | undefined);

  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={selectId}>
      {label && <span className="font-medium">{label}</span>}
      <span className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          className={`${SELECT_BASE} ${
            error ? "border-danger focus-visible:border-danger" : "border-primary/20 focus-visible:border-primary"
          } ${className}`}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50"
          viewBox="0 0 20 20"
          fill="none"
        >
          <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
});
Select.displayName = "Select";

export default Select;
