"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  markOnAdminVisit,
  readStatsMark,
  setStatsExcluded,
  subscribeStatsMark,
  type StatsMark,
} from "@/lib/stats-opt-out";

export type StatsOptOutCopy = {
  excluded: string;
  counted: string;
  exclude: string;
  include: string;
  storageRefused: string;
};

/**
 * Строка в шапке админки (заход 7.310): считаются ли визиты ЭТОГО браузера
 * в статистике, и кнопка, которая это меняет. Заход в любую страницу
 * админки ставит пометку «не считать» сам (если владелец не снимал её
 * кнопкой) — строка показывает итог, так что проверить можно без видео.
 *
 * До гидратации состояние неизвестно (хранилище есть только в браузере) —
 * сервер рисует пустую строку той же высоты, без «прыжка» вёрстки.
 */
function getServerSnapshot(): StatsMark | null {
  return null;
}

export default function StatsOptOutBanner({ copy }: { copy: StatsOptOutCopy }) {
  const mark = useSyncExternalStore<StatsMark | null>(subscribeStatsMark, readStatsMark, getServerSnapshot);

  useEffect(() => {
    markOnAdminVisit();
  }, []);

  const excluded = mark === "excluded";
  // «unset» после markOnAdminVisit значит одно: хранилище отказало в записи
  // (приватное окно, запрет данных сайта) — визиты при этом считаются.
  const refused = mark === "unset";

  return (
    <div
      data-testid="stats-opt-out"
      data-mark={mark ?? "pending"}
      className={`mt-4 flex min-h-11 flex-wrap items-center gap-3 rounded-2xl border px-4 py-2 text-sm ${
        excluded
          ? "border-black/10 bg-foreground/5 dark:border-white/30"
          : "border-primary/40 bg-primary/10"
      }`}
    >
      {mark === null ? null : (
        <>
          <p className="flex-1 font-medium" role="status">
            {excluded ? copy.excluded : copy.counted}
            {refused ? <span className="block text-xs font-normal text-foreground/60">{copy.storageRefused}</span> : null}
          </p>
          <button
            type="button"
            onClick={() => setStatsExcluded(!excluded)}
            className="tap min-h-11 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {excluded ? copy.include : copy.exclude}
          </button>
        </>
      )}
    </div>
  );
}
