import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import type { SearchSources } from "./records";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ExamContent } from "@/lib/exams/types";
import type { MediaItem } from "@/lib/media/types";

/**
 * Чтение всего, по чему ищут, — БЕЗ пометки `server-only`.
 *
 * Пометки здесь нет намеренно, и это не послабление. Сторож
 * `check:search-coverage` собирает индекс из настоящей базы и обязан
 * читать источники ровно теми же строками, что читает сайт; а модуль с
 * `import "server-only"` под `tsx` не разрешается вовсе (тот же барьер,
 * из-за которого prisma/check-media-embeds.ts и ещё пять скриптов
 * повторяют чтение своими руками). Повторить чтение здесь значило бы
 * завести второй источник правды об индексе — то есть дефект «правило
 * опубликовано наполовину», который в этом файле проекта уже описан
 * дважды (7.103, 7.93).
 *
 * Опасности от снятой пометки нет: модуль не читает ни куки, ни сессию,
 * ни секрет — только публичное содержимое каталога. Кеш и всё, что
 * зависит от посетителя, живут этажом выше, в `index-server.ts`, и
 * `server-only` стоит там.
 *
 * Почему источники читаются напрямую, а не через готовые модули:
 *
 *  * карточки — `db.flashcardCard.findMany` вместо `getFlashcardIndex`:
 *    индексу нужны шесть колонок и НЕ нужна озвучка, а тот кеш тащит
 *    join с `AudioAsset` и держит блоб на 2,3 МБ;
 *  * медиа — сам `mediaData.json` вместо `getAllMedia`: наложение
 *    `MediaOverride` меняет субтитры, статус встраивания и приписку к
 *    источнику — ни одного из полей, которые печатает поиск (id,
 *    название, уровень, бесплатность). Читать ради них таблицу значит
 *    платить запросом за то, что заведомо не изменится.
 */

const MEDIA_DATA_FILE = path.join(process.cwd(), "src/lib/media/mediaData.json");
const EXAMS_DATA_FILE = path.join(process.cwd(), "src/lib/exams/content.json");
const DICTIONARY_FILES: Record<"es" | "ru", string> = {
  es: path.join(process.cwd(), "src/dictionaries/es.json"),
  ru: path.join(process.cwd(), "src/dictionaries/ru.json"),
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf-8")) as T;
}

interface RawPuzzleRow {
  type: string;
  level: string;
  sequence: number;
  topic: string | null;
  premiumOnly: number | boolean;
  curved: number | boolean;
  wordCount: number | bigint;
}

/**
 * Пазлы читаются сырым запросом, и это не украшательство.
 *
 * Название пазла содержит число слов, а число слов лежит внутри колонки
 * `words` — JSON-массива размещений. Прочитать 3277 таких колонок значит
 * перетащить порядка шести мегабайт ради одного целого на строку, и
 * платить это заново на каждое истечение TTL в каждом регионе. SQLite (и
 * libsql) умеет посчитать длину массива у себя: `json_array_length(words)`
 * возвращает то же число, переслав четыре байта вместо двух килобайт.
 *
 * Если json1 в сборке недоступен, запрос падает — и тогда читается
 * обычный `findMany` с разбором JSON. Медленно, но правильно: подставить
 * в название выдуманное число слов нельзя, оно печатается на самой
 * странице.
 */
