import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";

/**
 * ЗАМОК РЯДОМ С КОРОНОЙ У ЗАКРЫТОГО ПРЕМИАЛЬНОГО ПАЗЛА — долг 251,
 * решение владельца 18.09.2026.
 *
 * ЧТО СНЯЛ ВЛАДЕЛЕЦ 17.09.2026 (7.207, замер «б»). Аккаунт с доступом по
 * коду (разряд `standard`) смотрит филворды A1: на пазлах 166 и дальше
 * стоит корона на тонированном фоне — и ни одного знака того, что пазл
 * ему не откроется. Правило владельца «корона — СОРТ, замок — СОСТОЯНИЕ
 * доступа» выполнялось наполовину: сорт назван, состояние умолчано.
 *
 * ЧТО ПРОВЕРЯЕТСЯ ЗДЕСЬ — последствие на экране, а не имя функции:
 *
 *   1) у разряда `standard` КАЖДАЯ плитка, которая несёт корону и при
 *      этом заперта (`data-locked`), несёт РЯДОМ и замок;
 *   2) у разряда `premium` корона есть, а замка нет ни одного: ему эти
 *      пазлы открываются, и замок был бы враньём;
 *   3) в ВЕБЕ не меняется ничего — замка нет ни у кого.
 *
 * Пол «таких плиток больше нуля» стоит намеренно: без него прогон на
 * банке без премиальных пазлов был бы зелёным, ничего не проверив.
 *
 * Обе семьи (филворд и кроссворд) и все уровни обходятся в одном тесте:
 * вкладка и уровень — состояние браузера, адреса у них нет.
 *
 * Ширина 384 — та, на которой владелец снимал видео (POCO X6 Pro).
 */
const SHELL_COOKIE = { name: "rf_native_shell", value: "1", domain: "localhost", path: "/" };
const CROWN = '[data-access-mark="premium-tier"]';
const LOCK = '[data-access-locked="true"]';
const TILE = 'a[href*="/word-games/"]';

interface Tally {
  tiles: number;
  crowned: number;
  crownedLocked: number;
  crownedLockedWithLock: number;
  locks: number;
  strayLocks: number;
}

const EMPTY: Tally = { tiles: 0, crowned: 0, crownedLocked: 0, crownedLockedWithLock: 0, locks: 0, strayLocks: 0 };

/** Обходит обе семьи пазлов и все уровни, складывая перепись плиток. */
async function tallyPicker(page: import("@playwright/test").Page, lang: string): Promise<Tally> {
  await page.goto(`/${lang}/word-games`);
  await expect(page.locator(TILE).first()).toBeVisible();
  const tabs = page.getByRole("tab");
  await expect(tabs, "вкладок семей пазлов не две").toHaveCount(2);

  const total = { ...EMPTY };
  for (const tabIndex of [0, 1]) {
    await tabs.nth(tabIndex).click();
    const levels = page.locator("[data-testid=word-game-level-filter] button");
    const levelCount = await levels.count();
    expect(levelCount, "полоса уровней пуста — смотреть нечего").toBeGreaterThan(0);
    for (let i = 0; i < levelCount; i += 1) {
      await levels.nth(i).click();
      await expect(page.locator(TILE).first()).toBeVisible();
      const page_ = await page.evaluate(
        ({ tile, crown, lock }) => {
          const out = { tiles: 0, crowned: 0, crownedLocked: 0, crownedLockedWithLock: 0, locks: 0, strayLocks: 0 };
          for (const el of document.querySelectorAll(tile)) {
            out.tiles += 1;
            const hasCrown = el.querySelector(crown) !== null;
            const hasLock = el.querySelector(lock) !== null;
            const locked = el.getAttribute("data-locked") === "true";
            if (hasCrown) out.crowned += 1;
            if (hasLock) out.locks += 1;
            if (hasCrown && locked) {
              out.crownedLocked += 1;
              if (hasLock) out.crownedLockedWithLock += 1;
            } else if (hasLock) {
              out.strayLocks += 1;
            }
          }
          return out;
        },
        { tile: TILE, crown: CROWN, lock: LOCK },
      );
      for (const key of Object.keys(total) as (keyof Tally)[]) total[key] += page_[key];
    }
  }
  return total;
}

for (const lang of ["es", "ru"] as const) {
  test(`[${lang}] доступ по коду: у закрытого премиального пазла корона и замок вместе`, async ({ page, context }) => {
    await page.setViewportSize({ width: 384, height: 780 });
    await loginWithSubscription(page, { tier: "standard" });
    await context.addCookies([SHELL_COOKIE]);

    const tally = await tallyPicker(page, lang);
    expect(tally.crownedLocked, "закрытых премиальных пазлов не нашлось — проба ничего не судит").toBeGreaterThan(0);
    expect(tally.crownedLockedWithLock, "у закрытого премиального пазла корона без замка").toBe(tally.crownedLocked);
    // Замок — состояние доступа, а не украшение: на открытой плитке и на
    // плитке без короны его быть не должно.
    expect(tally.strayLocks, "замок стоит там, где плитка не заперта").toBe(0);
  });

  test(`[${lang}] Premium: корона стоит, замка нет ни одного`, async ({ page, context }) => {
    await page.setViewportSize({ width: 384, height: 780 });
    await loginWithSubscription(page, { tier: "premium" });
    await context.addCookies([SHELL_COOKIE]);

    const tally = await tallyPicker(page, lang);
    expect(tally.crowned, "короны нет ни на одной плитке — проба ничего не судит").toBeGreaterThan(0);
    expect(tally.locks, "у Premium на плитке замок").toBe(0);
  });
}

test("веб не тронут: замка нет ни на одной плитке без признака оболочки", async ({ page }) => {
  await page.setViewportSize({ width: 384, height: 780 });
  await loginWithSubscription(page, { tier: "standard" });

  const tally = await tallyPicker(page, "es");
  // Положительная половина того же селектора: корона в вебе у этой роли
  // стоит, то есть экран собрался и отрицание не доказано пустотой.
  expect(tally.crowned, "в вебе нет ни одной короны — отрицание доказано пустым экраном").toBeGreaterThan(0);
  expect(tally.locks, "в вебе появился замок").toBe(0);
});
