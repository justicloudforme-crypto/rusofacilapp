/** Small shared picking utility used by every "randomize across a catalog
 * pool" modal (CelebrationModal for wins, EncouragementModal for
 * fails, and any future one) — kept here once instead of copy-pasted so
 * the anti-repeat behavior stays identical everywhere it's used. */

export function pickRandomFrom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Returns a `pickFresh()` closure bound to its own history — call
 * `createScenarioPicker(pool)` once per pool (module scope) so the history
 * persists across every modal open/close for that pool's lifetime, and
 * excludes the last `historySize` picks from the next one. Falls back to
 * the full pool once history has swallowed it all (only possible once a
 * pool is smaller than `historySize`). */
export function createScenarioPicker<T>(pool: readonly T[], historySize = 4) {
  let recent: T[] = [];
  return function pickFresh(): T {
    const candidates = pool.filter((item) => !recent.includes(item));
    const options = candidates.length > 0 ? candidates : pool;
    const picked = pickRandomFrom(options);
    recent = [picked, ...recent].slice(0, historySize);
    return picked;
  };
}
