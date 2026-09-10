import { locales, type Locale } from "@/i18n/config";
import { SPANISH_ONLY_ROUTES, matchSpanishOnlyRoute } from "@/lib/spanish-only-routes";

/**
 * Куда ведёт переключатель языка в шапке.
 *
 * ПРАВИЛО ПРОЕКТА (решение владельца 10.09.2026): переключатель НИКОГДА
 * не ведёт на ошибку. Есть парная страница — ведёт на неё; пары нет —
 * на ближайшую существующую страницу второй локали, то есть на хаб
 * своего раздела.
 *
 * ЗАЧЕМ. До 7.167 переключатель менял первый сегмент пути и больше не
 * делал ничего:
 *
 *     const segments = pathname.split("/"); segments[1] = locale;
 *
 * На двуязычном маршруте это верно, а на испанском — нет. Замер на живом
 * проде 10.09.2026: из 1921 краулимой страницы обеих локалей у **39**
 * (все на `/es`) переключатель вёл в 404 — 23 страницы категорий словаря,
 * 5 гидов по грамматике вместе с их хабом и 10 игровых лендингов с
 * кириллицей. Жалоба владельца («в «Антонимах» переключение на русский
 * даёт ошибку») — ровно одна из этих 39.
 *
 * ПОЧЕМУ НЕ «ЗАВЕСТИ СТРАНИЦЫ `/ru`». Их 39, и каждая — испанский текст,
 * объясняющий русский ЧЕРЕЗ СРАВНЕНИЕ С ИСПАНСКИМ; русская копия была бы
 * тем же испанским текстом по второму адресу. Решение владельца от
 * 07.09.2026 (см. `spanish-only-routes.ts`) не отменено: страниц `/ru` не
 * заводим.
 *
 * ПОЧЕМУ НЕ «СПРЯТАТЬ ПЕРЕКЛЮЧАТЕЛЬ». Спрятанный орган управления — это
 * та же неправда, только молча: человек, читающий русский интерфейс,
 * теряет способ вернуться к нему с испанской страницы, на которую пришёл
 * по внутренней ссылке (`localeHref` уводит на `/es` из обеих локалей —
 * это по тому же решению владельца).
 *
 * СВЯЗЬ СО СПИСКОМ. Таблица ниже — `Record` по СОЮЗУ значений
 * {@link SPANISH_ONLY_ROUTES}, поэтому новый испанский маршрут не
 * соберётся, пока ему не назначен хаб. Список, в свою очередь, сверяется
 * с файловой системой в обе стороны (`spanish-only-routes.test.ts`), так
 * что «маршрут завели, а в список не внесли» тоже краснеет.
 */
export type SpanishOnlyRoute = (typeof SPANISH_ONLY_ROUTES)[number];

/**
 * Испанский маршрут → путь БЕЗ локали, на который уводит переключатель.
 *
 * Выбор по каждому классу:
 *  — 23 страницы категорий словаря → `/vocabulary`: это их собственный
 *    родитель, он двуязычен и в `/ru` показывает тот же банк карточек;
 *  — грамматика (хаб и 4 гида) → `/glossary`: единственный раздел о
 *    грамматике, существующий в обеих локалях;
 *  — 10 игровых лендингов → `/word-games`: хаб игр, двуязычный, и все
 *    лендинги ведут в него же ссылкой «играть»;
 *  — `/alfabeto-cirilico` → `/courses`: алфавит проходится в курсе
 *    (урок a1-1), и указатель курса — ближайшее, что есть в `/ru`.
 */
export const SPANISH_ONLY_FALLBACK: Record<SpanishOnlyRoute, string> = {
  "/alfabeto-cirilico": "/courses",
  "/crucigramas-ruso-principiantes": "/word-games",
  "/gramatica": "/glossary",
  "/gramatica/alfabeto-ruso": "/glossary",
  "/gramatica/genero-sustantivos-ruso": "/glossary",
  "/gramatica/plural-sustantivos-ruso": "/glossary",
  "/gramatica/verbos-reflexivos-ruso": "/glossary",
  "/juegos-para-aprender-ruso": "/word-games",
  "/sopa-de-letras-alfabeto-cirilico": "/word-games",
  "/sopa-de-letras-ruso": "/word-games",
  "/sopa-de-letras-ruso-ciudad": "/word-games",
  "/sopa-de-letras-ruso-clima": "/word-games",
  "/sopa-de-letras-ruso-comida": "/word-games",
  "/sopa-de-letras-ruso-compras": "/word-games",
  "/sopa-de-letras-ruso-familia": "/word-games",
  "/sopa-de-letras-ruso-ropa": "/word-games",
  "/vocabulary/[categoria]": "/vocabulary",
};

export interface LocaleSwitchTarget {
  /** Готовый адрес со всеми сегментами, начиная с локали. */
  href: string;
  /**
   * `true` — это та же страница на другом языке; `false` — пары нет и
   * href указывает на хаб раздела. Строку запроса переносить можно
   * только в первом случае: `?tab=progress` на чужом хабе бессмыслен.
   */
  paired: boolean;
}

/** Путь БЕЗ локали (`""` для корня локали) из полного `pathname`. */
function stripLocale(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  const rest = segments.slice(1).join("/");
  return rest ? `/${rest}` : "";
}

/**
 * Единственный правильный способ узнать, куда ведёт переключатель языка.
 *
 * `pathname` — путь С локалью, ровно как его отдаёт `usePathname()`.
 */
export function localeSwitchTarget(pathname: string, target: Locale): LocaleSwitchTarget {
  const path = stripLocale(pathname);
  const route = target === "es" ? null : matchSpanishOnlyRoute(path);
  if (route) return { href: `/${target}${SPANISH_ONLY_FALLBACK[route]}`, paired: false };
  return { href: `/${target}${path}`, paired: true };
}

/** Все локали, кроме данной, — чтобы список в панели строился в одном месте. */
export function otherLocales(current: Locale): Locale[] {
  return locales.filter((locale) => locale !== current);
}
