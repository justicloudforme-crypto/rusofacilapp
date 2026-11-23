import type { Dictionary } from "./dictionaries";

/**
 * ДОЛГ 183 (заход 7.302): РАМЕ СТРАНИЦЫ — ТОЛЬКО ЕЁ РАЗДЕЛЫ СЛОВАРЯ.
 *
 * Всё, что серверный код отдаёт КЛИЕНТСКОМУ компоненту, Next кладёт в данные
 * отрисовки ответа (`self.__next_f` в `<script>`), и этот текст едет в
 * КАЖДУЮ страницу. До 7.302 поиск в шапке (`GlobalSearch`) и нижнее меню
 * (`BottomNav`) получали словарь интерфейса целиком — 95 КБ испанского
 * (128 КБ русского), из которых им нужны три раздела на ≈1,6 КБ. Так в
 * разметку `/es/pricing` попадали строки админки, профиля и уроков, а в
 * приложении — слова «MXN» и «OXXO» в коде страницы.
 *
 * Здесь — выбор разделов. Типы `Pick<…>` сами по себе регрессию не держат:
 * TypeScript пропускает объект с лишними полями, и `dict={dict}` снова
 * отправил бы в браузер всё. Поэтому места вызова стережёт
 * `src/i18n/chrome-dict.test.ts`: клиентскому компоненту нельзя передать
 * голый `dict` — только раздел (`dict.lesson`) или вызов выбора отсюда.
 *
 * Возвращаются ТЕ ЖЕ объекты разделов, а не копии: React сериализует
 * повторную ссылку один раз, и `nav`, общий для поиска и нижнего меню,
 * уезжает в страницу единожды.
 */
export type SearchDict = Pick<Dictionary, "nav" | "search" | "access">;
export type BottomNavDict = Pick<Dictionary, "nav">;

export function searchDict(dict: Dictionary): SearchDict {
  return { nav: dict.nav, search: dict.search, access: dict.access };
}

export function bottomNavDict(dict: Dictionary): BottomNavDict {
  return { nav: dict.nav };
}
