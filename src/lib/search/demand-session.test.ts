import { describe, expect, it } from "vitest";
import { SearchDemandSession } from "./demand-session";

/**
 * Свойство, которое здесь доказывается, ровно одно: **ровно одна строка на
 * один заход, каким бы выходом он ни кончился**. В браузере это стоило бы
 * четырёх прогонов на каждую пару выходов; здесь — семи случаев.
 *
 * Отрицательные контроли обязательны и стоят рядом с положительными: без
 * случая «второй flush отдаёт null» проверка «первый flush отдаёт запись»
 * прошла бы и на журнале, который пишет строку на каждый выход.
 */
describe("SearchDemandSession", () => {
  it("до открытия окна писать нечего", () => {
    const session = new SearchDemandSession();
    expect(session.pending).toBe(false);
    expect(session.flush()).toBeNull();
  });

  it("открытый заход отдаёт то, что видел человек", () => {
    const session = new SearchDemandSession();
    session.open("es");
    session.update({ query: "Cuentos", resultCount: 7 });
    expect(session.pending).toBe(true);
    expect(session.flush()).toEqual({ query: "Cuentos", resultCount: 7, lang: "es", followed: false });
  });

  it("Escape и следом закрытие вкладки дают ОДНУ запись, а не две", () => {
    const session = new SearchDemandSession();
    session.open("ru");
    session.update({ query: "Рассказы", resultCount: 3 });

    // Первый выход — Escape.
    expect(session.flush()).toEqual({ query: "Рассказы", resultCount: 3, lang: "ru", followed: false });
    // Второй выход — pagehide того же захода. Записи быть не должно.
    expect(session.flush()).toBeNull();
    expect(session.pending).toBe(false);
  });

  it("переход по строке выдачи записывается как переход", () => {
    const session = new SearchDemandSession();
    session.open("es");
    session.update({ query: "sustantivo", resultCount: 9 });
    session.markFollowed();
    expect(session.flush()).toMatchObject({ followed: true });
  });

  it("переход и следом pagehide — тоже одна запись, и она с переходом", () => {
    // Ровно тот порядок, который наступает в жизни: клик по ссылке ставит
    // признак и отправляет запись, а уходящая страница следом бросает
    // pagehide. Без однократности здесь было бы две строки об одном
    // заходе, причём вторая — без перехода, то есть врущая.
    const session = new SearchDemandSession();
    session.open("es");
    session.update({ query: "Cuentos", resultCount: 1 });
    session.markFollowed();
    expect(session.flush()).toMatchObject({ followed: true });
    expect(session.flush()).toBeNull();
  });

  it("второе открытие окна — второй заход, а не продолжение первого", () => {
    const session = new SearchDemandSession();
    session.open("es");
    session.update({ query: "первый", resultCount: 2 });
    session.flush();

    session.open("ru");
    session.update({ query: "второй", resultCount: 5 });
    expect(session.flush()).toEqual({ query: "второй", resultCount: 5, lang: "ru", followed: false });
  });

  it("признак перехода не перетекает из прошлого захода", () => {
    // Отрицательный контроль к предыдущему случаю: `followed` живёт внутри
    // одного захода, иначе один переход красил бы все последующие заходы.
    const session = new SearchDemandSession();
    session.open("es");
    session.markFollowed();
    session.flush();

    session.open("es");
    session.update({ query: "без перехода", resultCount: 0 });
    expect(session.flush()).toMatchObject({ followed: false });
  });

  it("правки закрытого захода никуда не попадают", () => {
    // Иначе обработчик выхода, доехавший после flush, дописал бы строку в
    // уже отправленную запись.
    const session = new SearchDemandSession();
    session.open("es");
    session.update({ query: "Cuentos", resultCount: 1 });
    session.flush();
    session.update({ query: "подмена", resultCount: 999 });
    session.markFollowed();
    expect(session.flush()).toBeNull();
  });
});
