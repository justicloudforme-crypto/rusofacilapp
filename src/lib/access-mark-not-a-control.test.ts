import { describe, expect, it } from "vitest";
import { CONTROL_CENSUS } from "../../scripts/check-rendered-purchase-surfaces.mjs";
import { judgeControl } from "../../scripts/purchase-surface-rules.mjs";

/**
 * МЕТКА — НЕ ОРГАН УПРАВЛЕНИЯ, И ПРИБОР ОБЯЗАН ЭТО РАЗЛИЧАТЬ (7.195, часть 4).
 *
 * Владелец решил 14.09.2026: 👑 — метка СОРТА материала («это премиум»), её
 * надо сохранить и распространить; 🔒 — состояние доступа. Метка ничего не
 * предлагает купить, никуда не ведёт и нажатием не является.
 *
 * Но стоит она ВНУТРИ органа управления: на кнопке уровня C1, на вкладке
 * «Литературные», на карточке рассказа, на плитке филворда, на строке
 * поиска. Её текст попадал в подпись органа, и слабое правило прибора
 * («Premium» на короткой подписи кнопки без адреса) считало метку призывом
 * к покупке.
 *
 * Здесь обе половины проверяются в одном месте:
 *   — метка внутри органа больше не роняет прибор;
 *   — настоящая кнопка покупки роняет его ровно как прежде.
 *
 * Перепись берётся ИЗ САМОГО ПРИБОРА (`CONTROL_CENSUS` экспортирована из
 * `scripts/check-rendered-purchase-surfaces.mjs`), а не переписана здесь:
 * проверка прибора копией прибора не проверяет ничего.
 */
function renderBody(html: string) {
  document.body.innerHTML = html;
}

function problems(): string[] {
  const controls = CONTROL_CENSUS() as Array<{ tag: string; text: string; target: string }>;
  return controls.flatMap((c) => judgeControl({ text: c.text, target: c.target }) as string[]);
}

describe("прибор отличает метку от органа", () => {
  it("корона с подписью плана внутри кнопки — не нарушение", () => {
    renderBody(`
      <button type="button">C1<span data-access-mark="premium-tier">👑 Только Premium</span></button>
      <a href="/ru/stories/1">Сказка<span data-access-mark="premium-tier">👑 Solo Premium</span></a>
      <button type="button">Литературные<span data-access-mark="premium-tier">👑</span></button>
    `);
    expect(problems()).toEqual([]);
  });

  it("замок с подписью подписки внутри ссылки — не нарушение", () => {
    renderBody(`<a href="/ru/media/7">Видео<span data-access-mark="subscription">🔒 По подписке</span></a>`);
    expect(problems()).toEqual([]);
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ №1: настоящая кнопка покупки — та самая форма, что
  // была долгом 191 (кнопка БЕЗ адреса, нарисованная клиентом).
  it("настоящая кнопка покупки ловится и после правки", () => {
    renderBody(`<button type="button">Оформить подписку</button>`);
    expect(problems().length).toBeGreaterThan(0);
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ №2: ссылка на платёжную поверхность.
  it("ссылка на страницу цен ловится и после правки", () => {
    renderBody(`<a href="/ru/pricing?next=/ru/courses/a1/2">подсадка</a>`);
    expect(problems().length).toBeGreaterThan(0);
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ №3: слабое слово на короткой подписи БЕЗ метки
  // по-прежнему нарушение — правка не отключила слабое правило целиком.
  it("слово «Premium» на кнопке без метки и без адреса ловится", () => {
    renderBody(`<button type="button">Premium</button>`);
    expect(problems().length).toBeGreaterThan(0);
  });

  // ПОЗИТИВНЫЙ КОНТРОЛЬ №4: метка не прячет орган, внутри которого она
  // стоит, — кнопка покупки с короной всё равно нарушение.
  it("метка не прячет призыв, стоящий рядом с ней", () => {
    renderBody(`<button type="button">Оформить подписку<span data-access-mark="premium-tier">👑</span></button>`);
    expect(problems().length).toBeGreaterThan(0);
  });

  it("и адрес оплаты не прячется меткой тоже", () => {
    renderBody(`<a href="/es/checkout">Ver<span data-access-mark="premium-tier">👑 Solo Premium</span></a>`);
    expect(problems().length).toBeGreaterThan(0);
  });
});
