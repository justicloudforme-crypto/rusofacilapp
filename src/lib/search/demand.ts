/**
 * Журнал спроса на поиск: что именно записывается, и почему по этой записи
 * нельзя узнать человека.
 *
 * Модуль намеренно чистый — ни базы, ни `server-only`. Ту же проверку
 * применяют обе стороны: маршрут `POST /api/search/log`, который пишет, и
 * тесты, которые не имеют права открывать соединение
 * (`check:no-db-in-tests`).
 *
 * Единица записи — не нажатие клавиши, а ЗАХОД: человек открыл окно
 * поиска, что-то набрал и закрыл его (в том числе уйдя по результату).
 * Это выбрано не ради экономии: строка на каждое нажатие превращает одну
 * сессию в упорядоченную цепочку «р», «ра», «рас», «расс» — а цепочка сама
 * по себе опознаёт посетителя надёжнее любого поля, которое мы из таблицы
 * убрали. Одна строка на заход такой цепочки не образует.
 */

/** Локали, которые журнал принимает. Строка не из этого списка — отказ, а
 * не подстановка «es»: неизвестная локаль в записи спроса означает, что
 * что-то шлёт нам мусор, и молчаливая замена спрятала бы это. */
export const LOGGED_LANGS = ["es", "ru"] as const;
export type LoggedLang = (typeof LOGGED_LANGS)[number];

/**
 * Потолок длины сохраняемой строки.
 *
 * 80 знаков — это заведомо больше любого осмысленного запроса (самое
 * длинное название объекта на сайте короче) и заведомо меньше того, во что
 * можно спрятать текст, опознающий человека: адрес почты с именем,
 * скопированный абзац, токен. Строка обрезается, а не отвергается —
 * человек, случайно вставивший в поиск пол-письма, всё равно оставил
 * сведение «искали и не нашли», и терять его незачем.
 */
export const MAX_LOGGED_QUERY_LENGTH = 80;

/** Верхняя граница `resultCount`, которую журнал согласен поверить.
 * Выдача ограничена десятками строк; число в тысячах означает не спрос, а
 * подделанное тело запроса. */
export const MAX_LOGGED_RESULT_COUNT = 100_000;

export interface SearchDemandRecord {
  query: string;
  resultCount: number;
  lang: LoggedLang;
  followed: boolean;
  hourBucket: Date;
}

export type SearchDemandParseResult =
  | { valid: true; value: SearchDemandRecord }
  | { valid: false; error: string };

/**
 * Момент, округлённый ВНИЗ до часа, в UTC.
 *
 * Это единственная временная колонка таблицы, и округление — не
 * приблизительность отчёта, а свойство приватности. Точная метка времени
 * опознаёт сама: две записи в одну миллисекунду почти наверняка от одного
 * человека, а упорядоченная последовательность таких меток — это его
 * сессия целиком, со всеми запросами по порядку. Час эту связь рвёт, и при
 * этом ни один отчёт «сколько за день / за неделю» от него не страдает.
 */
export function hourBucket(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCMinutes(0, 0, 0);
  return d;
}

function isLoggedLang(value: unknown): value is LoggedLang {
  return typeof value === "string" && (LOGGED_LANGS as readonly string[]).includes(value);
}

/**
 * Разбирает тело `POST /api/search/log`. Возвращает ровно те поля, которые
 * попадут в базу, и ничего сверх них — так что «мы не пишем адрес» видно
 * из типа, а не только из намерения.
 */
