import { formatDateKey } from "@/lib/activity-calendar";

// One sentence next to the streak, saying where the count starts.
//
// Why it exists. On 31.08.2026 the owner's own profile showed NINE flames
// on the August calendar and "racha actual: 2 días" beside them. Both
// numbers are right — a gap on the 29th ended the previous chain — but read
// together they look like a broken counter, and a counter a learner does
// not believe is worse than no counter.
//
// It is a server component and takes no state: everything it says comes
// from the same single replay that produced the streak (chainStartedOn and
// brokenOn on StreakStats), so the sentence and the number cannot drift.

export interface StreakExplanationDict {
  /** Carries {start} and {broken}. */
  sinceBreak: string;
  /** Carries {start}. */
  neverBroken: string;
  /** Shown when there is no live chain at all. Already a complete sentence
   * on its own — this is the line /profile has always used for that case. */
  none: string;
  /** January-first month names in the form `datePattern` needs. */
  monthsInDate: string[];
  /** Carries {day} and {month}. */
  datePattern: string;
}

export default function StreakExplanation({
  currentStreak,
  chainStartedOn,
  brokenOn,
  dict,
  className = "",
}: {
  currentStreak: number;
  chainStartedOn: string | null;
  brokenOn: string | null;
  dict: StreakExplanationDict;
  className?: string;
}) {
  // Three cases, and all three are whole sentences. There is deliberately
  // no fourth branch that renders half of one: a streak of zero has its own
  // line, and a chain with no start cannot happen while the streak is
  // positive (both come out of the same walk), but the guard is written
  // anyway so a future change cannot produce "La racha cuenta desde el ."
  const text =
    currentStreak > 0 && chainStartedOn
      ? brokenOn
        ? dict.sinceBreak
            .replace("{start}", formatDateKey(chainStartedOn, dict.datePattern, dict.monthsInDate))
            .replace("{broken}", formatDateKey(brokenOn, dict.datePattern, dict.monthsInDate))
        : dict.neverBroken.replace(
            "{start}",
            formatDateKey(chainStartedOn, dict.datePattern, dict.monthsInDate),
          )
      : dict.none;

  return <p className={`text-sm text-foreground/60 ${className}`}>{text}</p>;
}
