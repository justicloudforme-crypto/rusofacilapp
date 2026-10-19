import { it, expect } from "vitest";

/**
 * Подсадка `check:late-timers:plant` (долг 386): ровно форма прежнего
 * дефекта — таймер, поставленный тестом в общем окне, трогает `document`
 * через 300 мс, когда тест давно кончился. Сторож обязан её увидеть.
 */
it("подсадка: таймер трогает document после конца теста", () => {
  setTimeout(() => {
    document.title = "поздно";
  }, 300);
  expect(typeof document).toBe("object");
});
