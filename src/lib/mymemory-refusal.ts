/**
 * «Это перевод или это отказ, притворившийся переводом» — разбор ответа
 * MyMemory (долг 168, заход 7.188).
 *
 * ЧЕМ ЭТА БЕДА ОТЛИЧАЕТСЯ ОТ ОБЫЧНОГО ОТКАЗА. Обычный отказ виден: сеть
 * упала, пришло 502, `fetch` бросил. Этот — не виден ничем: HTTP **200**,
 * `Content-Type: application/json`, поле `translation` на месте и
 * непустое. Замер 7.187 на НАСТОЯЩЕМ обработчике с НАСТОЯЩИМ ответом
 * сервиса:
 *
 *   HTTP 200
 *   {"word":"дед","translation":"MYMEMORY WARNING: YOU USED ALL AVAILABLE
 *    FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 09 HOURS 12 MINUTES 00
 *    SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO
 *    TRANSLATE MORE"}
 *
 * Эта английская строка вставала в карточку перевода испаноговорящему
 * ученику и выглядела как перевод. Случай не гипотетический: суточный
 * потолок сервиса ≈916 тапов НА ВЕСЬ САЙТ (долг 169).
 *
 * СУДИМ ПО ТРЁМ ПРИЗНАКАМ, и ни один не лишний:
 *
 *  1. `quotaFinished: true` — собственный флаг сервиса. Самый честный
 *     признак, но он есть не во всех формах отказа.
 *  2. `responseStatus` не 200. Сервис кладёт СВОЙ код в тело, а
 *     наружу отдаёт 200 всегда: 403 «квота», 429 «слишком часто»,
 *     чужие 5xx. Сличается и с числом, и со строкой — сервис
 *     возвращает то и то.
 *  3. САМ ТЕКСТ похож на предупреждение. Нужен потому, что первые два
 *     признака описывают ответ ЦЕЛИКОМ, а предупреждение приезжает и
 *     ОТДЕЛЬНОЙ строкой внутри `matches[]`, рядом с настоящими
 *     переводами — и тогда `responseStatus` равен 200 честно.
 *
 * ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО: правила «в переводе нет латиницы» или «текст
 * заглавными». Испанский перевод — латиница по построению, а «SÍ» или
 * «OK» заглавными — законный перевод. Признак 3 ищет НЕ форму строки, а
 * подпись самого сервиса.
 */

export interface MyMemoryMatch {
  translation?: unknown;
  match?: unknown;
}

export interface MyMemoryPayload {
  responseData?: { translatedText?: unknown } | null;
  responseStatus?: unknown;
  responseDetails?: unknown;
  quotaFinished?: unknown;
  matches?: unknown;
}

/**
 * Подпись сервиса в тексте. Каждая строка взята из документации
 * MyMemory по ограничениям (`mymemory.translated.net/doc/usagelimits.php`,
 * прочитано 13.09.2026) либо из настоящего ответа, пойманного 7.187.
 */
const REFUSAL_MARKERS = [
  "MYMEMORY WARNING",
  "ALL AVAILABLE FREE TRANSLATIONS",
  "MYMEMORY.TRANSLATED.NET",
  "USAGELIMITS",
  "QUERY LENGTH LIMIT",
  "INVALID LANGUAGE PAIR",
  "TRANSLATION NOT AVAILABLE",
  "PLEASE CONTACT US",
  "AN ERROR OCCURRED",
];

/** Похож ли ОТДЕЛЬНЫЙ текст на предупреждение сервиса, а не на перевод. */
export function isRefusalText(text: string): boolean {
  const upper = text.toUpperCase();
  return REFUSAL_MARKERS.some((marker) => upper.includes(marker));
}

/** Отказал ли сервис ОТВЕТОМ ЦЕЛИКОМ — по признакам 1 и 2. */
export function isRefusalPayload(payload: MyMemoryPayload): boolean {
  if (payload.quotaFinished === true || payload.quotaFinished === "true") return true;
  const status = payload.responseStatus;
  if (status !== undefined && status !== null && status !== "") {
    const code = typeof status === "number" ? status : Number(String(status));
    if (!Number.isFinite(code) || code !== 200) return true;
  }
  if (typeof payload.responseDetails === "string" && isRefusalText(payload.responseDetails)) return true;
  return false;
}

/**
 * Перевод из ответа сервиса — или `null`, если переводом там ничего не
 * является.
 *
 * Порядок кандидатов сохранён от прежней редакции обработчика (лучший
 * `match` из `matches[]`, иначе `responseData.translatedText`): своя
 * сортировка появилась потому, что «лучший» ответ сервиса бывает хуже
 * записи ниже по списку. Добавилось одно: КАЖДЫЙ кандидат проходит
 * признак 3, и отсев идёт ДО сортировки — иначе предупреждение с
 * `match: 1` встало бы первым.
 */
export function pickMyMemoryTranslation(payload: MyMemoryPayload): string | null {
  if (isRefusalPayload(payload)) return null;

  const matches = Array.isArray(payload.matches) ? (payload.matches as MyMemoryMatch[]) : [];
  const candidates = matches
    .map((entry) => ({
      text: typeof entry?.translation === "string" ? entry.translation.trim() : "",
      score: typeof entry?.match === "number" ? entry.match : 0,
    }))
    .filter((entry) => entry.text && !isRefusalText(entry.text))
    .sort((a, b) => b.score - a.score);

  if (candidates.length > 0) return candidates[0].text;

  const fallback = payload.responseData?.translatedText;
  if (typeof fallback !== "string") return null;
  const trimmed = fallback.trim();
  if (!trimmed || isRefusalText(trimmed)) return null;
  return trimmed;
}
