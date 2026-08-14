export type PlanId = "monthly" | "annual";

interface Plan {
  id: PlanId;
  priceId: string | undefined;
  durationDays: number;
}

export const plans: Record<PlanId, Plan> = {
  monthly: {
    id: "monthly",
    priceId: process.env.STRIPE_PRICE_MONTHLY,
    durationDays: 30,
  },
  annual: {
    id: "annual",
    priceId: process.env.STRIPE_PRICE_ANNUAL,
    durationDays: 365,
  },
};

export function isPlanId(value: string): value is PlanId {
  return value === "monthly" || value === "annual";
}
