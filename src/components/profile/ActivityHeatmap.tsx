import { addDateKeyDays, dateKeyIn } from "@/lib/timezone";

// 30-day activity heatmap for the /profile Overview tab. Pure display over
// the same "YYYY-MM-DD" activity date keys getUserStreakStats already
// derives currentStreak/longestStreak from (see getUserActivityDateKeys in
// streaks.ts) — no new metric, just a visualization of the existing one.
export default function ActivityHeatmap({
  activeDateKeys,
  todayLabel,
  timeZone,
}: {
  activeDateKeys: string[];
  todayLabel: string;
  /** The zone the keys were derived in. The strip has to be built in the
   * SAME zone, or its 30 slots and the keys they are matched against are
   * two different calendars and the whole row shifts by a day. */
  timeZone: string;
}) {
  const active = new Set(activeDateKeys);
  const todayKey = dateKeyIn(new Date(), timeZone);
  const days = Array.from({ length: 30 }, (_, i) => addDateKeyDays(todayKey, i - 29));

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max gap-1.5 py-1">
        {days.map((key) => {
          const isActive = active.has(key);
          const isToday = key === days[days.length - 1];
          return (
            <span
              key={key}
              title={isToday ? todayLabel : key}
              className={`h-5 w-5 flex-shrink-0 rounded-md ${
                isActive
                  ? "bg-primary"
                  : "bg-foreground/10 dark:bg-foreground/15"
              } ${isToday ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}
