"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * What a person sees on the page they land on after paying.
 *
 * Until now this page said one thing after a card payment — "payment
 * confirmed, your subscription is active" — and said it whether or not the
 * access had actually been granted. Between 24.08.2026 and 30.08.2026 that
 * sentence was, for anyone who bought Premium on top of an existing plan,
 * simply untrue (PROGRESS.md 7.55): they had paid, they had been
 * congratulated, and the content was still locked. The failure reached
 * Sentry after 7.58, which tells us. It still told the buyer nothing.
 *
 * So the banner is decided by the tier the account actually holds, not by
 * having arrived here with `?checkout=success`.
 *
 * The waiting state is the reason this is a client component at all. Stripe
 * redirects the browser back the instant the payment settles, and the
 * webhook that grants the access is a separate delivery that can land a
 * second or two later — so "not granted yet" at first render is normal, and
 * shouting about a lost payment at that moment would be a false alarm on
 * every healthy purchase. It re-asks the server a few times, spaced out,
 * and only says something is wrong once the grant has had a fair chance to
 * arrive. router.refresh() re-runs the page on the server, so each retry
 * reads the database again — there is no separate status endpoint to keep
 * in sync with the page's own rule.
 */

/** Roughly 20 seconds in total, front-loaded: a webhook that is coming at
 * all almost always arrives in the first seconds, and a buyer staring at a
 * spinner should not do so for longer than it takes to be sure. */
const RETRY_DELAYS_MS = [1_500, 3_000, 5_000, 10_000];

/**
 * Did the account get what was just paid for? The one rule, kept next to
 * the banner that states it rather than inline in the page, so the promise
 * on screen and the check behind it cannot drift apart.
 *
 * A Premium purchase has to have produced the premium tier specifically —
 * "standard" is exactly the wrong answer that the 7.55 defect produced and
 * that the old banner called success. Any other paid plan promises access,
 * not a particular tier, so any live tier satisfies it.
 */
export function checkoutDeliveredWhatWasPaidFor(
  paidPlan: string | null,
  tier: "free" | "standard" | "premium"
): boolean {
  return paidPlan === "lifetime" ? tier === "premium" : tier !== "free";
}

export interface CheckoutOutcomeNoticeProps {
  /** True when the account already holds what was paid for. */
  granted: boolean;
  strings: {
    /** Shown when granted. */
    success: string;
    /** Shown while the grant may still be in flight. */
    verifying: string;
    /** Shown when it never arrived. Must name the support address. */
    notApplied: string;
    supportEmail: string;
    supportEmailLabel: string;
  };
}

export function CheckoutOutcomeNotice({ granted, strings }: CheckoutOutcomeNoticeProps) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  // A ref, not state: it must survive the re-render router.refresh() causes
  // without restarting the countdown it is counting.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (granted || attempt >= RETRY_DELAYS_MS.length) return;
    timer.current = setTimeout(() => {
      setAttempt((n) => n + 1);
      router.refresh();
    }, RETRY_DELAYS_MS[attempt]);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [granted, attempt, router]);

  if (granted) {
    return (
      <p className="mt-6 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
        {strings.success}
      </p>
    );
  }

  if (attempt < RETRY_DELAYS_MS.length) {
    return (
      <p
        className="mt-6 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400"
        aria-live="polite"
      >
        {strings.verifying}
      </p>
    );
  }

  return (
    <div
      className="mt-6 flex flex-col gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
      role="alert"
      data-testid="checkout-not-applied"
    >
      <p>{strings.notApplied}</p>
      <a className="font-semibold underline underline-offset-2" href={`mailto:${strings.supportEmail}`}>
        {strings.supportEmailLabel}
      </a>
    </div>
  );
}
