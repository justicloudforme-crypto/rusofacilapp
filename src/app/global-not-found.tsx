import { headers } from "next/headers";
import { PT_Sans, PT_Serif, PT_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { LOCALE_HEADER } from "@/lib/locale-header";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NotFoundBody from "@/components/NotFoundBody";
import { getThemePreference } from "@/lib/theme";
import { getCurrentUser } from "@/lib/auth";
import { getUserStreakStats } from "@/lib/streaks";
import { getRequestTimeZone } from "@/lib/timezone-server";

/**
 * Своя страница 404 на весь сайт, в обеих локалях — долг 129.
 *
 * ПОЧЕМУ ИМЕННО `global-not-found.tsx`, А НЕ `not-found.tsx`. Измерено
 * 11.09.2026, не предположено. У этого приложения НЕТ `src/app/layout.tsx`:
 * корневой layout — `src/app/[lang]/layout.tsx`. В таком дереве Next не
 * читает `src/app/[lang]/not-found.tsx` вовсе, а границы уровнем ниже
 * (`[lang]/stories/not-found.tsx` и ещё 35 таких же) попадают в
 * RSC-payload, но ДОКУМЕНТ остаётся внутренней пустой оболочкой Next
 * (`<html id="__next_error__">` с пустым `<body>`): содержимое 404 не
 * видно ни в серверном HTML, ни после гидрации. Именно поэтому до этого
 * захода всякий `notFound()` на проде отдавал пустую страницу, а голую
 * английскую «404: This page could not be found» было видно только на
 * путях, не совпавших ни с одним маршрутом.
 *
 * `global-not-found.tsx` — единственная конвенция, которая рисует СВОЙ
 * документ и потому работает без корневого layout'а. Перестройка layout'а
 * (вынос `<html>` в `src/app/layout.tsx`) закрыла бы вопрос иначе, но она
 * задевает раму всех страниц, включая 330 замороженных, и решением
 * владельца отложена до снятия заморозки (PROGRESS.md, пункт 8 порядка
 * чтения).
 *
 * ЛОКАЛЬ ПРИХОДИТ ЗАГОЛОВКОМ. Пропсов у этого файла нет — ни `params`,
 * ни `searchParams`, — поэтому язык берётся из запроса: прокси кладёт в
 * него `x-rf-locale` (см. `src/proxy.ts`), и это единственный читатель
 * того заголовка. Без заголовка — испанский, основная локаль сайта.
 *
 * РАМА ТА ЖЕ, И ЭТО НЕ КОПИЯ. Шапка и подвал — те самые `Navbar` и
 * `Footer`, что на всех страницах; ни один из них для этой страницы не
 * правился. Повторены только три строки шрифтов: определить их здесь
 * заново дешевле, чем вынести из `[lang]/layout.tsx` в общий модуль и тем
 * тронуть раму 330 замороженных страниц до 26.09.
 */
const ptSans = PT_Sans({ variable: "--font-pt-sans", subsets: ["latin", "cyrillic"], weight: ["400", "700"] });
const ptSerif = PT_Serif({ variable: "--font-pt-serif", subsets: ["latin", "cyrillic"], weight: ["400", "700"] });
const ptMono = PT_Mono({ variable: "--font-pt-mono", subsets: ["latin", "cyrillic"], weight: "400" });

/** Страница ошибки в индекс не попадает никогда и ни в одной локали.
 *  Рядом с этим — её нет в `sitemap.ts`, и собственного адреса у неё не
 *  существует вовсе: она отдаётся на месте того адреса, который не нашёлся. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function localeFromRequest(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER) ?? "";
  return isLocale(value) ? value : defaultLocale;
}

export default async function GlobalNotFound() {
  const lang = await localeFromRequest();
  const dict = await getDictionary(lang);
  const theme = await getThemePreference();
  const user = await getCurrentUser();
  const timeZone = await getRequestTimeZone(user?.timezone);
  const streak = user ? await getUserStreakStats(user.id, timeZone, user) : null;

  return (
    <html
      lang={lang}
      data-theme={theme}
      className={`${ptSans.variable} ${ptSerif.variable} ${ptMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <Navbar lang={lang} dict={dict} streak={streak} />
        <main className="flex flex-1 flex-col">
          <NotFoundBody lang={lang} dict={dict.notFound} />
        </main>
        <Footer dict={dict} lang={lang} />
      </body>
    </html>
  );
}
