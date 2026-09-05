/**
 * Порядок и полнота серверного списка ссылок под каталогом.
 *
 * Зачем отдельный файл. Замер обхода прода 05.09.2026 (PROGRESS.md 7.112):
 * от корней локалей недостижимы 516 из 1912 URL карты сайта — 236 рассказов
 * и 280 медиа. Механизм — не пагинация: её у этих списков нет вовсе.
 * `StoriesCatalog` и `MediaCatalog` — клиентские компоненты с
 * PAGE_SIZE = 24 и состоянием `visibleCount`, «показать ещё» — это
 * `onClick`. Данные ВСЕХ карточек в отданном HTML уже лежат
 * (сериализованные пропсы), не хватает только тегов `<a>`.
 *
 * Правило этого файла — одно: КАЖДЫЙ элемент попадает в вывод ровно один
 * раз. Именно поэтому элемент с незнакомым уровнем не выбрасывается, а
 * уезжает в свою группу в хвост: молча потерять ссылку — это ровно тот
 * дефект, который список и чинит.
 *
 * Порядок не зависит от посетителя. Каталог сортирует «доступные вперёд»
 * по тарифу (см. stories/page.tsx), и это правильно для витрины; но HTML
 * страницы, который читает краулер, не должен меняться от того, кто её
 * открыл. Здесь ключ — уровень, потом заголовок, и ничего больше.
 */

export interface CatalogLinkItem {
  id: string;
  title: string;
  level: string;
}

export interface CatalogLinkGroup<T extends CatalogLinkItem> {
  level: string;
  items: T[];
}

/**
 * Группирует по уровню в порядке `levels`, внутри группы — по заголовку.
 * Пустые группы не печатаются; уровни, которых нет в `levels`, идут после
 * объявленных, в порядке первого появления.
 */
export function groupByLevel<T extends CatalogLinkItem>(
  items: readonly T[],
  levels: readonly string[],
  lang: string,
): CatalogLinkGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const level of levels) groups.set(level, []);
  for (const item of items) {
    const bucket = groups.get(item.level);
    if (bucket) bucket.push(item);
    else groups.set(item.level, [item]);
  }
  return [...groups.entries()]
    .filter(([, bucket]) => bucket.length > 0)
    .map(([level, bucket]) => ({
      level,
      items: [...bucket].sort((a, b) => a.title.localeCompare(b.title, lang) || a.id.localeCompare(b.id)),
    }));
}
