export type SkeletonVariant = "text" | "circle" | "rect";

const VARIANT_DEFAULTS: Record<SkeletonVariant, string> = {
  text: "h-4 w-full rounded-md",
  circle: "h-10 w-10 rounded-full",
  rect: "h-24 w-full rounded-xl",
};

/**
 * Loading placeholder. AUDIT.md found no loading state at all on /profile,
 * /vocabulary, /stories, or /pricing — this is the shared piece for filling
 * that gap. motion-reduce:animate-none respects the OS reduce-motion
 * setting (the pulse is decorative, not information-bearing).
 */
export default function Skeleton({
  variant = "text",
  className = "",
}: {
  variant?: SkeletonVariant;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`motion-reduce:animate-none animate-pulse bg-neutral-200 dark:bg-neutral-700/50 ${VARIANT_DEFAULTS[variant]} ${className}`}
    />
  );
}
