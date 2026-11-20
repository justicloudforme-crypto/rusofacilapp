/**
 * Бесплатный образец идиом — одно место на маршрут и на индекс поиска.
 *
 * До 7.294 обе функции ниже жили внутри `GET /api/idioms`, и «какие пять
 * фраз видит аноним» знал только маршрут. Индекс поиска поэтому ставил 🔒
 * на все 586 идиом «по подписке», в том числе на те четыре, которые аноним
 * на вкладке словаря откроет (долг 104). Вынесены сюда без единой правки
 * поведения: маршрут зовёт их же, а индекс спрашивает
 * `anonymousIdiomSample` — ту же цепочку, что маршрут применяет к
 * неоплатившему на своём обычном запросе (вкладка `IdiomsList` грузит весь
 * список без фильтра).
 *
 * Модуль чистый и без `server-only`: его зовёт `src/lib/search/records.ts`,
 * который собирают и сторожа под `tsx`.
 */
import { FREE_TRIAL_LIMITS, LITERARY_IDIOM_LIMITS } from "../free-trial-limits";
import { idiomCategories } from "./types";

// Free-trial sample for the common case where IdiomsList fetches everything
// unfiltered and splits by category client-side (see the GET comment in
// src/app/api/idioms/route.ts). A plain `.slice(0, limit)` by createdAt
// order previously handed back e.g. 5 idioms that were ALL "daily" (the
// first-inserted category), so every other tab (Refranes/Literarios) showed
// "no idioms" for any free-trial visitor — the exact same bug shape as
// GET /api/flashcards had. Round-robins across categories (one from each,
// then a second from each, ...) so every category with any idioms at all
// gets at least one.
export function buildFreeIdiomSample<T extends { category: string }>(idioms: T[], limit: number): T[] {
  const byCategory = new Map<string, T[]>();
  for (const idiom of idioms) {
    const list = byCategory.get(idiom.category);
    if (list) list.push(idiom);
    else byCategory.set(idiom.category, [idiom]);
  }

  const sample: T[] = [];
  for (let round = 0; sample.length < limit; round++) {
    let addedAny = false;
    for (const category of idiomCategories) {
      const list = byCategory.get(category);
      const next = list?.[round];
      if (next) {
        sample.push(next);
        addedAny = true;
        if (sample.length >= limit) break;
      }
    }
    if (!addedAny) break;
  }
  return sample;
}

// "literary" is capped separately from (and on top of) the general
// entitled/free-sample logic — see getLiteraryIdiomLimit: it's the one
// idiom category that's Premium-exclusive beyond a small taste, even for an
// otherwise-full-access "standard" subscriber. Preserves order and only
// touches literary rows, so a caller filtered to any other category (or
// "all") is unaffected apart from literary items within it.
export function capLiteraryIdioms<T extends { category: string }>(idioms: T[], limit: number | null): T[] {
  if (limit === null) return idioms;
  let seen = 0;
  return idioms.filter((idiom) => {
    if (idiom.category !== "literary") return true;
    seen++;
    return seen <= limit;
  });
}

/**
 * Какие идиомы аноним видит на вкладке словаря — ровно цепочка
 * `GET /api/idioms` для тарифа `free` без фильтра: уровень C1 снят
 * (`canAccessLevel`), образец по кругу категорий, затем потолок
 * `literary`.
 *
 * ПОРЯДОК ВХОДА — ТОТ ЖЕ, ЧТО У МАРШРУТА: `createdAt` по возрастанию. На
 * 19.11.2026 у 148 значений `createdAt` по нескольку строк (у первых
 * `literary` — семь с одной датой), так что образец решает порядок, в
 * котором база отдаёт равные даты. SQLite сортирует устойчиво (к ключу
 * сортировки добавляется порядковый номер строки при обходе таблицы),
 * поэтому два чтения с одним `orderBy` дают один и тот же порядок; это
 * сверено на копии банка в 7.294.
 */
export function anonymousIdiomSample<T extends { category: string; level?: string | null }>(idioms: readonly T[]): T[] {
  // C1 — только план Premium; то же правило, что `canAccessLevel` в
  // entitlement.ts (тот модуль `server-only`, отсюда его не позвать).
  const accessible = idioms.filter((idiom) => idiom.level !== "C1");
  return capLiteraryIdioms(buildFreeIdiomSample(accessible, FREE_TRIAL_LIMITS.idioms), LITERARY_IDIOM_LIMITS.free);
}
