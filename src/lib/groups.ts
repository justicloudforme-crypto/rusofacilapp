import "server-only";
import { db } from "./db";
import { getLevelProgressForUsers } from "./progress";
import { levelSlugs } from "./courses";
import { isAvatarId, DEFAULT_AVATAR_ID, type AvatarId } from "./avatars";
import { generateShortCode, isPlausibleShortCode } from "./short-code";
import { getEntitlementTiersForUsers } from "./subscription";

// Same alphabet/length as referral codes — this is meant to be typed or
// read aloud when sharing a group with classmates, not just clicked.
const INVITE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const INVITE_LENGTH = 7;

export function generateGroupInviteCode(): string {
  return generateShortCode(INVITE_ALPHABET, INVITE_LENGTH);
}

export function isPlausibleGroupInviteCode(value: string): boolean {
  return isPlausibleShortCode(value, INVITE_ALPHABET, INVITE_LENGTH);
}

export const MAX_GROUP_NAME_LENGTH = 60;
// A study group is meant to be a small circle (a class, a few friends),
// not a public leaderboard — this cap keeps the per-member Promise.all in
// getGroupForMember cheap and keeps a group from being (ab)used as an
// open community.
export const MAX_GROUP_MEMBERS = 30;
// Defensive cap against one account spinning up unlimited groups; a real
// student has no reason to own more than a handful.
export const MAX_GROUPS_OWNED = 10;

export class GroupError extends Error {}

export async function createGroup(ownerUserId: string, rawName: string) {
  const name = rawName.trim().slice(0, MAX_GROUP_NAME_LENGTH);
  if (!name) throw new GroupError("empty_name");

  const ownedCount = await db.group.count({ where: { ownerUserId } });
  if (ownedCount >= MAX_GROUPS_OWNED) throw new GroupError("too_many_groups");

  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateGroupInviteCode();
    try {
      const group = await db.group.create({ data: { name, inviteCode, ownerUserId } });
      await db.groupMember.create({ data: { groupId: group.id, userId: ownerUserId } });
      return group;
    } catch {
      // Unique constraint collision on inviteCode — retry with a new one.
    }
  }
  throw new Error("Could not generate a unique group invite code after 5 attempts");
}

export interface GroupInvitePreview {
  id: string;
  name: string;
  memberCount: number;
}

/** Looks up a group by its invite code without joining it or requiring
 * membership — used by the /groups/join?code=… landing page to show
 * "Join {name}?" before the user commits. Knowing the code is itself the
 * gate here (same as any invite link), so no auth/membership check. */
export async function getGroupPreviewByInviteCode(rawCode: string): Promise<GroupInvitePreview | null> {
  const code = rawCode.trim().toUpperCase();
  if (!isPlausibleGroupInviteCode(code)) return null;

  const group = await db.group.findUnique({
    where: { inviteCode: code },
    include: { _count: { select: { members: true } } },
  });
  if (!group) return null;

  return { id: group.id, name: group.name, memberCount: group._count.members };
}

export async function joinGroupByInviteCode(userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  if (!isPlausibleGroupInviteCode(code)) throw new GroupError("invalid_code");

  const group = await db.group.findUnique({ where: { inviteCode: code } });
  if (!group) throw new GroupError("not_found");

  const existing = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });
  if (existing) return group; // already a member — joining again is a no-op, not an error

  const memberCount = await db.groupMember.count({ where: { groupId: group.id } });
  if (memberCount >= MAX_GROUP_MEMBERS) throw new GroupError("group_full");

  await db.groupMember.create({ data: { groupId: group.id, userId } });
  return group;
}

/** The owner leaving isn't "leaving" — it's deleting the group for
 * everyone (Cascade removes every GroupMember row too), since a group
 * with no owner has no one who can manage it. Anyone else just removes
 * their own membership. */
export async function leaveOrDeleteGroup(userId: string, groupId: string): Promise<void> {
  const group = await db.group.findUnique({ where: { id: groupId }, select: { ownerUserId: true } });
  if (!group) return;

  if (group.ownerUserId === userId) {
    await db.group.delete({ where: { id: groupId } });
    return;
  }
  await db.groupMember.deleteMany({ where: { groupId, userId } });
}

export interface UserGroupSummary {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  memberCount: number;
}

export async function getUserGroups(userId: string): Promise<UserGroupSummary[]> {
  const memberships = await db.groupMember.findMany({
    where: { userId },
    include: { group: { include: { _count: { select: { members: true } } } } },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map(({ group }) => ({
    id: group.id,
    name: group.name,
    inviteCode: group.inviteCode,
    isOwner: group.ownerUserId === userId,
    memberCount: group._count.members,
  }));
}

export interface GroupMemberStanding {
  userId: string;
  name: string | null;
  avatarId: AvatarId;
  /** Active Premium (lifetime) plan — drives the gold ring/crown on this
   * member's leaderboard avatar, see MatryoshkaAvatar.tsx's `premium` prop. */
  isPremium: boolean;
  isOwner: boolean;
  currentLevel: string | null;
  /** Sum of completed lessons across every level — the leaderboard's
   * ranking metric. Not a stored counter: computed fresh from
   * LessonProgress on every read via getLevelProgress, same as
   * currentLevel below — consistent with this file's existing "no extra
   * storage for a small, invite-only leaderboard" approach. */
  completedLessons: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  inviteCode: string;
  ownerUserId: string;
  members: GroupMemberStanding[];
}

/** Returns the group and its member leaderboard, or null if this user
 * isn't a member — group pages are visible to members only, never a
 * public leaderboard by URL guessing. */
export async function getGroupForMember(userId: string, groupId: string): Promise<GroupDetail | null> {
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) return null;

  const group = await db.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true }, orderBy: { joinedAt: "asc" } } },
  });
  if (!group) return null;

  // One batched query for every member's progress instead of one
  // getLevelProgress call per member — up to MAX_GROUP_MEMBERS (30)
  // sequential Turso round trips collapsed into a single query.
  const memberIds = group.members.map(({ user }) => user.id);
  const [progressByUser, tierByUser] = await Promise.all([
    getLevelProgressForUsers(memberIds),
    getEntitlementTiersForUsers(memberIds),
  ]);

  const members: GroupMemberStanding[] = group.members.map(({ user }) => {
    const progress = progressByUser.get(user.id)!;
    const currentLevel = [...levelSlugs].reverse().find((level) => progress[level].completed > 0) ?? null;
    const completedLessons = levelSlugs.reduce((sum, level) => sum + progress[level].completed, 0);
    return {
      userId: user.id,
      name: user.name,
      avatarId: isAvatarId(user.avatarId) ? user.avatarId : DEFAULT_AVATAR_ID,
      isPremium: tierByUser.get(user.id) === "premium",
      isOwner: user.id === group.ownerUserId,
      currentLevel,
      completedLessons,
    };
  });

  // Most progress first — the whole point of a shared leaderboard is a
  // gentle nudge toward the top, so ordering carries real meaning here.
  members.sort((a, b) => b.completedLessons - a.completedLessons);

  return { id: group.id, name: group.name, inviteCode: group.inviteCode, ownerUserId: group.ownerUserId, members };
}