async function loadPuzzles(): Promise<SearchSources["puzzles"]> {
  try {
    const rows = await db.$queryRaw<RawPuzzleRow[]>`
      SELECT "type", "level", "sequence", "topic", "premiumOnly", "curved",
             json_array_length("words") AS "wordCount"
      FROM "WordGamePuzzle"
    `;
    return rows.map((row) => ({
      type: row.type,
      level: row.level,
      sequence: Number(row.sequence),
      topic: row.topic,
      wordCount: Number(row.wordCount),
      premiumOnly: Boolean(row.premiumOnly),
      curved: Boolean(row.curved),
    }));
  } catch (error) {
    console.error("[search] json_array_length недоступен — читаю колонку words целиком", error);
    const rows = await db.wordGamePuzzle.findMany({
      select: { type: true, level: true, sequence: true, topic: true, premiumOnly: true, curved: true, words: true },
    });
    return rows.map((row) => {
      let wordCount = 0;
      try {
        const parsed: unknown = JSON.parse(row.words);
        if (Array.isArray(parsed)) wordCount = parsed.length;
      } catch {
        // Пазл с нечитаемым JSON всё равно должен попасть в индекс: его
        // страница существует, и не найти её хуже, чем назвать «0 слов».
      }
      return { ...row, wordCount };
    });
  }
}

/**
 * Экзамены: статический `content.json` плюс строки таблицы `Exam`,
 * которые его перекрывают, — тот же порядок приоритета, что у самой
 * страницы экзамена (exams/content.ts). Иначе поиск находил бы старое
 * название экзамена, переименованного через админку.
 */
async function loadExams(): Promise<SearchSources["exams"]> {
  const byKey = new Map<string, { level: string; slug: string; title: string }>();
  const staticExams = await readJson<Record<string, ExamContent>>(EXAMS_DATA_FILE);
  for (const exam of Object.values(staticExams)) {
    byKey.set(`${exam.level}/${exam.slug}`, { level: exam.level, slug: exam.slug, title: exam.title });
  }
  try {
    const rows = await db.exam.findMany({ select: { level: true, examSlug: true, contentJson: true } });
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.contentJson) as { title?: unknown };
        if (typeof parsed.title === "string" && parsed.title.trim()) {
          byKey.set(`${row.level}/${row.examSlug}`, { level: row.level, slug: row.examSlug, title: parsed.title });
        }
      } catch {
        // Испорченная строка — экзамен остаётся под статическим
        // названием, ровно как показала бы его сама страница.
      }
    }
  } catch (error) {
    console.error("[search] не удалось прочитать Exam — экзамены только из content.json", error);
  }
  return [...byKey.values()];
}

/**
 * Все источники индекса. Каждое чтение обёрнуто отдельно: отказ одной
 * таблицы стоит своего раздела, а не всего поиска. Это то же правило, по
 * которому живёт sitemap.ts, и оно там оплачено аварией 29.08.2026.
 */
export async function loadSearchSources(): Promise<SearchSources> {
  const soften = async <T>(what: string, read: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await read();
    } catch (error) {
      console.error(`[search] раздел «${what}» не прочитан — индекс собирается без него`, error);
      return fallback;
    }
  };

  const [es, ru, exams, stories, media, flashcards, idioms, glossary, puzzles] = await Promise.all([
    readJson<Dictionary>(DICTIONARY_FILES.es),
    readJson<Dictionary>(DICTIONARY_FILES.ru),
    soften("экзамены", loadExams, []),
    soften(
      "рассказы",
      () => db.story.findMany({ select: { id: true, title: true, level: true, isPremium: true, premiumOnly: true } }),
      [],
    ),
    soften(
      "медиа",
      async () => {
        const store = await readJson<Record<string, MediaItem>>(MEDIA_DATA_FILE);
        return Object.values(store).map((m) => ({ id: m.id, title: m.title, level: m.level as string, free: m.free }));
      },
      [],
    ),
    soften(
      "карточки словаря",
      () =>
        db.flashcardCard.findMany({
          select: { id: true, russian: true, translationEs: true, transcription: true, category: true, level: true },
        }),
      [],
    ),
    soften("идиомы", () => db.idiom.findMany({ select: { id: true, phrase: true, spanishEquivalent: true, level: true } }), []),
    soften("глоссарий", () => db.glossaryTerm.findMany({ select: { slug: true, term: true, russianEquivalent: true } }), []),
    soften("игры", loadPuzzles, []),
  ]);

  return { dictionaries: { es, ru }, exams, stories, media, flashcards, idioms, glossary, puzzles };
}
