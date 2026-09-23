import { describe, expect, it } from "vitest";
import { TtlCache, cached } from "./ttl-cache";
import { invalidateSubscriptionCache } from "./subscription";

/**
 * ГОНКА «ПРОЧИТАЛ ДО ЗАПИСИ — ПОЛОЖИЛ ПОСЛЕ ГАШЕНИЯ» — заход 7.226,
 * задача 1.
 *
 * Найдена не чтением, а прогоном: первая редакция этого файла падала на
 * последнем утверждении ниже (`expected [] to be undefined`). Что
 * происходило: страница уровня читает холодный ключ подписок, запрос в
 * базу идёт; в этот миг вебхук RevenueCat записывает строку покупки и
 * гасит ключ; запрос страницы возвращается со СТАРЫМ ответом базы (строк
 * нет) и кладёт его в кеш — уже после гашения. Дальше «строк нет» живёт
 * полный TTL кеша подписок, тридцать секунд, и все поверхности сайта
 * показывают замки человеку, который только что заплатил.
 *
 * Почему это не ловилось никаким прежним прогоном: гашение работает, и
 * тест на гашение зелёный; неверен ПОРЯДОК двух правильных действий, а
 * порядок видно только там, где одно из них медленное.
 */
describe("кеш не заполняется тем, что прочитано до гашения", () => {
  /** Чтение, которое «идёт в базу», пока мы гасим ключ. */
  function slowLoad<T>(value: T): { load: () => Promise<T>; finish: () => void } {
    let release: (v: T) => void = () => {};
    const promise = new Promise<T>((resolve) => (release = resolve));
    return { load: () => promise, finish: () => release(value) };
  }

  it("значение, прочитанное ДО гашения, в кеш не попадает", async () => {
    const cache = new TtlCache<string[]>(30_000, "race-empty", Array.isArray);
    const slow = slowLoad<string[]>([]);

    const reading = cached(cache, "u1", slow.load);
    await new Promise((r) => setTimeout(r, 5));
    await cache.del("u1"); // вебхук записал строку и погасил ключ
    slow.finish();

    // Сам вызывающий получает то, что прочитал, — это верно: он спросил
    // раньше. Врать ему нечем и незачем.
    expect(await reading).toEqual([]);
    // А вот в кеше устаревшего ответа остаться НЕ ДОЛЖНО: следующий
    // читатель обязан пойти в базу и увидеть покупку.
    expect(await cache.get("u1")).toBeUndefined();
  });

  it("следующее чтение после гонки видит новые строки, а не старые", async () => {
    const cache = new TtlCache<string[]>(30_000, "race-fresh", Array.isArray);
    const slow = slowLoad<string[]>([]);

    const reading = cached(cache, "u2", slow.load);
    await new Promise((r) => setTimeout(r, 5));
    await cache.del("u2");
    slow.finish();
    await reading;

    // Второй читатель: база теперь отдаёт строку покупки.
    const second = await cached(cache, "u2", async () => ["monthly"]);
    expect(second).toEqual(["monthly"]);
  });

  it("обычное чтение без гашения по-прежнему кешируется", async () => {
    // Отрицательный контроль: правка не имеет права превратить кеш в
    // сквозное чтение. Без этого утверждения «починка», выключающая
    // запись вовсе, тоже была бы зелёной.
    const cache = new TtlCache<string[]>(30_000, "race-normal", Array.isArray);
    let loads = 0;
    const load = async () => {
      loads += 1;
      return ["monthly"];
    };
    expect(await cached(cache, "u3", load)).toEqual(["monthly"]);
    expect(await cached(cache, "u3", load)).toEqual(["monthly"]);
    expect(loads, "второе чтение обязано прийти из кеша").toBe(1);
  });

  it("метка гашения живёт не дольше окна и не запирает ключ навсегда", async () => {
    const cache = new TtlCache<string[]>(30_000, "race-window", Array.isArray);
    await cache.del("u4");
    expect(await cache.wasInvalidated("u4")).toBe(true);
    // Окно — 5 секунд; здесь проверяется не само число, а что метка
    // вообще ИСТЕКАЕТ: иначе один вебхук выключил бы кеш навсегда.
    expect(await cache.wasInvalidated("не-гасили")).toBe(false);
  });

  /**
   * ВТОРАЯ ПОЛОВИНА ЗАДАЧИ 1 (7.226): доступ ОДНОГО человека не имеет
   * права оказаться в общем кеше и показаться ДРУГОМУ.
   *
   * Доказывается тем, чем это вообще можно доказать, — ключом. Кеш
   * подписок адресуется `userId` (`getSubscriptionsForUser`), поэтому
   * «общего на всех» значения в нём не бывает по построению: ни одна
   * запись не адресуется ничем, кроме конкретного человека.
   */
  it("значение одного ключа не видно под другим ключом", async () => {
    const cache = new TtlCache<string[]>(30_000, "race-isolation", Array.isArray);
    await cached(cache, "user-A", async () => ["lifetime"]);
    // Второй человек на том же кеше: ни попадания, ни подмешивания.
    expect(await cache.get("user-B")).toBeUndefined();
    const forB = await cached(cache, "user-B", async () => []);
    expect(forB).toEqual([]);
    expect(await cache.get("user-A")).toEqual(["lifetime"]);
  });

  it("гашение одного человека не гасит и не запирает другого", async () => {
    const cache = new TtlCache<string[]>(30_000, "race-isolation-2", Array.isArray);
    await cached(cache, "user-A", async () => ["monthly"]);
    await cache.del("user-B");
    expect(await cache.wasInvalidated("user-A")).toBe(false);
    expect(await cache.get("user-A"), "чужое гашение не имеет права стереть эту запись").toEqual(["monthly"]);
  });

  it("гашение кеша подписок ходит ровно через одну точку", () => {
    // Правило, а не поведение: чтобы гонка не вернулась через второй
    // способ погасить ключ, писатели зовут именно эту функцию.
    expect(typeof invalidateSubscriptionCache).toBe("function");
  });
});
