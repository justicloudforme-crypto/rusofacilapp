import { describe, expect, it } from "vitest";
import { TERMS_CONTENT, PRIVACY_CONTENT, visibleLegalParagraphs, type LegalDocument } from "./content";
import { locales } from "@/i18n/config";

/**
 * «ОТ 18 ЛЕТ» — ВЕЗДЕ. Решение владельца 16.09.2026.
 *
 * ЧТО БЫЛО. Четыре места в двух документах говорили одно и то же и
 * говорили другое: «Сервис не предназначен для детей младше 13 лет… с 13
 * лет до совершеннолетия — с согласия родителя» / «no está dirigido a
 * niños menores de 13 años». Целевая аудитория в карточке Google Play при
 * этом указана «только 18+», и расхождение документа с анкетой магазина —
 * это замечание на ревью, а не мелочь.
 *
 * ПЕРЕПИСЬ ПЕРЕД ПРАВКОЙ (16.09.2026, `grep` по `src/`, `e2e/`,
 * `scripts/`, `public/`, `docs/`): упоминаний минимального возраста в
 * ПОЛЬЗОВАТЕЛЬСКИХ текстах — ровно четыре, и все четыре в
 * `src/lib/legal/content.ts`: Условия §2 (es, ru) и Политика §8 (es, ru).
 * Ни в форме регистрации, ни в FAQ, ни в словарях (`es.json`/`ru.json`),
 * ни в разметке schema.org возраст не упоминается вовсе — полей
 * `typicalAgeRange` / `isFamilyFriendly` в проекте 0.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И НЕ ЗАВОДИЛОСЬ. Механизма проверки возраста. Текст об
 * этом говорит прямо («это условие использования, а не автоматический
 * контроль»), и правило ниже требует именно честной формулировки, а не
 * обещания контроля, которого нет.
 */

const UNDER_13 = /13\s*(лет|года|años)/i;
/** Формула «с согласия родителя», ради которой 13 и появилось. */
const PARENT_CONSENT = /(согласие родителя|законного представителя|consentimiento de un padre|tutor)/i;

function everyVisibleString(doc: LegalDocument): string[] {
  // Обе поверхности сразу: правило про возраст — не про оболочку, оно
  // одинаково и на сайте, и в приложении. Проверять только одну сторону
  // значило бы оставить вторую без присмотра.
  return [true, false].flatMap((nativeShell) => [
    doc.title,
    doc.intro,
    ...doc.sections.flatMap((s) => [s.heading, ...visibleLegalParagraphs(s, { nativeShell })]),
  ]);
}

const DOCS = locales.flatMap((locale) => [
  [`/${locale}/terms`, TERMS_CONTENT[locale]] as const,
  [`/${locale}/privacy`, PRIVACY_CONTENT[locale]] as const,
]);

describe("минимальный возраст — 18 лет, на обеих поверхностях и в обеих локалях", () => {
  for (const [name, doc] of DOCS) {
    it(`${name}: ни одного упоминания «13 лет» / «13 años»`, () => {
      const offenders = everyVisibleString(doc).filter((t) => UNDER_13.test(t));
      expect(offenders, offenders.join("\n")).toHaveLength(0);
    });

    it(`${name}: формулы «с согласия родителя» нет`, () => {
      const offenders = everyVisibleString(doc).filter((t) => PARENT_CONSENT.test(t));
      expect(offenders, offenders.join("\n")).toHaveLength(0);
    });

    it(`${name}: возраст назван, и это 18`, () => {
      const said = everyVisibleString(doc).filter((t) => /18\s*(лет|años)/i.test(t));
      expect(said.length).toBeGreaterThan(0);
    });
  }

  it("Условия обещают проверку возраста не больше, чем она есть", () => {
    // Механизма нет. Текст обязан сказать это вслух: иначе документ
    // обещает контроль, которого в коде не существует, — тот же класс,
    // что долг 73 (обещанное хранение записей голоса).
    const ru = everyVisibleString(TERMS_CONTENT.ru).join("\n");
    const es = everyVisibleString(TERMS_CONTENT.es).join("\n");
    expect(ru).toMatch(/Технической проверки возраста у нас нет/);
    expect(es).toMatch(/No comprobamos la edad por medios técnicos/);
  });

  // ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ — НАСТОЯЩИЕ СТРОКИ ДО ПРАВКИ, все четыре.
  // Дословно из `content.ts` состояния bc77b2a (PR #332, последний до
  // этого захода): детектор обязан покраснеть на каждой.
  describe("положительный контроль: настоящие строки до правки", () => {
    const BEFORE = [
      "El Servicio no está dirigido a niños menores de 13 años. Si tienes entre 13 y la mayoría de edad en tu país, necesitas el consentimiento de un padre, madre o tutor para usar el Servicio.",
      "Сервис не предназначен для детей младше 13 лет. Если вам от 13 лет до совершеннолетия по законам вашей страны, для использования Сервиса вам нужно согласие родителя или законного представителя.",
      "El Servicio no está dirigido a niños menores de 13 años y no recopilamos intencionalmente datos de menores de esa edad. Si tienes motivos para creer que un menor de 13 años nos ha proporcionado datos personales, contáctanos y los eliminaremos.",
      "Сервис не предназначен для детей младше 13 лет, и мы намеренно не собираем данные таких пользователей. Если у вас есть основания полагать, что ребёнок младше 13 лет предоставил нам свои данные, свяжитесь с нами — мы их удалим.",
    ];

    it("все четыре ловятся правилом «13 лет»", () => {
      expect(BEFORE.filter((t) => UNDER_13.test(t))).toHaveLength(4);
    });

    it("обе формулы «с согласия родителя» ловятся отдельным правилом", () => {
      // Их две из четырёх — в Условиях. Правило о родительском согласии
      // не дублирует правило о возрасте: переписать «13» на «18», оставив
      // согласие родителя, значило бы пообещать доступ 15-летнему.
      expect(BEFORE.filter((t) => PARENT_CONSENT.test(t))).toHaveLength(2);
    });

    it("ОТРИЦАТЕЛЬНЫЙ: нынешние редакции не красятся ни одним из двух правил", () => {
      const now = DOCS.flatMap(([, doc]) => everyVisibleString(doc));
      expect(now.filter((t) => UNDER_13.test(t) || PARENT_CONSENT.test(t))).toHaveLength(0);
      // И выборка не пуста — иначе «0 нарушений» не значило бы ничего.
      expect(now.length).toBeGreaterThan(50);
    });
  });
});
