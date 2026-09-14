import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLocale, type Locale } from "@/i18n/config";
import { getEntitlementTier } from "@/lib/entitlement";
import { getSearchIndex } from "@/lib/search/index-server";
import { searchRecords } from "@/lib/search/match";
import { MAX_QUERY_LENGTH, collapsedHrefsFor } from "@/lib/search/query";
import { isNativeShellRequest } from "@/lib/native-shell";

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

  const [allRecords, tier, nativeShell] = await Promise.all([
    getSearchIndex(),
    getEntitlementTier(),
    isNativeShellRequest(),
  ]);

  /**
   * ДОЛГ 187. Внутри оболочки страницы цен нет вовсе: ссылку на неё убрали
   * из шапки, из меню, из подвала и из быстрого списка назначений этого же
   * окна поиска (`GlobalSearch.tsx`). А НАБРАННОЕ слово её по-прежнему
   * находило — в разделе «Страницы сайта», потому что быстрый список и
   * выдача по строке приходят из разных мест: список собирает сам
   * компонент, а выдачу печатает индекс (`src/lib/search/records.ts`,
   * запись `pricing`). Замер 13.09.2026, запрос «Цены» по-русски: total 2,
   * и первой строкой `/ru/pricing`.
   *
   * Отсекается ЗДЕСЬ, а не в индексе, и это не мелочь: индекс общий и
   * кешированный на пять минут (`getSearchIndex`) — он один для веба и для
   * оболочки, и вырезать из него запись значило бы забрать её у веба тоже.
   * Решение принимает запрос, у которого есть признак оболочки.
   */
  const records = nativeShell
    ? allRecords.filter((record) => !(record.section === "page" && record.id === "pricing"))
    : allRecords;

  const response = searchRecords(records, query, {
    lang,
    tier,
    collapsedHrefs: collapsedHrefsFor(lang),
  });

  // Личный ответ: пометка «нужна подписка» зависит от посетителя, поэтому
  // общего кеша у этой отдачи быть не может.
  return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
}
