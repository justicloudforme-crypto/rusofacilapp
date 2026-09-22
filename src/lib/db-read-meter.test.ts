import { describe, expect, it, afterEach } from "vitest";
import { meterAdapter, sqlShape } from "./db-read-meter";

const ORIGINAL = process.env.MEASURE_DB_READS;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.MEASURE_DB_READS;
  else process.env.MEASURE_DB_READS = ORIGINAL;
});

describe("sqlShape", () => {
  it("берёт имя таблицы ПОСЛЕДНИМ звеном составного имени", () => {
    // Prisma пишет `FROM "main"."User"`. Наивная регулярка отдавала `main`
    // у всех таблиц сразу, и первый прогон 7.222 напечатал одиннадцать
    // одинаковых строк `SELECT main` вместо разбивки. Это тот случай.
    expect(sqlShape(`SELECT "main"."User"."id" FROM "main"."User" WHERE x = ?`)).toBe("SELECT User");
    expect(sqlShape(`SELECT * FROM "AudioAsset" WHERE 1`)).toBe("SELECT AudioAsset");
    expect(sqlShape(`INSERT INTO "main"."StudyDay" ("a") VALUES (?)`)).toBe("INSERT StudyDay");
    expect(sqlShape(`UPDATE "main"."User" SET "a" = ?`)).toBe("UPDATE User");
  });

  it("не печатает значений из базы — только глагол и таблицу", () => {
    const shape = sqlShape(`SELECT * FROM "main"."User" WHERE "email" = 'secret@example.com'`);
    expect(shape).toBe("SELECT User");
    expect(shape).not.toContain("secret@example.com");
  });
});

describe("meterAdapter", () => {
  it("БЕЗ MEASURE_DB_READS отдаёт ТОТ ЖЕ объект, а не обёртку", () => {
    // Это главная половина сторожа: на выкате прибора быть не должно, и
    // «не должно» здесь означает тождество, а не «обёртка ничего не пишет».
    delete process.env.MEASURE_DB_READS;
    const adapter = { connect: () => Promise.resolve({}) };
    expect(meterAdapter(adapter)).toBe(adapter);
  });

  it("С MEASURE_DB_READS отдаёт ДРУГОЙ объект — иначе мерить было бы нечем", () => {
    // Позитивный контроль к предыдущему: тест на тождество, который не
    // умеет отличить включённый прибор от выключенного, ничего не держит.
    process.env.MEASURE_DB_READS = "/dev/null";
    const adapter = { connect: () => Promise.resolve({}) };
    expect(meterAdapter(adapter)).not.toBe(adapter);
  });
});