export function parseSearchDemandBody(body: unknown, now: Date): SearchDemandParseResult {
  if (typeof body !== "object" || body === null) return { valid: false, error: "invalid_body" };
  const raw = body as Record<string, unknown>;

  if (typeof raw.query !== "string") return { valid: false, error: "invalid_query" };
  const query = raw.query.trim().slice(0, MAX_LOGGED_QUERY_LENGTH);
  // Пустой запрос — не спрос. Окно с пустой строкой печатает разделы
  // сайта само по себе, и записывать «человек открыл и закрыл» незачем:
  // это шум, который вытеснит настоящие строки из любого отчёта.
  if (query.length === 0) return { valid: false, error: "empty_query" };

  if (!isLoggedLang(raw.lang)) return { valid: false, error: "invalid_lang" };

  if (typeof raw.resultCount !== "number" || !Number.isInteger(raw.resultCount)) {
    return { valid: false, error: "invalid_result_count" };
  }
  if (raw.resultCount < 0 || raw.resultCount > MAX_LOGGED_RESULT_COUNT) {
    return { valid: false, error: "invalid_result_count" };
  }

  if (typeof raw.followed !== "boolean") return { valid: false, error: "invalid_followed" };

  return {
    valid: true,
    value: {
      query,
      resultCount: raw.resultCount,
      lang: raw.lang,
      followed: raw.followed,
      hourBucket: hourBucket(now),
    },
  };
}

/** Поля, которые тело запроса НЕ имеет права нести. Список нужен не
 * маршруту (он и так берёт только четыре поля выше), а тесту и читателю:
 * он называет, от чего именно таблица защищена. */
export const FORBIDDEN_LOG_FIELDS = [
  "userId",
  "email",
  "ip",
  "sessionId",
  "userAgent",
  "href",
  "clickedHref",
  "createdAt",
] as const;

export interface SearchDemandRow {
  query: string;
  resultCount: number;
  lang: string;
  followed: boolean;
}

export interface SearchDemandSummary {
  total: number;
  distinctQueries: number;
  zeroResult: number;
  followed: number;
  byLang: Array<{ lang: string; total: number }>;
  topQueries: Array<{ query: string; total: number; zeroResult: number; followed: number }>;
  topZeroResultQueries: Array<{ query: string; total: number }>;
}

/** Сводка одним проходом по строкам. Отдельно от маршрута и от страницы,
 * потому что её читают трое: страница администратора, отчётный скрипт и
 * тест — и все трое обязаны считать одинаково. */
export function summarizeSearchDemand(rows: readonly SearchDemandRow[], topN = 50): SearchDemandSummary {
  const byQuery = new Map<string, { total: number; zeroResult: number; followed: number }>();
  const byLang = new Map<string, number>();
  let zeroResult = 0;
  let followed = 0;

  for (const row of rows) {
    // Ключ группировки — строка, приведённая к нижнему регистру и без
    // краевых пробелов, а НЕ нормализованная поисковой сверткой: смысл
    // отчёта в том, чтобы увидеть «Cuenots» отдельно от «Cuentos», иначе
    // опечатка, ради которой нормализация заводилась, из отчёта исчезнет.
    const key = row.query.trim().toLowerCase();
    const bucket = byQuery.get(key) ?? { total: 0, zeroResult: 0, followed: 0 };
    bucket.total++;
    if (row.resultCount === 0) bucket.zeroResult++;
    if (row.followed) bucket.followed++;
    byQuery.set(key, bucket);

    byLang.set(row.lang, (byLang.get(row.lang) ?? 0) + 1);
    if (row.resultCount === 0) zeroResult++;
    if (row.followed) followed++;
  }

  const entries = [...byQuery.entries()].map(([query, b]) => ({ query, ...b }));
  const sortByTotal = (a: { query: string; total: number }, b: { query: string; total: number }) =>
    b.total - a.total || a.query.localeCompare(b.query);

  return {
    total: rows.length,
    distinctQueries: byQuery.size,
    zeroResult,
    followed,
    byLang: [...byLang.entries()]
      .map(([lang, total]) => ({ lang, total }))
      .sort((a, b) => b.total - a.total || a.lang.localeCompare(b.lang)),
    topQueries: [...entries].sort(sortByTotal).slice(0, topN),
    topZeroResultQueries: entries
      .filter((e) => e.zeroResult > 0)
      .map((e) => ({ query: e.query, total: e.zeroResult }))
      .sort(sortByTotal)
      .slice(0, topN),
  };
}
