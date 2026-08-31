/**
 * Shape check for the Stripe environment variables.
 *
 * READ THIS FIRST: the story this file was written from was wrong, and the
 * correction matters for what you should expect of it.
 *
 * It was built on 2026-08-31 in the belief that `STRIPE_PRICE_LIFETIME` had
 * held a copy of the live secret key (`sk_live_…`). It had not. The Stripe
 * request log, read the same day, shows the failing POST /v1/checkout/sessions
 * carrying `"price": "price_1U86EtDP0jFvlr1mH1ANUlOE"` — the id of the 169,99
 * Price, archived on 26.08 — and Stripe answering `400 — The price specified
 * is inactive`. A properly formed Price id for a dead price. The earlier
 * reading came from one look at the Vercel dashboard, where the greyed
 * `sk_live_…` in an empty Edit field is a placeholder, not the stored value.
 * PROGRESS.md 7.66 has the whole correction.
 *
 * So: EVERY RULE IN THIS FILE WOULD HAVE PASSED THE DEFECT IT WAS WRITTEN
 * FOR. It is still worth keeping — a secret or a Product id in a price slot
 * is a real way to break a checkout, and this is the only check that can run
 * where the values are legible — but it is a shape check and nothing more.
 * Authenticity (live? right amount? right currency?) can only be answered by
 * Stripe, and is answered in src/lib/stripe-price-health.ts.
 *
 * Why the check has to live inside the process at all. The variables are
 * marked Sensitive: `vercel env pull` returns `[SENSITIVE]`, the dashboard
 * shows `Hidden`, and the value is in no file in this repository. Every audit
 * this project ran could see a variable's NAME and its timestamps and nothing
 * else. The only place a value is legible is a process it was injected into.
 *
 * DELIBERATELY NOT VALIDATED: anything past the prefix. It cannot tell a live
 * key from a test one, a live Price from an archived one, or 122,99 from
 * 169,99.
 *
 * NEVER PRINTS A VALUE. The reports below name the variable, the prefix that
 * was expected, and — when the value carries a prefix Stripe is known to
 * issue — what kind of object it looks like instead. Nothing else leaves this
 * module: a build log and a Sentry event are both places a secret must not
 * end up, and the whole point of the check is to run where the secret is.
 */

export interface StripeEnvRule {
  /** Exact variable name, or a prefix match when `family` is true. */
  name: string;
  /** The literal prefix every valid value carries. */
  expectedPrefix: string;
  /** Human name of the object, used in the failure message. */
  what: string;
  /**
   * When true, `name` is a prefix: every variable in the environment whose
   * key starts with it is checked. `STRIPE_PRICE_*` is a family because the
   * plan list grows — a future `STRIPE_PRICE_TEAM` must be covered the day it
   * is created, not the day someone remembers to add it here.
   */
  family?: boolean;
}

export const STRIPE_ENV_RULES: readonly StripeEnvRule[] = [
  { name: "STRIPE_PRICE_", expectedPrefix: "price_", what: "a Stripe Price id", family: true },
  { name: "STRIPE_SECRET_KEY", expectedPrefix: "sk_", what: "a Stripe secret key" },
  { name: "STRIPE_PUBLISHABLE_KEY", expectedPrefix: "pk_", what: "a Stripe publishable key" },
  { name: "STRIPE_WEBHOOK_SECRET", expectedPrefix: "whsec_", what: "a Stripe webhook signing secret" },
];

/**
 * Prefixes Stripe is known to issue, longest first so `sk_` never shadows a
 * longer match. Used only to say what a wrong value *looks like* — naming the
 * mistake ("this is a secret key") is the difference between a message that
 * ends the investigation and one that starts it.
 */
const KNOWN_STRIPE_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["whsec_", "a webhook signing secret"],
  ["price_", "a Price id"],
  ["prod_", "a Product id"],
  ["cs_", "a Checkout Session id"],
  ["sub_", "a Subscription id"],
  ["cus_", "a Customer id"],
  ["pi_", "a PaymentIntent id"],
  ["rk_", "a restricted API key"],
  ["sk_", "a SECRET API key"],
  ["pk_", "a publishable API key"],
];

export type StripeEnvProblemKind = "empty" | "wrong-prefix" | "duplicate-value";

export interface StripeEnvProblem {
  kind: StripeEnvProblemKind;
  /** The variable at fault. For "duplicate-value", the second of the pair. */
  name: string;
  expectedPrefix: string;
  what: string;
  /** What the value appears to be instead, when recognisable. Never the value. */
  looksLike?: string;
  /** For "duplicate-value": the other variable holding the identical value. */
  sharesValueWith?: string;
}

