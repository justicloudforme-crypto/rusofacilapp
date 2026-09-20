import { describe, expect, it, vi } from "vitest";

/**
 * ПОВЕДЕНЧЕСКАЯ ПРОБА К ДОЛГУ 279 — 20.09.2026, заход 7.219.
 *
 * Соседний `src/lib/db-read-resilience.test.ts` читает ИСХОДНИК и говорит
 * «запрос стоит внутри try». Это необходимо, но не достаточно: try можно
 * поставить и всё равно уронить страницу — например, пробросив ошибку
 * дальше или вернув `undefined` там, где дальше идёт разыменование.
 *
 * Здесь проверяется ИСХОД. Чтение `MediaOverride` отвечает ровно тем, чем
 * ответил прод в Sentry `JAVASCRIPT-NEXTJS-10` — `BLOCKED: Operation was
 * blocked`, — и `generateMetadata` обязана вернуть живые метаданные по
 * статической основе `mediaData.json`, а не бросить.
 *
 * Позитивный контроль — последний тест файла: на ПРЕЖНЕМ коде (голый
 * `await db.mediaOverride.findUnique(...)` без try) та же подсадка
 * проходит насквозь и роняет вызов. Без него зелёный цвет выше ничего не
 * значил бы.
 */

/** Точно та ошибка, что пришла с прода: Prisma заворачивает отказ Turso. */
function blockedByTurso(): Error {
  const error = new Error(
    "\nInvalid `prisma.mediaOverride.findUnique()` invocation:\n\n\nBLOCKED: Operation was blocked"
  );
  error.name = "PrismaClientKnownRequestError";
  return error;
}

const findUnique = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    mediaOverride: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

const { getMediaById, getAllMedia } = await import("@/lib/media/data");
const mediaData = (await import("@/lib/media/mediaData.json")).default as Record<
  string,
  { id: string; title: string; level: string }
>;

/** Первый настоящий элемент каталога — не выдуманный id. */
const SAMPLE_ID = Object.keys(mediaData)[0];

describe("страница медиа переживает отказ чтения MediaOverride", () => {
  it("каталог не пуст, иначе проба ничего не проверяет", () => {
    expect(Object.keys(mediaData).length).toBeGreaterThan(200);
    expect(SAMPLE_ID).toBeTruthy();
  });

  it("getMediaById отдаёт статическую основу, когда база отвечает BLOCKED", async () => {
    findUnique.mockRejectedValue(blockedByTurso());
    const item = await getMediaById(SAMPLE_ID);
    expect(item).not.toBeNull();
    expect(item!.id).toBe(SAMPLE_ID);
    expect(item!.title).toBe(mediaData[SAMPLE_ID].title);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("generateMetadata отдаёт заголовок и описание, когда база отвечает BLOCKED", async () => {
    findUnique.mockRejectedValue(blockedByTurso());
    const { generateMetadata } = await import("./page");
    const metadata = await generateMetadata({
      params: Promise.resolve({ lang: "es", id: SAMPLE_ID }),
    } as never);
    expect(typeof metadata.title).toBe("string");
    expect((metadata.title as string).length).toBeGreaterThan(0);
    expect(typeof metadata.description).toBe("string");
    expect((metadata.description as string).length).toBeGreaterThan(0);
  });

  it("getAllMedia отдаёт весь каталог, когда база отвечает BLOCKED", async () => {
    findMany.mockRejectedValue(blockedByTurso());
    const items = await getAllMedia();
    expect(items.length).toBe(Object.keys(mediaData).length);
  });

  it("позитивный контроль: на ПРЕЖНЕМ коде та же подсадка роняет вызов", async () => {
    // Прежний код — одна строка: `const override = await
    // db.mediaOverride.findUnique(...)` без try. Воспроизведена здесь
    // дословно, чтобы было видно: подсадка настоящая, а зелёный цвет выше
    // даёт именно try/catch, а не безобидность самой ошибки.
    const previousCode = async (id: string) => {
      const override = await findUnique({ where: { mediaId: id } });
      return override;
    };
    findUnique.mockRejectedValue(blockedByTurso());
    await expect(previousCode(SAMPLE_ID)).rejects.toThrow(/BLOCKED: Operation was blocked/);
  });
});
