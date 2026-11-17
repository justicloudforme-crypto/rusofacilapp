import { headers } from "next/headers";
import { LOCALE_HEADER } from "@/lib/locale-header";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getPageDictionary } from "@/i18n/page-dictionary";
import NotFoundBody from "@/components/NotFoundBody";

/**
 * Страница «не найдено» для адресов, где маршрут СОВПАЛ, а страница сама
 * позвала `notFound()` (нет такого рассказа, урока, пазла…) — долг 133.
 *
 * Рисуется внутри `[lang]/layout.tsx`, поэтому шапка и подвал — от рамы,
 * а не повторены здесь. Пропсов у `not-found` нет, поэтому язык — из
 * заголовка прокси (`x-rf-locale`, `src/proxy.ts`), как у
 * `global-not-found.tsx`; без заголовка — испанский.
 */
async function localeFromRequest(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER) ?? "";
  return isLocale(value) ? value : defaultLocale;
}

export default async function LangNotFound() {
  const lang = await localeFromRequest();
  const dict = await getPageDictionary(lang);
  return <NotFoundBody lang={lang} dict={dict.notFound} />;
}
