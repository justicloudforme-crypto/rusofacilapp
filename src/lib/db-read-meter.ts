import "server-only";

/**
 * ПРИБОР: СКОЛЬКО РАЗ ЗА ОДИН ЗАПРОС МЫ ХОДИМ В БАЗУ И СКОЛЬКО СТРОК ЧИТАЕМ.
 *
 * Заход 7.222. Замер 7.220 («главная гостю 6 запросов, вошедшему 9»)
 * считался расширением клиента Prisma и жил ровно один заход: следующий
 * читатель повторить его не мог, потому что инструмента не осталось. Здесь
 * он оставлен в репозитории и запирается сторожем.
 *
 * ПОЧЕМУ СЧЁТ НА УРОВНЕ АДАПТЕРА, А НЕ РАСШИРЕНИЕМ КЛИЕНТА. Расширение
 * видит ВЫЗОВЫ (`db.audioAsset.findMany` — один), а платим мы за ПОХОДЫ
 * (одно `findMany` с `contentId: { in: [5771 значение] }` Prisma режет на
 * несколько SQL-запросов, потому что у SQLite предел на число
 * подставляемых значений). Разница между этими двумя числами и есть
 * половина заходной работы, поэтому считается то, что уходит в провод.
 *
 * ВЫКЛЮЧЕН ПО УМОЛЧАНИЮ И НЕ МОЖЕТ ВКЛЮЧИТЬСЯ САМ. Единственный
 * выключатель — переменная `MEASURE_DB_READS` с путём к файлу журнала.
 * Без неё `meterAdapter` отдаёт тот же самый объект, что получил, —
 * не обёртку, не копию, а его же: проверяется тестом на тождество.
 * Держится сторожем `check:read-meter-off`.
 *
 * Журнал — JSONL, по строке на поход: вид вызова, первые слова SQL и
 * сколько строк вернулось. Сводит его `scripts/measure-page-reads.mjs`:
 * он обнуляет журнал ПЕРЕД замеряемым запросом и читает его после, поэтому
 * метка запроса здесь не нужна и её намеренно нет — меряется по одному
 * запросу за раз, а не по признаку внутри параллельных.
 */
import { appendFileSync } from "node:fs";

/**
 * Первые слова SQL — ровно столько, чтобы отличить таблицу и вид запроса,
 * и ни байтом больше: в журнал не должны попадать значения из базы.
 *
 * Имя берётся ПОСЛЕДНИМ звеном составного: Prisma пишет
 * `FROM "main"."User"`, и наивная регулярка отдавала бы `main` у всех
 * таблиц сразу. Первый прогон 7.222 так и выглядел — одиннадцать строк
 * `{"SELECT main": N}`, то есть разбивки не было вовсе.
 */
export function sqlShape(sql: string): string {
  const flat = sql.replace(/\s+/g, " ").trim();
  // Регулярки ЛИТЕРАЛАМИ, а не собранные из строк. Правило проекта
  // (`data-into-parser.test.ts`, раздел 7.41): любое выражение, собранное
  // подстановкой, обязано эту подстановку экранировать — и проверяется оно
  // по форме записи, а не по происхождению значения. Здесь подставлялось
  // бы литеральное слово `FROM`, но сторож об этом знать не обязан, и
  // выносить исключение ради прибора было бы худшей из двух правок.
  const table =
    /\bFROM\s+[`"']?([A-Za-z_]\w*)[`"']?(?:\s*\.\s*[`"']?([A-Za-z_]\w*)[`"']?)?/i.exec(flat) ??
    /\bINTO\s+[`"']?([A-Za-z_]\w*)[`"']?(?:\s*\.\s*[`"']?([A-Za-z_]\w*)[`"']?)?/i.exec(flat) ??
    /\bUPDATE\s+[`"']?([A-Za-z_]\w*)[`"']?(?:\s*\.\s*[`"']?([A-Za-z_]\w*)[`"']?)?/i.exec(flat);
  const verb = flat.split(" ")[0]?.toUpperCase() ?? "?";
  return `${verb} ${table ? (table[2] ?? table[1]) : "?"}`;
}

interface MeteredResult {
  rows?: unknown[];
}

/**
 * Оборачивает фабрику адаптера так, чтобы каждый поход в базу попадал в
 * журнал. Без `MEASURE_DB_READS` отдаёт ПЕРЕДАННЫЙ объект без изменений.
 */
export function meterAdapter<T extends object>(adapter: T): T {
  const path = process.env.MEASURE_DB_READS;
  if (!path) return adapter;

  const write = (kind: string, sql: string, rows: number) => {
    try {
      appendFileSync(
        path,
        `${JSON.stringify({ kind, shape: sqlShape(sql), rows })}\n`
      );
    } catch {
      /* прибор не имеет права ронять то, что меряет */
    }
  };

  const wrapQueryable = (queryable: object): object =>
    new Proxy(queryable, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") return value;
        if (prop === "queryRaw" || prop === "executeRaw") {
          return async (...args: unknown[]) => {
            const result = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
            const sql = (args[0] as { sql?: string } | undefined)?.sql ?? "";
            const rows = Array.isArray((result as MeteredResult)?.rows)
              ? (result as MeteredResult).rows!.length
              : typeof result === "number"
                ? 0
                : 0;
            write(String(prop), sql, rows);
            return result;
          };
        }
        if (prop === "startTransaction") {
          return async (...args: unknown[]) => {
            const tx = await (value as (...a: unknown[]) => Promise<object>).apply(target, args);
            return wrapQueryable(tx);
          };
        }
        return value.bind(target);
      },
    });

  return new Proxy(adapter, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === "connect" && typeof value === "function") {
        return async (...args: unknown[]) => {
          const connection = await (value as (...a: unknown[]) => Promise<object>).apply(target, args);
          return wrapQueryable(connection);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as T;
}
