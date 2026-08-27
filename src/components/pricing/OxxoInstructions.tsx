import { CashGlyph } from "./PaymentMethodLogos";

export interface OxxoInstructionsDict {
  oxxoStepsHeading: string;
  oxxoStep1: string;
  oxxoStep2: string;
  oxxoStep3: string;
  oxxoStep4: string;
  oxxoEmailNote: string;
  oxxoExpiryNote: string;
}

/**
 * Always visible under the "cash" method's CTA — NOT a collapsible
 * <details> (a real, reported problem: a Mexican visitor didn't understand
 * what to do next after choosing cash, and a summary/accordion that
 * defaults closed is exactly the kind of thing an unfamiliar or anxious
 * visitor skips over before paying). The 3-day expiry mirrors
 * `expires_after_days: 3` in /api/checkout's oxxo branch — keep these in
 * sync if that ever changes.
 */
export default function OxxoInstructions({ dict }: { dict: OxxoInstructionsDict }) {
  const steps = [dict.oxxoStep1, dict.oxxoStep2, dict.oxxoStep3, dict.oxxoStep4];
  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-foreground/[0.03] p-3 text-xs text-foreground/70 dark:border-white/15">
      <p className="flex items-center gap-1.5 font-medium text-foreground/85">
        <CashGlyph />
        {dict.oxxoStepsHeading}
      </p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[0.65rem] font-semibold">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-foreground/50">{dict.oxxoEmailNote}</p>
      <p className="mt-1 text-foreground/50">{dict.oxxoExpiryNote}</p>
    </div>
  );
}
