export interface TrustStripItem {
  value: string;
  label: string;
}

// Plain real numbers, no "+" rounding — an exact count reads as more
// trustworthy than a rounded-up estimate (explicit product decision).
export default function TrustStrip({ items }: { items: TrustStripItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="text-center sm:text-left">
          <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
          <p className="text-sm text-foreground/60">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
