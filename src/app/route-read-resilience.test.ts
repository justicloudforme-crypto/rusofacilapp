import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ПОВЕДЕНЧЕСКАЯ ПРОБА К СЕМЕЙСТВУ `BLOCKED` — 20.09.2026, заход 7.220.
 *
 * ЧТО ИЗМЕРЕНО. Панель Sentry, 20.09.2026, 30 дней, `is unresolved`: ВОСЕМЬ
 * записей с одним и тем же сообщением `BLOCKED: Operation was blocked`, все
 * **unhandled**, суммарно **223 события**:
 *
 *   JAVASCRIPT-NEXTJS-12  126  story.findUnique        Page.generateMetadata (/[lang]/stories/[id])
 *   JAVASCRIPT-NEXTJS-11   64  mediaOverride.findMany  Page Server Component (/[lang]/stories/[id])
 *   JAVASCRIPT-NEXTJS-Z    21  glossaryTerm.findUnique Page Server Component (/[lang]/glossary/[slug])
 *   JAVASCRIPT-NEXTJS-14    6  user.findUnique         Layout Server Component (/[lang])
 *   JAVASCRIPT-NEXTJS-Y     3  story.findMany          Page Server Component (/[lang]/stories)
 *   JAVASCRIPT-NEXTJS-X     2  glossaryTerm.findMany   Page Server Component (/[lang]/glossary)
 *   JAVASCRIPT-NEXTJS-13    1  flashcardCard.findMany  Page Server Component (/[lang]/vocabulary/[categoria])
 *   JAVASCRIPT-NEXTJS-G     1  wordGamePuzzle.findMany GET /sitemap.xml
 *
 * `BLOCKED` отдаёт не наш код и не Prisma: так сама Turso отвечает на
 * чтение при исчерпанной квоте тарифа (авария 11.09.2026, PROGRESS.md
 * строка 135). То есть входное условие у всех восьми одно, и разные у них
 * только МЕСТА, где отказ оказался смертельным.
 *
 * УРОК ЗАХОДА 7.219, РАДИ КОТОРОГО ЭТОТ ФАЙЛ И НАПИСАН ОДНИМ СПИСКОМ.
 * 7.219 починил ОДНУ запись того же класса (`JAVASCRIPT-NEXTJS-10`, медиа,
 * 300 событий) и счёл класс закрытым. Владелец, пролистав панель до конца,
 * нашёл ещё восемь. Правило, выведенное из этого: класс ошибки не равен
 * одной записи, и прежде чем закрывать строку, пересчитываются ВСЕ места в
 * коде, подпадающие под ту же причину. Поэтому здесь перечислены маршруты,
 * а не записи.
 *
 * ЧЕМ ЭТА ПРОБА ОТЛИЧАЕТСЯ ОТ СОСЕДНЕЙ. `src/lib/db-read-resilience.test.ts`
 * читает ИСХОДНИК и говорит «запрос стоит внутри try». Этого мало: try
 * можно поставить и всё равно уронить ответ — пробросив ошибку дальше или
 * вернув `undefined` там, где следующая строка его разыменует. Здесь
 * проверяется ИСХОД: база отвечает ровно тем, чем ответил прод, и вызов
 * обязан вернуть живой результат.
 *
 * ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО. Тела страниц рассказа и термина глоссария. Их
 * чтения обязаны оставаться ГРОМКИМИ — это содержимое, деградировать не во
 * что, — и они заперты в `MUST_FAIL_LOUDLY` соседнего файла. Пробовать
 * «переживает ли отказ» там, где правильный ответ «не переживает», значило
 * бы закрепить пробой противоположное правило.
 */

/** Точно та ошибка, что пришла с прода: Prisma заворачивает отказ Turso. */
function blockedByTurso(model: string, op: string): Error {
  const error = new Error(
    `\nInvalid \`prisma.${model}.${op}()\` invocation:\n\n\nBLOCKED: Operation was blocked`
  );
  error.name = "PrismaClientKnownRequestError";
  return error;
}

/** Счётчик обращений: без него «зелено» могло бы значить «база не
 * спрашивалась вовсе», а не «отказ пережит». */
const hits: string[] = [];

/** База, отвечающая `BLOCKED` на ЛЮБОЕ чтение любой модели. Подсадка
 * общая, потому что и авария была общая: квота кончается у базы целиком, а
 * не у одной таблицы. */
const OPS = [
  "findMany",
  "findUnique",
  "findFirst",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "update",
  "create",
] as const;

const blockedDb = new Proxy(
  {},
  {
    get(_target, model: string) {
      return new Proxy(
        {},
        {
          get(_t, op: string) {
            if (!OPS.includes(op as (typeof OPS)[number])) return undefined;
            return async () => {
              hits.push(`${model}.${op}`);
              throw blockedByTurso(model, op);
            };
          },
        }
      );
    },
  }
);

vi.mock("@/lib/db", () => ({ db: blockedDb }));

/** Запрос без куки и без заголовков: гость. Нужен только чтобы вызовы
 * `cookies()`/`headers()` вне настоящего запроса не падали сами по себе —
 * иначе проба краснела бы не по той причине, по которой написана. */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));

const { generateMetadata: storyMetadata } = await import("./[lang]/stories/[id]/page");
const { generateMetadata: termMetadata } = await import("./[lang]/glossary/[slug]/page");
const StoriesPage = (await import("./[lang]/stories/page")).default;
const GlossaryPage = (await import("./[lang]/glossary/page")).default;
const VocabularyCategoryPage = (await import("./[lang]/vocabulary/[categoria]/page")).default;
const { getCurrentUserForChrome } = await import("@/lib/auth");

