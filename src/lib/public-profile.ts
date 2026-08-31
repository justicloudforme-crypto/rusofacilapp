import "server-only";
import { db } from "./db";
import { getUserStreakStats } from "./streaks";
import { DEFAULT_TIME_ZONE } from "./timezone";
import { getUserBadgesForDisplay, type DisplayBadge } from "./badges";
import { getLevelProgress } from "./progress";
import { levelSlugs, type LevelSlug } from "./courses";
import { isAvatarId, DEFAULT_AVATAR_ID, type AvatarId } from "./avatars";
import { generateShortCode, isPlausibleShortCode } from "./short-code";
import { getEntitlementTierForUser } from "./subscription";

// Lowercase + digits, no ambiguous characters — this ends up in a URL
// (/u/handle), so it should be comfortable to read and type, unlike the
// uppercase referral code which is more often just clicked as a link.
const HANDLE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const HANDLE_LENGTH = 8;

export function generatePublicHandle(): string {
  return generateShortCode(HANDLE_ALPHABET, HANDLE_LENGTH);
}

export function isPlausiblePublicHandle(value: string): boolean {
  return isPlausibleShortCode(value, HANDLE_ALPHABET, HANDLE_LENGTH);
}

/** Same lazy-generation shape as referral.ts's getOrCreateReferralCode —
 * see that file for the reasoning (most accounts never need one). */
export async function getOrCreatePublicHandle(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { publicHandle: true } });
  if (user?.publicHandle) return user.publicHandle;

  for (let attempt = 0; attempt < 5; attempt++) {
    const handle = generatePublicHandle();
    try {
      await db.user.update({ where: { id: userId }, data: { publicHandle: handle } });
      return handle;
    } catch {
      // Unique constraint collision — retry with a new handle.
    }
  }
  throw new Error("Could not generate a unique public handle after 5 attempts");
}

export interface PublicProfileToggleState {
  enabled: boolean;
  handle: string | null;
}

/** Read-only counterpart to setPublicProfileEnabled, for rendering the
 * /profile toggle's initial state. Called unconditionally on every
 * /profile render (see getUserBadgesForDisplay/getReferralStats for the
 * same reasoning) — fails soft to "off, no link" rather than 500ing the
 * whole page on a DB hiccup. */
export async function getPublicProfileToggleState(userId: string): Promise<PublicProfileToggleState> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { publicProfileEnabled: true, publicHandle: true },
    });
    return { enabled: user?.publicProfileEnabled ?? false, handle: user?.publicHandle ?? null };
  } catch (error) {
    console.error("[public-profile] getPublicProfileToggleState failed", error);
    return { enabled: false, handle: null };
  }
}

/** Toggles a user's public badge profile on/off, generating a handle the
 * first time it's turned on. Returns the handle so the caller can show
 * the link immediately (or null if the profile was just turned off). */
export async function setPublicProfileEnabled(userId: string, enabled: boolean): Promise<string | null> {
  if (!enabled) {
    await db.user.update({ where: { id: userId }, data: { publicProfileEnabled: false } });
    return null;
  }
  const handle = await getOrCreatePublicHandle(userId);
  await db.user.update({ where: { id: userId }, data: { publicProfileEnabled: true } });
  return handle;
}

export interface PublicProfileData {
  name: string | null;
  avatarId: AvatarId;
  /** Active Premium (lifetime) plan — drives the gold ring/crown on this
   * profile's avatar, see MatryoshkaAvatar.tsx's `premium` prop. */
  isPremium: boolean;
  currentLevel: LevelSlug | null;
  currentStreak: number;
  longestStreak: number;
  earnedBadges: DisplayBadge[];
}

/** Everything shown on /u/[handle] — deliberately a small, hand-picked
 * subset (name, avatar, level, streak, EARNED badges only) with nothing
 * that could leak email, exam answers, subscription status, or payment
 * history. Returns null both when the handle doesn't resolve to a user
 * AND when that user has since turned their public profile back off, so
 * the page can 404 either way without distinguishing the two cases to a
 * visitor (an old shared link shouldn't reveal "this account exists but
 * went private" vs. "no such account"). */
export async function getPublicProfileData(handle: string): Promise<PublicProfileData | null> {
  if (!isPlausiblePublicHandle(handle)) return null;

  const user = await db.user.findUnique({
    where: { publicHandle: handle },
    select: { id: true, name: true, avatarId: true, publicProfileEnabled: true, timezone: true },
  });
  if (!user || !user.publicProfileEnabled) return null;

  const [progress, streak, badges, tier] = await Promise.all([
    getLevelProgress(user.id),
    // The PROFILE OWNER's zone, deliberately not the visitor's: this page
    // is rendered for someone else, so a request cookie here would be the
    // wrong person's midnight. Falls back to UTC when unknown.
    getUserStreakStats(user.id, user.timezone ?? DEFAULT_TIME_ZONE),
    getUserBadgesForDisplay(user.id),
    getEntitlementTierForUser(user.id),
  ]);

  const currentLevel = [...levelSlugs].reverse().find((level) => progress[level].completed > 0) ?? null;

  return {
    name: user.name,
    avatarId: isAvatarId(user.avatarId) ? user.avatarId : DEFAULT_AVATAR_ID,
    isPremium: tier === "premium",
    currentLevel,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    earnedBadges: badges.filter((b) => b.earnedAt !== null),
  };
}
