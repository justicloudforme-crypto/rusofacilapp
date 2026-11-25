"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { shouldSkipStats } from "@/lib/stats-opt-out";

/**
 * Vercel Web Analytics и Speed Insights с одним фильтром (заход 7.310):
 * страницы админки не уходят никогда, браузер с пометкой владельца не шлёт
 * ничего (`src/lib/stats-opt-out.ts`). `beforeSend` — штатный путь Vercel:
 * вернул `null` — событие не отправлено. Через него же идёт и `track()`
 * (вступительная презентация), так что отдельной проверки ему не нужно.
 *
 * Функции — на уровне модуля, чтобы ссылка не менялась между рендерами:
 * компоненты Vercel перерегистрируют `beforeSend` на каждую новую ссылку.
 *
 * Оба компонента молчат, пока Web Analytics / Speed Insights не включены
 * в панели Vercel (vercel.com/rusofacilappcom/rusofacilapp → Analytics /
 * Speed Insights); на проде включены (7.307).
 */
function analyticsBeforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  return shouldSkipStats(event.url) ? null : event;
}

function speedInsightsBeforeSend<T extends { url: string }>(event: T): T | null {
  return shouldSkipStats(event.url) ? null : event;
}

export default function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={analyticsBeforeSend} />
      <SpeedInsights beforeSend={speedInsightsBeforeSend} />
    </>
  );
}