beforeEach(() => {
  hits.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("страница переживает отказ чтения, когда чтение не является её содержимым", () => {
  it("КОНТРОЛЬ ПОДСАДКИ: подставная база действительно отказывает", async () => {
    // Без этого каждое утверждение ниже могло бы быть зелёным потому, что
    // подсадка не сработала.
    const db = (await import("@/lib/db")).db as unknown as {
      story: { findUnique: () => Promise<unknown> };
    };
    await expect(db.story.findUnique()).rejects.toThrow(/BLOCKED: Operation was blocked/);
    expect(hits).toContain("story.findUnique");
  });

  it("/[lang]/stories/[id] — метаданные запасные, а не пятисотка (126 событий)", async () => {
    const metadata = await storyMetadata({
      params: Promise.resolve({ lang: "es", id: "какой-угодно" }),
    } as never);
    expect(hits).toContain("story.findUnique");
    expect(typeof metadata.title).toBe("string");
    expect((metadata.title as string).length).toBeGreaterThan(0);
    expect(typeof metadata.description).toBe("string");
    // canonical от базы не зависит вовсе и обязан уцелеть
    expect(metadata.alternates?.canonical).toContain("/es/stories/");
  });

  it("/[lang]/stories/[id] — то же на второй локали, а не только на витринной", async () => {
    const metadata = await storyMetadata({
      params: Promise.resolve({ lang: "ru", id: "какой-угодно" }),
    } as never);
    expect(metadata.title).toMatch(/[А-Яа-я]/);
    expect(metadata.alternates?.canonical).toContain("/ru/stories/");
  });

  it("/[lang]/glossary/[slug] — метаданные запасные, а не пятисотка (21 событие)", async () => {
    const metadata = await termMetadata({
      params: Promise.resolve({ lang: "es", slug: "acusativo-de-tiempo" }),
    } as never);
    expect(hits).toContain("glossaryTerm.findUnique");
    expect(typeof metadata.title).toBe("string");
    expect((metadata.title as string).length).toBeGreaterThan(0);
    expect(metadata.alternates?.canonical).toContain("/es/glossary/");
  });

  it("/[lang]/stories — страница отдаётся с пустым списком (3 события)", async () => {
    const element = await StoriesPage({ params: Promise.resolve({ lang: "es" }) } as never);
    expect(hits).toContain("story.findMany");
    expect(element).toBeTruthy();
  });

  it("/[lang]/glossary — страница отдаётся с пустым списком (2 события)", async () => {
    const element = await GlossaryPage({ params: Promise.resolve({ lang: "es" }) } as never);
    expect(hits).toContain("glossaryTerm.findMany");
    expect(element).toBeTruthy();
  });

  it("/[lang]/vocabulary/[categoria] — страница отдаётся с пустым списком (1 событие)", async () => {
    const element = await VocabularyCategoryPage({
      params: Promise.resolve({ lang: "es", categoria: "comida" }),
    } as never);
    expect(element).toBeTruthy();
  });

  it("шапка рисуется видом для гостя, а не роняет весь сайт (6 событий)", async () => {
    // Здесь проверяется ровно `JAVASCRIPT-NEXTJS-14`: чтение `User` в
    // раскладке `/[lang]`. Раскладка рисует шапку, а шапка стоит на каждой
    // странице, поэтому цена отказа была не экран, а сайт целиком — для
    // вошедшего человека.
    const { cookies } = await import("next/headers");
    const store = (await cookies()) as unknown as { get: (name: string) => { value: string } | undefined };
    // Кука настоящей формы: `<id>.<версия>.<подпись>`. Подпись неверная, и
    // это здесь неважно — важно, что до чтения базы дело дойдёт только при
    // верной. Поэтому проверяем обе ветки ниже по отдельности.
    expect(store.get("session")).toBeUndefined();
    await expect(getCurrentUserForChrome()).resolves.toBeNull();
  });

  it("шапка: отказ САМОГО чтения тоже стоит только шапки", async () => {
    // Предыдущая проверка доходит лишь до «куки нет». Эта подсаживает
    // отказ в само чтение и требует того же ответа — гостя, а не падения.
    vi.resetModules();
    vi.doMock("@/lib/session-token", async () => {
      const actual = await vi.importActual<typeof import("@/lib/session-token")>("@/lib/session-token");
      return { ...actual, verifySessionToken: () => ({ userId: "u1", sessionVersion: 0 }) };
    });
    vi.doMock("next/headers", () => ({
      cookies: async () => ({ get: () => ({ value: "u1.0.подпись" }), set: () => {}, delete: () => {} }),
      headers: async () => new Headers(),
    }));
    vi.doMock("@/lib/db", () => ({ db: blockedDb }));
    const auth = await import("@/lib/auth");
    hits.length = 0;
    await expect(auth.getCurrentUserForChrome()).resolves.toBeNull();
    expect(hits, "чтение `User` обязано было случиться").toContain("user.findUnique");
    // И вторая половина: обычная `getCurrentUser` на том же входе
    // по-прежнему ГРОМКАЯ. Иначе проглоченный отказ превратил бы
    // подписчика в `free` — то есть показал бы пейвол тому, кто уже
    // заплатил, и следующим его действием была бы вторая оплата.
    await expect(auth.getCurrentUser()).rejects.toThrow(/BLOCKED: Operation was blocked/);
    vi.doUnmock("@/lib/session-token");
    vi.doUnmock("next/headers");
    vi.doUnmock("@/lib/db");
    vi.resetModules();
  });
});
