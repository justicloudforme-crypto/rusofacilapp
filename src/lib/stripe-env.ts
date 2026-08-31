/**
 * Shape check for the Stripe environment variables.
 *
 * Why this file exists. On 2026-08-24 22:36 UTC the Production variable
 * `STRIPE_PRICE_LIFETIME` was created on Vercel holding, instead of a Price
 * id, a copy of the live Stripe secret key (`sk_live_…`). The key itself was
 * not lost — `STRIPE_SECRET_KEY` still held it, so cards, subscriptions and
 * webhooks all kept working — it was *duplicated into the wrong slot*. The
 * effect was narrow and total: every lifetime checkout asked Stripe for a
 * Price whose id was a secret key, and no such Price exists, so the Premium
 * purchase could not complete even once. It ran that way for 6 days 6 hours,
 * until 2026-08-31 04:38 UTC.
 *
 * Nothing caught it, and nothing could have. The variable is marked
 * Sensitive: `vercel env pull` returns `[SENSITIVE]`, the Vercel dashboard
 * shows `Hidden`, and the value is in no file in this repository. Every audit
 * this project ran could see the variable's NAME and its timestamps and
 * nothing else — which is exactly what PROGRESS.md 7.12 №27 recorded, and
 * why it recorded the wrong suspect (an archived 169,99 Price).
 *
 * The only place the value is legible is inside a process that has it in
 * `process.env`. So the check lives there, and it checks the one property
 * that can be verified without ever reading the secret out loud: the prefix
 * Stripe puts on every identifier it issues.
 *
 * DELIBERATELY NOT VALIDATED: anything past the prefix. This is a shape
 * check, not a credential check — it cannot tell a live key from a test one,
 * a real Price from a deleted one, or 122,99 from 169,99. Those need Stripe
 * itself. What it *can* do is refuse a value that is categorically the wrong
 * kind of thing, which is the entire failure above.
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

  // Second net, aimed at the failure that actually happened rather than at
  // its symptom. The 24.08 defect was a value COPIED from one variable into
  // another; the prefix rule catches it because a secret key and a Price id
  // happen to have different prefixes. Two variables of the same family
  // would not be so lucky — STRIPE_PRICE_MONTHLY and STRIPE_PRICE_LIFETIME
  // holding the same Price id both pass every prefix rule and would silently
  // sell the wrong plan. Values are compared to each other, never printed.
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
    "This check exists because on 2026-08-24 STRIPE_PRICE_LIFETIME was given a copy",
    "of the live secret key instead of a Price id. Every lifetime purchase failed for",
    "six days and no audit could see it: the value is unreadable from the repository",
    "and from the dashboard alike. See PROGRESS.md 7.63."
  );

  return lines.join("\n");
}