function describeValue(value: string): string | undefined {
  for (const [prefix, description] of KNOWN_STRIPE_PREFIXES) {
    if (value.startsWith(prefix)) return `${description} (${prefix}…)`;
  }
  return undefined;
}

function rulesFor(key: string): StripeEnvRule | undefined {
  return STRIPE_ENV_RULES.find((rule) =>
    rule.family ? key.startsWith(rule.name) : key === rule.name
  );
}

/**
 * Returns every variable in `env` that is set to something of the wrong
 * shape. An ABSENT variable is not a problem here: this project runs without
 * Stripe credentials locally and in CI by design (see
 * src/app/api/checkout/route.ts — a missing price id is already handled, and
 * on a deployment already refuses the sale rather than granting it free).
 * What is checked is the case a missing-value check cannot see: a variable
 * that is present, non-empty, and holding the wrong kind of thing.
 */
export function checkStripeEnvShapes(env: Record<string, string | undefined>): StripeEnvProblem[] {
  const problems: StripeEnvProblem[] = [];
  const keys = Object.keys(env)
    .filter((key) => rulesFor(key) !== undefined)
    .sort();

  for (const key of keys) {
    const rule = rulesFor(key);
    if (!rule) continue;
    const raw = env[key];
    if (raw === undefined) continue;
    const value = raw.trim();

    if (value === "") {
      problems.push({ kind: "empty", name: key, expectedPrefix: rule.expectedPrefix, what: rule.what });
      continue;
    }

    if (!value.startsWith(rule.expectedPrefix)) {
      problems.push({
        kind: "wrong-prefix",
        name: key,
        expectedPrefix: rule.expectedPrefix,
        what: rule.what,
        looksLike: describeValue(value),
      });
    }
  }

  // Second net: a value COPIED from one variable into another. The prefix
  // rule only catches such a copy when the two slots expect different
  // prefixes. Two variables of the same family are not so lucky —
  // STRIPE_PRICE_MONTHLY and STRIPE_PRICE_LIFETIME holding the same Price id
  // pass every prefix rule and would silently sell the wrong plan. Values are
  // compared to each other, never printed.
  const byValue = new Map<string, string>();
  for (const key of keys) {
    const value = (env[key] ?? "").trim();
    if (value === "") continue;
    const first = byValue.get(value);
    if (first === undefined) {
      byValue.set(value, key);
      continue;
    }
    const rule = rulesFor(key);
    problems.push({
      kind: "duplicate-value",
      name: key,
      expectedPrefix: rule?.expectedPrefix ?? "",
      what: rule?.what ?? "a Stripe value",
      sharesValueWith: first,
    });
  }

  return problems;
}

/** True when `value` is usable as the Stripe object `rule` describes. */
export function hasStripeShape(name: string, value: string | undefined): boolean {
  const rule = rulesFor(name);
  if (!rule) return value !== undefined && value.trim() !== "";
  if (value === undefined) return false;
  return value.trim().startsWith(rule.expectedPrefix);
}

/** Multi-line, human-first report. Contains no environment variable values. */
export function formatStripeEnvProblems(problems: readonly StripeEnvProblem[]): string {
  const lines = [
    `Stripe environment variables are the wrong shape (${problems.length} problem${
      problems.length === 1 ? "" : "s"
    }).`,
    "",
  ];

  for (const problem of problems) {
    if (problem.kind === "empty") {
      lines.push(
        `  ${problem.name} is set but empty. Expected ${problem.what}, i.e. a value starting with "${problem.expectedPrefix}".`
      );
    } else if (problem.kind === "duplicate-value") {
      lines.push(
        `  ${problem.name} holds exactly the same value as ${problem.sharesValueWith}. ` +
          `Two Stripe variables never legitimately share a value — one of them was copied into the wrong slot.`
      );
    } else {
      lines.push(
        `  ${problem.name} does not start with "${problem.expectedPrefix}". Expected ${problem.what}` +
          (problem.looksLike ? `; the value looks like ${problem.looksLike} instead.` : ".")
      );
    }
  }

  lines.push(
    "",
    "No value is printed above, on purpose — these variables are Sensitive and this",
    "message goes to build logs and to Sentry. Fix them in the Vercel dashboard",
    "(Project → Settings → Environment Variables) and redeploy.",
    "",
    "This is a SHAPE check only — it cannot tell a live Price from an archived one.",
    "That question is answered by GET /api/admin/stripe-health and by the hourly cron",
    "(src/lib/stripe-price-health.ts), which ask Stripe itself. See PROGRESS.md 7.66."
  );

  return lines.join("\n");
}
