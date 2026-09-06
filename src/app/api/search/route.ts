import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLocale, type Locale } from "@/i18n/config";
import { getEntitlementTier } from "@/lib/entitlement";
import { getSearchIndex } from "@/lib/search/index-server";
import { searchRecords } from "@/lib/search/match";
import { MAX_QUERY_LENGTH, collapsedHrefsFor } from "@/lib/search/query";

/**
 * Поиск по названиям объектов сайта.
 *
 * Публичный и без авторизации — как `/api/glossary`: до 05.09.2026 поиск
 * вообще был клиентским фильтром по восьми пунктам меню, и требовать
 * теперь аккаунт значило бы забрать у анонима то, что у него было.
 *
 * Уровень доступа читается, но НЕ фильтрует выдачу: закрытый объект
 * показывается с пометкой о подписке и ведёт туда же, куда ведёт сегодня.
 * Поиск, который прячет от неоплатившего сам факт существования рассказа,
 * отвечает «ничего не найдено» на живой объект — а это ровно тот дефект,
 * который этот заход и закрывает.
 *
 * Адреса с `?q=` у поиска нет: окно остаётся окном, новых URL 0, и запись
 * в `src/lib/site.ts` про намеренное отсутствие `potentialAction`
 * остаётся честной.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
  const langParam = searchParams.get("lang") ?? "";
  const lang: Locale = isLocale(langParam) ? langParam : "es";

  if (!query.trim()) {
    return NextResponse.json({ query, total: 0, shown: 0, sections: [], fuzzy: false });
  }

  const [records, tier] = await Promise.all([getSearchIndex(), getEntitlementTier()]);
  const response = searchRecords(records, query, {
    lang,
    tier,
    collapsedHrefs: collapsedHrefsFor(lang),
  });

  // Личный ответ: пометка «нужна подписка» зависит от посетителя, поэтому
  // общего кеша у этой отдачи быть не может.
  return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
}
