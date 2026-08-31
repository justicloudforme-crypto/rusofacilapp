import { addDateKeyDays, dateKeyIn } from "@/lib/timezone";

// 30-day activity heatmap for the /profile Overview tab. Pure display over
// the same "YYYY-MM-DD" activity date keys getUserStreakStats already
// derives currentStreak/longestStreak from (see getUserActivityDateKeys in
// streaks.ts) — no new metric, just a visualization of the existing one.
export default function ActivityHeatmap({
  activeDateKeys,
  frozenDateKeys,
  todayLabel,
  frozenDayLabel,
  timeZone,
}: {
  activeDateKeys: string[];
  /** Days a streak freeze covered. Painted as a distinct third state — a
   * streak that survives a gap has to SHOW which day it survived, or the
   * learner is left guessing why the number did not reset (PROGRESS.md
   * 7.69). */
  frozenDateKeys: string[];
  todayLabel: string;
  frozenDayLabel: string;
  /** The zone the keys were derived in. The strip has to be built in the
   * SAME zone, or its 30 slots and the keys they are matched against are
   * two different calendars and the whole row shifts by a day. */
  timeZone: string;
}) {
  const active = new Set(activeDateKeys);
  const frozen = new Set(frozenDateKeys);
  const todayKey = dateKeyIn(new Date(), timeZone);
  const days = Array.from({ length: 30 }, (_, i) => addDateKeyDays(todayKey, i - 29));

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-1.5 py-1">
        {days.map((key) => {
          const isActive = active.has(key);
          // A day cannot be both: a freeze is only ever spent on a day with
          // no activity at all. Checked in this order anyway so a future
          // data change can never paint a studied day as frozen.
          const isFrozen = !isActive && frozen.has(key);
          const isToday = key === days[days.length - 1];
          const tone = isActive
            ? "bg-primary"
            : isFrozen
              ? "border-2 border-dashed border-sky-500/70 bg-sky-400/25 dark:border-sky-300/70 dark:bg-sky-300/25"
              : "bg-foreground/10 dark:bg-foreground/15";
          const label = isFrozen ? `${key} — ${frozenDayLabel}` : isToday ? todayLabel : key;
          return (
            <span
              key={key}
              title={label}
              aria-label={label}
              className={`h-5 w-5 flex-shrink-0 rounded-md ${tone} ${
                isToday ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
