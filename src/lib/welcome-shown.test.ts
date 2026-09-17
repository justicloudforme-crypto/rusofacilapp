import { describe, expect, it } from "vitest";
import { greetedOnAccountToday } from "./welcome-shown";
import { dateKeyIn } from "./timezone";

/**
 * ОДНО ПРИВЕТСТВИЕ ЗА МЕСТНЫЙ ДЕНЬ АККАУНТА — ПРИ ЛЮБОЙ ЗОНЕ АККАУНТА И
 * ЛЮБОЙ ЗОНЕ УСТРОЙСТВА (долг 247, заход 7.207).
 *
 * Здесь не «проверка функции», а два СЦЕНАРИЯ, снятые с боевых чисел.
 * Зона аккаунта меняется посреди визита сама: `TimeZoneSync` сообщает зону
 * устройства, `POST /api/timezone` кладёт её в `User.timezone`, и вторая
 * отрисовка кабинета (её заводит `router.refresh()` из `NativeShellCookie`
 * внутри оболочки) считает «сегодня» уже в новой зоне.
 *
 * В каждом сценарии стоит ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ на коде ДО правки: тот
 * же самый вопрос, заданный строке БЕЗ мгновения, обязан ответить «не
 * здоровались» — то есть показать второе приветствие. Прежний код
 * сравнивал ровно эти две строки и ничего больше, поэтому контроль
 * воспроизводит именно его, а не пересказывает.
 */
describe("приветствие дня: один раз за местный день аккаунта", () => {
  // 17.09.2026, 14:27 по Владивостоку — момент видео владельца.
  const VIDEO = new Date("2026-09-17T04:27:00.000Z");
  const DEVICE = "Asia/Vladivostok"; // телефон POCO

  it("аккаунт в поясе, где ещё ВЧЕРА (сотрудник, America/Tijuana): второго приветствия нет", () => {
    const accountZone = "America/Tijuana";
    const dayAtGreeting = dateKeyIn(VIDEO, accountZone);
    expect(dayAtGreeting).toBe("2026-09-16");

    // Первое приветствие показано и записано.
    const mark = { welcomeShownAt: VIDEO, welcomeShownDateKey: dayAtGreeting };

    // Зона аккаунта переписана зоной устройства; кабинет отрисован снова.
    const todayAfter = dateKeyIn(VIDEO, DEVICE);
    expect(todayAfter).toBe("2026-09-17");

    expect(greetedOnAccountToday(mark, todayAfter, DEVICE)).toBe(true);

    // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ — код ДО правки: мгновения нет, сравниваются
    // два ключа из РАЗНЫХ календарей, и приветствие приходит второй раз.
    expect(
      greetedOnAccountToday({ welcomeShownDateKey: dayAtGreeting }, todayAfter, DEVICE),
    ).toBe(false);
  });

  it("аккаунт в поясе, где уже ЗАВТРА (Pacific/Kiritimati): второго приветствия нет", () => {
    const accountZone = "Pacific/Kiritimati"; // UTC+14
    const at = new Date("2026-09-17T11:00:00.000Z");
    const dayAtGreeting = dateKeyIn(at, accountZone);
    expect(dayAtGreeting).toBe("2026-09-18");

    const todayAfter = dateKeyIn(at, DEVICE);
    expect(todayAfter).toBe("2026-09-17");

    expect(
      greetedOnAccountToday({ welcomeShownAt: at, welcomeShownDateKey: dayAtGreeting }, todayAfter, DEVICE),
    ).toBe(true);

    // Контроль на прежнем правиле — второе приветствие.
    expect(
      greetedOnAccountToday({ welcomeShownDateKey: dayAtGreeting }, todayAfter, DEVICE),
    ).toBe(false);
  });

  it("настоящая местная полночь: назавтра здороваются снова", () => {
    const yesterday = new Date("2026-09-16T04:27:00.000Z");
    const today = dateKeyIn(VIDEO, DEVICE);
    expect(greetedOnAccountToday({ welcomeShownAt: yesterday }, today, DEVICE)).toBe(false);
  });

  it("тот же день, та же зона: второго приветствия нет", () => {
    const today = dateKeyIn(VIDEO, DEVICE);
    expect(greetedOnAccountToday({ welcomeShownAt: VIDEO }, today, DEVICE)).toBe(true);
  });

  it("аккаунту ещё не здоровались: приветствие показывается", () => {
    const today = dateKeyIn(VIDEO, DEVICE);
    expect(greetedOnAccountToday(null, today, DEVICE)).toBe(false);
    expect(greetedOnAccountToday({}, today, DEVICE)).toBe(false);
    expect(greetedOnAccountToday({ welcomeShownAt: null, welcomeShownDateKey: null }, today, DEVICE)).toBe(false);
  });

  it("негодное мгновение не отменяет ответа — отвечает запасной ключ дня", () => {
    const today = dateKeyIn(VIDEO, DEVICE);
    expect(
      greetedOnAccountToday({ welcomeShownAt: "не дата", welcomeShownDateKey: today }, today, DEVICE),
    ).toBe(true);
  });

  it("строка ДО 7.207 (мгновения нет) в НЕизменившейся зоне ведёт себя как прежде", () => {
    const today = dateKeyIn(VIDEO, DEVICE);
    expect(greetedOnAccountToday({ welcomeShownDateKey: today }, today, DEVICE)).toBe(true);
  });
});
