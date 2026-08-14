import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";
import { isStaff, isOwner } from "./roles";

/**
 * Defense-in-depth companion to the /admin gate in proxy.ts: every admin
 * page/route calls this too, so a matcher change in the proxy can't
 * silently expose the dashboard (same reasoning as the lesson pages).
 */
export async function requireStaffUser(lang: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/login?redirectTo=/${lang}/admin`);
  if (!isStaff(user.role)) redirect(`/${lang}`);
  return user;
}

export async function requireOwnerUser(lang: string) {
  const user = await requireStaffUser(lang);
  if (!isOwner(user.role)) redirect(`/${lang}/admin`);
  return user;
}
