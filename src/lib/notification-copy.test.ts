import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import {
  NOTIFICATION_COPY,
  dayIndexOf,
  pickNotificationCopy,
} from "./notification-copy";
import { addDateKeyDays } from "./timezone";

/** A month of consecutive days, enough that a list of ten wraps three times. */
const DAYS = Array.from({ length: 31 }, (_, i) => addDateKeyDays("2026-09-01", i));
/** Ids in the shape the app actually produces (cuid) plus the anonymous case. */
const USERS = [null, "", "cmsxtpzwq0000qwnc4a2sstlo", "cmsxtq02a0001qwnc9uuivqak", "u3", "u4"];

describe("оба словаря заполнены", () => {
  for (const locale of locales) {
    it(`${locale}: не меньше восьми текстов, все разные, без пустых полей`, () => {
      const list = NOTIFICATION_COPY[locale];
      expect(list.length).toBeGreaterThanOrEqual(8);
      expect(new Set(list.map((c) => c.title)).size).toBe(list.length);
      expect(new Set(list.map((c) => c.body)).size).toBe(list.length);
      for (const { title, body } of list) {
        expect(title.trim().length).toBeGreaterThan(0);
        expect(body.trim().length).toBeGreaterThan(0);
      }
    });
  }

  it("обе локали покрыты и ни одна не заимствует текст у другой", () => {
    expect(Object.keys(NOTIFICATION_COPY).sort()).toEqual([...locales].sort());
    const es = new Set(NOTIFICATION_COPY.es.map((c) => c.title));
    for (const c of NOTIFICATION_COPY.ru) expect(es.has(c.title)).toBe(false);
  });

  it("ru пишется кириллицей, es — латиницей", () => {
    for (const c of NOTIFICATION_COPY.ru) expect(c.body).toMatch(/[а-яё]/i);
    for (const c of NOTIFICATION_COPY.es) expect(c.body).not.toMatch(/[а-яё]/i);
  });
});

describe("выбор детерминирован", () => {
  it("одна и та же пара (пользователь, день) всегда даёт один текст", () => {
    for (const locale of locales) {
      for (const user of USERS) {
        for (const day of DAYS) {
          const first = pickNotificationCopy(locale, user, day);
          expect(pickNotificationCopy(locale, user, day)).toEqual(first);
          expect(pickNotificationCopy(locale, user, day)).toEqual(first);
        }
      }
    }
  });

  it("выбранный текст всегда из списка своей локали", () => {
    for (const locale of locales) {
      const list = NOTIFICATION_COPY[locale];
      for (const user of USERS) {
        for (const day of DAYS) {
          expect(list).toContainEqual(pickNotificationCopy(locale, user, day));
        }
      }
    }
  });
});

describe("два дня подряд — разные тексты", () => {
  it("ни у одного пользователя ни на одной паре соседних дней текст не повторяется", () => {
    let pairs = 0;
    for (const locale of locales) {
      for (const user of USERS) {
        for (let i = 0; i + 1 < DAYS.length; i++) {
          const today = pickNotificationCopy(locale, user, DAYS[i]);
          const tomorrow = pickNotificationCopy(locale, user, DAYS[i + 1]);
          expect(today).not.toEqual(tomorrow);
          pairs++;
        }
      }
    }
    // 2 локали × 6 пользователей × 30 пар — счёт назван, чтобы урезанный
    // набор данных не превратил проверку в зелёную пустоту.
    expect(pairs).toBe(2 * USERS.length * 30);
  });

  it("список длиннее одного — иначе предыдущая проверка не может провалиться", () => {
    for (const locale of locales) expect(NOTIFICATION_COPY[locale].length).toBeGreaterThan(1);
  });
});

describe("день считается по календарю, а не по мгновению", () => {
  it("соседние ключи дают соседние номера через границу месяца и года", () => {
    expect(dayIndexOf("2026-10-01") - dayIndexOf("2026-09-30")).toBe(1);
    expect(dayIndexOf("2027-01-01") - dayIndexOf("2026-12-31")).toBe(1);
  });

  it("одинаковые ключи — одинаковые номера, независимо от зоны процесса", () => {
    expect(dayIndexOf("2026-09-05")).toBe(dayIndexOf("2026-09-05"));
  });
});

describe("разные люди в один вечер получают разное", () => {
  it("на каком-то дне месяца два конкретных аккаунта расходятся", () => {
    const differ = DAYS.filter(
      (day) =>
        pickNotificationCopy("es", USERS[2], day).title !==
        pickNotificationCopy("es", USERS[3], day).title,
    );
    expect(differ.length).toBe(DAYS.length);
  });
});
