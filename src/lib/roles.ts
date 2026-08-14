export type Role = "owner" | "admin" | "student";

export function isRole(value: string): value is Role {
  return value === "owner" || value === "admin" || value === "student";
}

/** owner or admin — anyone allowed into the admin dashboard at all. */
export function isStaff(role: string): boolean {
  return role === "owner" || role === "admin";
}

export function isOwner(role: string): boolean {
  return role === "owner";
}

/**
 * Whether `actorRole` is allowed to change a user currently holding
 * `targetRole` to some other role. Mirrors the spec: only owners manage
 * roles at all, and nobody (not even another owner acting carelessly) can
 * strip the last owner via this check alone — that's enforced separately
 * where the owner count is known.
 */
export function canManageRoles(actorRole: string): boolean {
  return isOwner(actorRole);
}
