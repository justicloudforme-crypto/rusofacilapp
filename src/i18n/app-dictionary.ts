/**
 * СЛОВАРЬ ДЛЯ ПРИЛОЖЕНИЯ — БЕЗ СТРОК ВЕБ-ОПЛАТЫ (долг 356, заход 7.244).
 *
 * Клиентским компонентам (`BottomNav`, `GlobalSearch`, уроки, игры…)
 * словарь передаётся целиком, а всё, что уходит клиентскому компоненту,
 * Next кладёт в данные отрисовки ответа (`self.__next_f` в `<script>`).
 * На экране приложения этих строк нет с 7.243 (`check:app-mode`, видимый
 * текст), но «просмотр кода» главной приложения показывал «OXXO» 7 раз и
 * «Descargar la app» 1 раз.
 *
 * Здесь — чистая функция без сервера: КОПИЯ словаря, в которой пусты
 *   • все строки со словом «OXXO» (заглавными — так пишется название сети
 *     в тексте; идентификатор `faq[].id = "oxxoExpiry"` не текст и
 *     остаётся, иначе поедут ключи списка);
 *   • `footer.appLink` («Descargar la app» / «Скачать приложение»).
 * Пустая строка, а не удалённый ключ: тип словаря тот же, и код, который
 * всё-таки прочтёт такую строку, получит «ничего», а не падение.
 *
 * Исходный словарь не меняется: `getDictionary` отдаёт один и тот же
 * объект модуля всем запросам, браузеру в том числе.
 */
const WEB_PAYMENT_WORD = /OXXO/;
const WEB_ONLY_KEYS = new Set(["footer.appLink"]);

function scrub(value: unknown, path: string): unknown {
  if (typeof value === "string") {
    return WEB_ONLY_KEYS.has(path) || WEB_PAYMENT_WORD.test(value) ? "" : value;
  }
  if (Array.isArray(value)) return value.map((item, i) => scrub(item, `${path}.${i}`));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = scrub(item, path ? `${path}.${key}` : key);
    return out;
  }
  return value;
}

export function withoutWebPaymentStrings<T>(dict: T): T {
  return scrub(dict, "") as T;
}
