import "server-only";
import { getCurrentUser } from "./auth";
import { isStaff } from "./roles";
import { userHasActiveSubscription } from "./subscription";

/**
 * Gate for the API routes backing Vocabulary/Word games (Stories and
 * Media need no separate check here — their content is embedded directly
 * into the server-rendered page, which proxy.ts's protectContentRoute
 * already blocks before it ever renders for a non-entitled visitor).
 * Vocabulary and word-game puzzle data, by contrast, load through a
 * client-side fetch AFTER the page has rendered — proxy.ts's matcher
 * explicitly excludes `/api/*`, so without this check a page-level
 * redirect alone would still leave the raw content one direct request
 * away for anyone who knew (or guessed) the endpoint. Mirrors
 * protectLessonRoute in proxy.ts: staff bypass, everyone else needs an
 * active, non-expired subscription.
 */
export async function hasContentAccess(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (isStaff(user.role)) return true;
  return userHasActiveSubscription(user.id);
}
