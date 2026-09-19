import { defaultLocale, type Locale } from "@/i18n/config";
import { preferredLocaleFromHeader } from "@/lib/preferred-locale";
import { rememberedLocale } from "@/lib/remembered-locale";

/**
 * ====================================================================
 * ЧЕМ РЕШАЕТСЯ ЯЗЫК НА АДРЕСЕ БЕЗ ПРЕФИКСА ЛОКАЛИ — ОДНА ФУНКЦИЯ И ОДИН
 * ПОРЯДОК ИСТОЧНИКОВ (заход 7.214, задача 1).
 * ====================================================================
 *
 * ОТКУДА ПРАВИЛО. Живое наблюдение владельца 18.09.2026: телефон с
 * системным языком Español (América), голый адрес `rusofacilapp.com` в
 * Chrome — и человек попал на `/ru`, с русским интерфейсом. До этого в
 * том же браузере он много раз открывал `/ru` руками.
 *
 * ЭТО ПРАВИЛЬНОЕ ПОВЕДЕНИЕ, А НЕ ДЕФЕКТ, и вот почему словами: выбор,
 * СДЕЛАННЫЙ ЧЕЛОВЕКОМ, сильнее языка, который назвало УСТРОЙСТВО.
 * Заголовок `Accept-Language` описывает настройку телефона и про
 * намерение ученика не знает вовсе; кука `rf-lang` — это ровно то, что
 * ученик выбрал сам. Обратный порядок и был жалобой 7.198: выбранный
 * русский не переживал ни одного перезапуска приложения.
 *
 * ЗАМЕР НА ЖИВОМ ПРОДЕ 18.09.2026 (GET `https://rusofacilapp.com/`,
 * заголовок `Location` у 307) — двенадцать строк, из них семь обязательных:
 *
 *   запомнено ru + заголовок испанский   → /ru   ← наблюдение владельца
 *   запомнено ru + заголовок английский  → /ru
 *   запомнено es + заголовок русский     → /es   ← и в обратную сторону
 *   не запомнено + заголовок испанский   → /es
 *   не запомнено + заголовок английский  → /es
 *   не запомнено + заголовок русский     → /ru
 *   не запомнено + заголовка нет вовсе   → /es
 *
 * ПОРЯДОК ИСТОЧНИКОВ, ПОИМЁННО И НАВСЕГДА:
 *
 *   1. ЗАПОМНЕННЫЙ ВЫБОР — кука `rf-lang` (`src/lib/remembered-locale.ts`).
 *      Живёт год, ставится на любом ответе, где локаль пути изменилась.
 *      Чужое значение в куке читается как «не запомнено» и роняет
 *      решение на ступень ниже, а не в ошибку.
 *   2. ЗАГОЛОВОК УСТРОЙСТВА — `Accept-Language`, разобранный по весу `q`
 *      (`src/lib/preferred-locale.ts`, долг 155).
 *   3. МОЛЧАЛИВЫЙ ОТВЕТ — `defaultLocale`, то есть испанский: продукт
 *      это курс русского ДЛЯ ИСПАНОГОВОРЯЩИХ.
 *
 * ПОЧЕМУ ОТДЕЛЬНАЯ ФУНКЦИЯ, А НЕ `?? `  НА МЕСТЕ В `src/proxy.ts`. Пока
 * порядок был выражением из двух слагаемых внутри прокси, его можно было
 * поменять местами одной правкой, и ни один прогон бы не покраснел:
 * поведенческий сторож `check:device-locale` смотрит ТОЛЬКО заголовок и
 * куки не знает вовсе, а браузерная проба `check:remembered-locale`
 * (7.198) не стоит ни в `npm run verify`, ни в `ci.yml` — то есть в CI
 * исполняется 0 раз. Здесь порядок — предмет, который можно спросить
 * таблицей значений, и сторож `check:locale-priority` спрашивает.
 */
export interface LocaleSources {
  /** Значение куки `rf-lang`, как оно пришло, — годное или нет. */
  remembered: string | null | undefined;
  /** Заголовок `Accept-Language`, как он пришёл. */
  acceptLanguage: string | null | undefined;
}

/** Какой источник дал ответ. Нужен сторожу и отчёту, не продукту. */
export type LocaleSourceName = "remembered" | "device" | "default";

export function localeDecision(sources: LocaleSources): { locale: Locale; source: LocaleSourceName } {
  const remembered = rememberedLocale(sources.remembered ?? undefined);
  if (remembered) return { locale: remembered, source: "remembered" };

  const device = preferredLocaleFromHeader(sources.acceptLanguage);
  // `preferredLocaleFromHeader` никогда не пуст: не нашлось нашего —
  // отдаёт `defaultLocale`. Различить «телефон назвал испанский» и
  // «телефон не назвал ничего» можно только здесь, и различие это
  // нужно сторожу, а не продукту — продукту оба ответа одинаковы.
  const named = namesOurLocale(sources.acceptLanguage);
  return { locale: device, source: named ? "device" : "default" };
}

/** Локаль для адреса без префикса — то, что нужно `src/proxy.ts`. */
export function localeForPrefixlessPath(sources: LocaleSources): Locale {
  return localeDecision(sources).locale;
}

/** Назвал ли заголовок хоть один наш язык весом больше нуля. */
function namesOurLocale(header: string | null | undefined): boolean {
  if (!header) return false;
  return header
    .split(",")
    .some((raw) => {
      const [tagPart, ...params] = raw.split(";");
      const tag = tagPart?.trim().toLowerCase();
      if (!tag) return false;
      for (const param of params) {
        const match = /^\s*q\s*=\s*([0-9]*\.?[0-9]+)\s*$/i.exec(param);
        if (match && !(Number.parseFloat(match[1]) > 0)) return false;
      }
      const short = tag.split("-")[0];
      return short === "es" || short === "ru";
    });
}

/** Тот же молчаливый ответ, что и у разбора заголовка, — ради читателей
 *  сторожа, которым нужно назвать его, не импортируя два модуля. */
export const SILENT_LOCALE: Locale = defaultLocale;
