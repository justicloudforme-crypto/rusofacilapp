import { describe, expect, it } from "vitest";
import { localeOfPath, rememberedLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "./remembered-locale";
import { locales } from "@/i18n/config";

describe("rememberedLocale", () => {
  it("принимает ровно те локали, которые объявлены в i18n, и ни одной сверх", () => {
    for (const locale of locales) expect(rememberedLocale(locale)).toBe(locale);
    // Чужое значение читается как «не запомнено», а не как локаль: кука
    // приходит от клиента и может быть чем угодно.
    for (const junk of ["en", "ES", "ru-RU", "", "../es", "<script>"]) {
      expect(rememberedLocale(junk)).toBeNull();
    }
    expect(rememberedLocale(undefined)).toBeNull();
  });
});

describe("localeOfPath", () => {
  it("берёт локаль первого сегмента и не путает её с похожим началом пути", () => {
    expect(localeOfPath("/ru")).toBe("ru");
    expect(localeOfPath("/ru/")).toBe("ru");
    expect(localeOfPath("/es/stories/el-gato")).toBe("es");
    // Ни один из этих адресов локали не несёт, и запомнить по ним нечего.
    expect(localeOfPath("/")).toBeNull();
    expect(localeOfPath("/sitemap.xml")).toBeNull();
    expect(localeOfPath("/russian/lessons")).toBeNull();
    expect(localeOfPath("/api/auth/logout")).toBeNull();
  });
});

describe("кука запомненного языка", () => {
  it("живёт год — выбор языка не сессия", () => {
    expect(LOCALE_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });

  it("называется не так, как сессионная: их удаляют в разные моменты", () => {
    expect(LOCALE_COOKIE).toBe("rf-lang");
    expect(LOCALE_COOKIE).not.toBe("session");
  });
});
