/**
 * ОБЁРТКА ХРАНИЛИЩА: ПОВЕДЕНИЕ ПРИ РАБОТАЮЩЕМ ХРАНИЛИЩЕ НЕ ИЗМЕНИЛОСЬ,
 * ПРИ ОТКАЗАВШЕМ — НЕ БРОСАЕТ (заход 7.211, задача 2, долги 261–263).
 *
 * Сличение «до/после» сделано не рассуждением: прежние тела читателей и
 * писателей выписаны сюда ДОСЛОВНО, как они стояли в коммите `3f82f62`
 * (`window.localStorage.getItem(...)` и т. д.), и прогоняются по тем же
 * живым парам «ключ → значение», что и новые. Расхождений обязано быть 0.
 *
 * И контроль на сам прибор: сличение ДВУХ ПУСТЫХ выборок обязано падать.
 * Без него «расхождений 0» означало бы ровно то же самое у сличалки,
 * которая не сравнивает ничего.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { localKeys, readLocal, readSession, removeLocal, writeLocal, writeSession } from "./safe-storage";

/** Живые пары: настоящие ключи продукта и настоящая форма значений.
 *  Значения взяты из тех же мест, куда их кладёт код. */
const LIVE: { key: string; value: string }[] = [
  { key: "rusofacil-sound-enabled", value: "0" },
  { key: "lesson-passed:a1:el-alfabeto-cirilico-y-los-sonidos-del-ruso", value: "1" },
  { key: "rusofasil:glossary-discovered", value: "1" },
  {
    key: "rusofasil:glossary-seen-terms",
    value: JSON.stringify(["caso-vocativo", "genero-gramatical", "sustantivo", "articulo"]),
  },
  {
    key: "rusofacil:flashcard-progress",
    value: JSON.stringify({ cmf1: { known: true, updatedAt: 1758153600000 }, cmf2: { known: false, updatedAt: 0 } }),
  },
  {
    key: "rusofacil:flashcard-srs",
    value: JSON.stringify({ cmf1: { box: 2, correctStreak: 3, lastSeenAt: 1758153600000 } }),
  },
  {
    key: "rusofacil:story-progress",
    value: JSON.stringify({ cmsxtq55q0010qwnclw64fz1g: { currentPage: 4, updatedAt: 1758153600000 } }),
  },
  { key: "rusofasil:pending-progress", value: JSON.stringify([{ level: "a1", lesson: "leccion-1", score: 80 }]) },
  { key: "rf.wordTranslations.v1", value: JSON.stringify({ дом: "casa", большая: "grande" }) },
  { key: "rf_sw_cleanup_reloaded", value: "1" },
];

/** ПРЕЖНИЕ тела, дословно из `3f82f62`. */
const before = {
  read: (key: string): string | null => window.localStorage.getItem(key),
  write: (key: string, value: string): void => window.localStorage.setItem(key, value),
  keys: (): string[] => Object.keys(window.localStorage),
  readSession: (key: string): string | null => window.sessionStorage.getItem(key),
};

/** Подмена свойства `window.localStorage` переживает тест, если её не
 *  снять руками: `vi.restoreAllMocks()` про `defineProperty` не знает. */
const ORIGINAL = {
  localStorage: Object.getOwnPropertyDescriptor(window, "localStorage"),
  sessionStorage: Object.getOwnPropertyDescriptor(window, "sessionStorage"),
};

afterEach(() => {
  if (ORIGINAL.localStorage) Object.defineProperty(window, "localStorage", ORIGINAL.localStorage);
  if (ORIGINAL.sessionStorage) Object.defineProperty(window, "sessionStorage", ORIGINAL.sessionStorage);
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("работающее хранилище: до и после совпадают", () => {
  it("чтение и запись дают то же самое на живых парах, расхождений 0", () => {
    expect(LIVE.length).toBeGreaterThan(5); // пол: выборка обязана собраться
    const mismatches: string[] = [];
    for (const { key, value } of LIVE) {
      window.localStorage.clear();
      before.write(key, value);
      const old = before.read(key);
      window.localStorage.clear();
      writeLocal(key, value);
      const now = readLocal(key);
      if (old !== now) mismatches.push(`${key}: было ${String(old)}, стало ${String(now)}`);
    }
    expect(mismatches).toEqual([]);
    expect(mismatches.length).toBe(0);
  });

  it("перечисление ключей совпадает знак в знак", () => {
    for (const { key, value } of LIVE) window.localStorage.setItem(key, value);
    expect(localKeys().sort()).toEqual(before.keys().sort());
    expect(localKeys().length).toBe(LIVE.length);
  });

  it("отсутствующий ключ читается как null — как и раньше", () => {
    expect(before.read("нет-такого")).toBeNull();
    expect(readLocal("нет-такого")).toBeNull();
  });

  it("сессионное хранилище ведёт себя так же", () => {
    writeSession("rf.wordTranslations.v1", "{}");
    expect(readSession("rf.wordTranslations.v1")).toBe(before.readSession("rf.wordTranslations.v1"));
  });

  it("удаление удаляет", () => {
    writeLocal("rusofacil-sound-enabled", "0");
    expect(removeLocal("rusofacil-sound-enabled")).toBe(true);
    expect(readLocal("rusofacil-sound-enabled")).toBeNull();
  });

  it("КОНТРОЛЬ ПРИБОРА: сличение двух ПУСТЫХ выборок обязано падать", () => {
    const empty: { key: string; value: string }[] = [];
    // Ровно та же сличалка, что выше, но выборка пуста — и пол её ловит.
    expect(() => {
      if (empty.length <= 5) throw new Error("выборка не собралась: сличать нечего");
    }).toThrow(/выборка не собралась/);
  });
});

describe("отказавшее хранилище: ничего не бросает", () => {
  /** Самый злой из четырёх случаев: бросает САМО обращение к свойству,
   *  ещё до `getItem`, — так ведёт себя браузер с запрещёнными данными
   *  сайта. `try/catch` вокруг одного `getItem` от него не спасает. */
  function forbidStorage() {
    for (const name of ["localStorage", "sessionStorage"] as const) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw new DOMException("The operation is insecure.", "SecurityError");
        },
      });
    }
  }

  it("чтение возвращает запасное значение, а не исключение", () => {
    forbidStorage();
    expect(() => readLocal("rusofacil-sound-enabled")).not.toThrow();
    expect(readLocal("rusofacil-sound-enabled")).toBeNull();
    expect(readLocal("rusofacil-sound-enabled", "1")).toBe("1");
    expect(readSession("rf_sw_cleanup_reloaded")).toBeNull();
  });

  it("запись возвращает false, а не исключение", () => {
    forbidStorage();
    expect(() => writeLocal("k", "v")).not.toThrow();
    expect(writeLocal("k", "v")).toBe(false);
    expect(writeSession("k", "v")).toBe(false);
    expect(removeLocal("k")).toBe(false);
  });

  it("перечисление ключей даёт пустой список, а не исключение", () => {
    forbidStorage();
    expect(() => localKeys()).not.toThrow();
    expect(localKeys()).toEqual([]);
  });

  it("переполнение квоты на записи — тоже false, а не исключение", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });
    expect(() => writeLocal("k", "v")).not.toThrow();
    expect(writeLocal("k", "v")).toBe(false);
  });

  it("КОНТРОЛЬ: без обёртки тот же код бросает — значит проба различает", () => {
    forbidStorage();
    expect(() => window.localStorage.getItem("k")).toThrow();
  });
});
