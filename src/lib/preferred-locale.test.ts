import { describe, expect, it } from "vitest";
import { preferredLocaleFromHeader } from "./preferred-locale";

/**
 * Таблица — та же, что у сторожа `check:device-locale`, и это намеренно:
 * юнит держит правило в `npm run test`, сторож — в `verify` и в `ci.yml`,
 * и обе половины обязаны говорить одно.
 */
describe("preferredLocaleFromHeader (долг 155)", () => {
  it("телефон с третьим языком системы получает ИСПАНСКИЙ, а не русский", () => {
    expect(preferredLocaleFromHeader("pt-BR,pt;q=0.9")).toBe("es");
    expect(preferredLocaleFromHeader("en-US,en;q=0.9")).toBe("es");
    expect(preferredLocaleFromHeader("de-DE,de;q=0.9,fr;q=0.8")).toBe("es");
    expect(preferredLocaleFromHeader("zh-Hans-CN,zh;q=0.9")).toBe("es");
  });

  it("заголовка нет вовсе — испанский", () => {
    expect(preferredLocaleFromHeader(null)).toBe("es");
    expect(preferredLocaleFromHeader("")).toBe("es");
    expect(preferredLocaleFromHeader("   ")).toBe("es");
  });

  it("свои языки узнаются и по коду страны", () => {
    expect(preferredLocaleFromHeader("es-MX,es;q=0.9")).toBe("es");
    expect(preferredLocaleFromHeader("ru-RU,ru;q=0.9")).toBe("ru");
    expect(preferredLocaleFromHeader("RU")).toBe("ru");
  });

  it("вес q решает, а не порядок перечисления — это и была дыра", () => {
    // До правки эта строка отдавала "ru": разбор шёл по порядку.
    expect(preferredLocaleFromHeader("en-US,ru;q=0.3,es;q=0.9")).toBe("es");
    expect(preferredLocaleFromHeader("es;q=0.2,ru;q=0.8")).toBe("ru");
    expect(preferredLocaleFromHeader("ru;q=0.8,es;q=0.2")).toBe("ru");
  });

  it("при равных весах остаётся прежний порядок", () => {
    expect(preferredLocaleFromHeader("ru,es")).toBe("ru");
    expect(preferredLocaleFromHeader("es,ru")).toBe("es");
    expect(preferredLocaleFromHeader("en,ru;q=0.5,es;q=0.5")).toBe("ru");
  });

  it("q=0 — это «не предлагать», а не «слабее всех»", () => {
    expect(preferredLocaleFromHeader("ru;q=0,es;q=0.1")).toBe("es");
    // Своего не осталось ничего — молчаливым ответом по-прежнему испанский.
    expect(preferredLocaleFromHeader("ru;q=0,es;q=0")).toBe("es");
  });

  it("мусор в заголовке не роняет разбор и не меняет ответа", () => {
    expect(preferredLocaleFromHeader(",,;;,")).toBe("es");
    expect(preferredLocaleFromHeader("ru;q=абв")).toBe("ru");
    expect(preferredLocaleFromHeader("*")).toBe("es");
    expect(preferredLocaleFromHeader("*;q=1,ru;q=0.5")).toBe("ru");
  });
});
