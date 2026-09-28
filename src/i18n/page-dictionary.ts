import "server-only";
import type { Locale } from "./config";
import { getDictionary, type Dictionary } from "./dictionaries";
import { withoutWebPaymentStrings } from "./app-dictionary";
import { isNativeShellRequest } from "@/lib/native-shell";

/**
 * Словарь СТРАНИЦЫ — то, что читают макет и страницы `[lang]` (долг 356,
 * 7.244). В приложении — копия без строк веб-оплаты
 * (`withoutWebPaymentStrings`), в браузере — словарь как есть.
 *
 * Только для кода, который отвечает на запрос: признак приложения читается
 * из заголовков. Макет `[lang]` читает их и сам, так что страницы под ним
 * динамические и без этого. Маршрутам без запроса (карта сайта, картинки,
 * PDF) — `getDictionary`.
 */
export async function getPageDictionary(locale: Locale): Promise<Dictionary> {
  const dict = await getDictionary(locale);
  return (await isNativeShellRequest()) ? withoutWebPaymentStrings(dict) : dict;
}
