import "server-only";
import { db } from "./db";
import { extendOrGrantSubscription } from "./subscription";
import { generateShortCode, isPlausibleShortCode } from "./short-code";

// Referrer gets a free-month extension the moment the person they referred
// completes their FIRST real checkout — see awardReferralRewardIfEligible.
export const REFERRAL_REWARD_DAYS = 30;

// Excludes visually ambiguous characters (0/O, 1/I/L) since this code is
// meant to be read aloud or typed by hand, not just clicked as a link.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 7;

export function generateReferralCode(): string {
  return generateShortCode(CODE_ALPHABET, CODE_LENGTH);
}

export function isPlausibleReferralCode(value: string): boolean {
  return isPlausibleShortCode(value, CODE_ALPHABET, CODE_LENGTH);
}

/** Returns the user's referral code, generating and persisting one on
 * first call. Lazy rather than assigned at signup: most accounts never
 * open the referral tab, so this avoids spending a code (and a
 * collision-retry loop) on every registration. A handful of retries is
 * plenty — the code space is 32^7, collisions are astronomically rare. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (user?.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // Unique constraint collision on referralCode — retry with a new one.
    }
  }
  throw new Error("Could not generate a unique referral code after 5 attempts");
}

/** Sticky "first touch" attribution: called once, right after a brand-new
 * account is created (never for the "claim an existing passwordless row"
 * path in /api/auth/register, which isn't really a new signup). A no-op
 * if the code doesn't resolve to a real user, resolves to the new user
 * themself, or the user already has an attribution (shouldn't happen for
 * a just-created row, but stays a no-op rather than overwriting either
 * way). Never throws — attribution is a nice-to-have, not something that
 * should be able to break registration. */
export async function captureReferralOnRegister(newUserId: string, rawCode: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  if (!isPlausibleReferralCode(code)) return;

  try {
    const referrer = await db.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!referrer || referrer.id === newUserId) return;

    await db.user.updateMany({
      where: { id: newUserId, referredByUserId: null },
      data: { referredByUserId: referrer.id },
    });
  } catch (error) {
    console.error("[referral] captureReferralOnRegister failed", error);
  }
}

/** Grants the referrer REFERRAL_REWARD_DAYS the moment the referred user
 * completes their first real subscription checkout. Idempotent via
 * ReferralReward.referredUserId's unique constraint — a duplicated Stripe
 * webhook delivery, or this being called from more than one checkout
 * entry point, can create at most one reward row per referred user. Call
 * this AFTER the referred user's own Subscription row is already written,
 * not before. */
export async function awardReferralRewardIfEligible(referredUserId: string): Promise<void> {
  const referred = await db.user.findUnique({
    where: { id: referredUserId },
    select: { referredByUserId: true },
  });
  const referrerUserId = referred?.referredByUserId;
  if (!referrerUserId) return;

  try {
    // The unique constraint on referredUserId is the real idempotency
    // guard; this create failing (duplicate) is the expected, harmless
    // outcome of a webhook firing twice for the same checkout.
    await db.referralReward.create({
      data: { referrerUserId, referredUserId, grantedDays: REFERRAL_REWARD_DAYS },
    });
  } catch {
    return; // already rewarded for this referral — nothing more to do
  }

  await extendOrGrantSubscription(referrerUserId, REFERRAL_REWARD_DAYS, "referral");
}

/** Fire-and-forget wrapper for checkout entry points: a referral-reward
 * bug must never fail the checkout flow itself. */
export async function awardReferralRewardSafely(referredUserId: string): Promise<void> {
  try {
    await awardReferralRewardIfEligible(referredUserId);
  } catch (error) {
    console.error("[referral] awardReferralRewardIfEligible failed", error);
  }
}

export interface ReferralStats {
  code: string;
  referredCount: number;
  rewardsEarnedCount: number;
}

/** Called unconditionally on every /profile render (see getUserBadgesForDisplay
 * for the same reasoning) — fails soft to null so a DB hiccup shows "try
 * again later" on the referral tab instead of 500ing the whole page. */
export async function getReferralStats(userId: string): Promise<ReferralStats | null> {
  try {
    const [code, referredCount, rewardsEarnedCount] = await Promise.all([
      getOrCreateReferralCode(userId),
      db.user.count({ where: { referredByUserId: userId } }),
      db.referralReward.count({ where: { referrerUserId: userId } }),
    ]);
    return { code, referredCount, rewardsEarnedCount };
  } catch (error) {
    console.error("[referral] getReferralStats failed", error);
    return null;
  }
}
