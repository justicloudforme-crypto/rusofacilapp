import { describe, expect, it } from "vitest";
import { loginRetryEmail, MAX_LOGIN_EMAIL_LENGTH } from "./login-retry";

/**
 * ФОРМА ВХОДА НЕ СТИРАЕТ АДРЕС — 7.195, часть 5.
 *
 * Владелец на видеозаписи набрал адрес три раза: при неверном пароле
 * очищались ОБА поля. Возвращается только адрес; пароль не возвращается
 * никогда и в этой функции не появляется вовсе.
 */
describe("loginRetryEmail", () => {
  it("возвращает обычный адрес", () => {
    expect(loginRetryEmail("ana.perez+curso@example.com")).toBe("ana.perez+curso@example.com");
  });

  it("не спотыкается о точку, цифры и плюс", () => {
    // Ровно то, что уронила первая редакция проверки: класс символов
    // `[ - <]` прочитался как диапазон и отвергал почти любой адрес
    // (правило 4.4 PROGRESS.md).
    for (const value of ["a.b@c.de", "u1@d2.com", "x+y@z.org", "a-b@c-d.com", "a_b@c.io"]) {
      expect(loginRetryEmail(value)).toBe(value);
    }
  });

  it("обрезает пробелы по краям", () => {
    expect(loginRetryEmail("  ana@example.com  ")).toBe("ana@example.com");
  });

  const rejected: Array<[string, unknown]> = [
    ["не строка", 42],
    ["пусто", ""],
    ["без собаки", "ana.example.com"],
    ["две собаки", "a@b@c.com"],
    ["домен без точки", "ana@localhost"],
    ["пустая левая часть", "@example.com"],
    ["пробел внутри", "ana perez@example.com"],
    ["перевод строки", "ana@example.com\nSet-Cookie: x=1"],
    ["угловая скобка", "<script>@example.com"],
    ["кавычка", 'a"b@example.com'],
    ["слишком длинный", `${"a".repeat(MAX_LOGIN_EMAIL_LENGTH)}@example.com`],
  ];
  for (const [name, value] of rejected) {
    it(`отбрасывает: ${name}`, () => {
      expect(loginRetryEmail(value)).toBeNull();
    });
  }

  // ПОЗИТИВНЫЙ КОНТРОЛЬ: проверка обязана уметь отвечать обоими ответами.
  // Набор, где всё отброшено, и набор, где всё принято, одинаково пусты как
  // доказательство.
  it("проверка умеет и принимать, и отбрасывать", () => {
    const accepted = ["a@b.co", "ana@example.com"].map(loginRetryEmail).filter(Boolean).length;
    const refused = rejected.map(([, value]) => loginRetryEmail(value)).filter((v) => v === null).length;
    expect(accepted).toBe(2);
    expect(refused).toBe(rejected.length);
  });
});
