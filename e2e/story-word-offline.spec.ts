import type { Page } from "@playwright/test";
import { test, expect } from "./helpers/test";

/**
 * ПЕРЕВОД СЛОВА БЕЗ СЕТИ — ДОЛГ 360 (заход 7.247).
 *
 * Владелец на POCO (1.0.12): скачанный рассказ без интернета, нажатие на
 * слово — «No se pudo traducir esta palabra.». Фраза звучит как поломка
 * приложения, а причина одна: перевод слова всегда спрашивает сервер.
 *
 * ЧТО ЗДЕСЬ МЕРИТСЯ, И КАЖДОЕ УТВЕРЖДЕНИЕ ДВУСТОРОННЕЕ, В ОДНОМ ТЕСТЕ:
 *   1. С сетью слово переводится (ответ словаря — подставной, чтобы
 *      прогон не зависел ни от банка базы CI, ни от чужого сервиса).
 *   2. С сетью и ОТКАЗОМ сервера — прежняя фраза, а не «нет сети»: иначе
 *      новый текст врал бы про интернет там, где сломан сервер.
 *   3. Без сети непереведённое слово — «Sin conexión: …», и прежней фразы
 *      на экране нет.
 *   4. Без сети слово, переведённое раньше, показывает ПЕРЕВОД (кеш).
 *   5. Сеть вернулась — то же слово переводится.
 * Настоящий service worker остаётся включённым: без сети запрос уходит в
 * него (`NetworkFirst` для `/api/…`), и отказ приходит тем же путём, что
 * на телефоне.
 */

const OFFLINE_ES = "Sin conexión: para traducir palabras necesitas internet.";
const OFFLINE_RU = "Нет подключения: для перевода слов нужен интернет.";
const SERVER_ERROR_ES = "No se pudo traducir esta palabra.";

const popover = (page: Page) => page.getByTestId("translation-popover");
const popoverText = (page: Page) => popover(page).locator("p");

async function openFirstStory(page: Page, lang: "es" | "ru"): Promise<void> {
  await page.goto(`/${lang}/stories`);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  const href = await page
    .locator(`a[href^="/${lang}/stories/"]`)
    .first()
    .getAttribute("href");
  expect(href, "в каталоге рассказов нет ни одной ссылки").toBeTruthy();
  await page.goto(href!);
  await expect(page.locator("button[data-word]").first()).toBeVisible({ timeout: 30_000 });
  // Предзагрузка видимого абзаца (`/api/dictionary/bank`) — пусть отработает
  // сейчас, с сетью: её итог и есть «кеш», который без сети обязан остаться.
  await page.waitForLoadState("networkidle");
}

/**
 * Словоформы рассказа, которых НЕТ в кеше переводов вкладки, — в порядке
 * появления и без повторов. Ключ кеша — та же скупая нормализация, что в
 * `translation-normalize.ts`: регистр, ударение, невидимые разделители.
 */
async function uncachedWords(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const norm = (w: string) => w.toLowerCase().replace(/[́­​-‍⁠﻿]/g, "");
    let cached: Record<string, string> = {};
    try {
      cached = JSON.parse(sessionStorage.getItem("rf.wordTranslations.v1") ?? "{}");
    } catch {
      /* пустой кеш */
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (const node of document.querySelectorAll<HTMLElement>("button[data-word]")) {
      const word = node.dataset.word ?? "";
      const key = norm(word);
      if (!key || seen.has(key) || key in cached) continue;
      seen.add(key);
      out.push(word);
    }
    return out;
  });
}

async function tap(page: Page, word: string): Promise<void> {
  await page.locator(`button[data-word="${word}"]`).first().click();
  await expect(popover(page)).toBeVisible();
}

async function closePopover(page: Page): Promise<void> {
  await popover(page).getByRole("button").last().click();
  await expect(popover(page)).toHaveCount(0);
}

test("без сети слово говорит про интернет, с сетью — переводится, отказ сервера — прежняя фраза", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  let serverFails = "";
  const DICTIONARY = "**/api/dictionary/translate?**";
  // Подставной ответ словаря снимается на время «без сети»: `context.route`
  // отвечает и при `setOffline(true)` — первый прогон 29.09.2026 показал
  // «e2e:баба» без сети. Без подмены запрос честно уходит в сеть и падает.
  const stubDictionary = () =>
    context.route(DICTIONARY, async (route) => {
      const word = new URL(route.request().url()).searchParams.get("word") ?? "";
      if (word === serverFails) {
        await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "not_translated" }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ word, translation: `e2e:${word}`, source: "e2e" }),
      });
    });
  await stubDictionary();

  await openFirstStory(page, "es");
  const online = await uncachedWords(page);
  expect(online.length, "в рассказе нет слов вне кеша — мерить нечего").toBeGreaterThanOrEqual(3);
  const [known, broken] = online;
  serverFails = broken;

  // 1. С сетью — перевод.
  await tap(page, known);
  await expect(popoverText(page)).toHaveText(`e2e:${known}`);
  await closePopover(page);

  // 2. С сетью и отказом сервера — прежняя фраза, не «нет сети».
  await tap(page, broken);
  await expect(popoverText(page)).toHaveText(SERVER_ERROR_ES);
  await closePopover(page);

  // 3. Без сети — понятный текст. Слово выбирается ПОСЛЕ отключения: пока
  //    сеть была, предзагрузка могла положить в кеш новые абзацы.
  await context.unroute(DICTIONARY);
  await context.setOffline(true);
  const offline = (await uncachedWords(page)).filter((word) => word !== known && word !== broken);
  expect(offline.length, "без сети не осталось слов вне кеша").toBeGreaterThan(0);
  const unknown = offline[0];
  await tap(page, unknown);
  await expect(popoverText(page)).toHaveText(OFFLINE_ES);
  await expect(popover(page)).not.toContainText(SERVER_ERROR_ES);
  await closePopover(page);

  // 4. Без сети — слово из кеша показывает перевод, а не ошибку.
  await tap(page, known);
  await expect(popoverText(page)).toHaveText(`e2e:${known}`);
  await closePopover(page);

  // 5. Сеть вернулась — то же слово переводится.
  await context.setOffline(false);
  await stubDictionary();
  await tap(page, unknown);
  await expect(popoverText(page)).toHaveText(`e2e:${unknown}`);
});

test("/ru: без сети слово говорит про интернет на «вы»", async ({ page, context }) => {
  test.setTimeout(120_000);
  await openFirstStory(page, "ru");
  await context.setOffline(true);
  const words = await uncachedWords(page);
  expect(words.length, "в рассказе нет слов вне кеша — мерить нечего").toBeGreaterThan(0);
  await tap(page, words[0]);
  await expect(popoverText(page)).toHaveText(OFFLINE_RU);
});
