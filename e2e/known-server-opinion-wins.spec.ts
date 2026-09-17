import { test, expect } from "./helpers/test";
import { loginWithSubscription } from "./helpers/auth";

/**
 * ТРИ РАЗНЫХ «ВЫУЧЕНО» У ОДНОГО АККАУНТА — находка владельца 17.09.2026
 * (видео проверки 7.207).
 *
 * ЧТО СНЯТО. У `rusofacil.review@gmail.com` в один и тот же день:
 * «Mi perfil» — «0 palabras aprendidas», сетка словаря — «Вы выучили 4 из
 * 4783», окно итога раунда — «Llevas 0 de 4783».
 *
 * ЧТО ИЗМЕРЕНО НА БОЕВОЙ БАЗЕ (только SELECT, 17.09.2026). У этого
 * аккаунта в `FlashcardProgress` РОВНО ЧЕТЫРЕ строки, и у всех четырёх
 * `known = 0`, `box = 0`, время записи — одна секунда: их написал ответ
 * в игре (`recordSrsAnswer`), а не отметка «знаю». Кабинет считает
 * `known = true` и честно печатает 0. Сетка печатает 4, потому что
 * маршрут сводки берёт «знаю» из КАРТЫ БРАУЗЕРА и не смотрит на то, что
 * сервер про эту карточку уже сказал: условие слияния спрашивает
 * `serverKnownUpdatedAt` — а туда попадают только строки `known = true`.
 * То есть строка «не знаю» для маршрута неотличима от отсутствия строки,
 * и заявление браузера побеждает молча — ровно против правила, записанного
 * в шапке самого маршрута («never overrides a card the server already has
 * an opinion on»).
 *
 * ЧТО ПРОВЕРЯЕТСЯ ЗДЕСЬ. Сервер сказал про карточку «не знаю» — сводка
 * это уважает, и число совпадает с тем, что считает кабинет.
 *
 * ПОЛОЖИТЕЛЬНАЯ ПОЛОВИНА рядом: про карточку, о которой сервер не сказал
 * НИЧЕГО, карта браузера по-прежнему работает — иначе прогресс гостя,
 * ради которого тело запроса и заведено, был бы потерян.
 */
test("сводка уважает мнение сервера: «не знаю» на сервере не перебивается картой браузера", async ({ page }) => {
  await loginWithSubscription(page, { tier: "standard" });

  const list = await page.request.get("/api/flashcards?category=food");
  expect(list.ok(), "список карточек не ответил").toBe(true);
  const cards = ((await list.json()) as { cards: { id: string }[] }).cards;
  expect(cards.length, "в теме нет карточек — судить нечего").toBeGreaterThan(1);
  const answered = cards[0].id;
  const untouched = cards[1].id;

  // Ровно то, что пишет ответ в игре: строка есть, «знаю» в ней ложь.
  const wrote = await page.request.post("/api/flashcard-progress", {
    data: { cardId: answered, known: false, box: 0, correctStreak: 1 },
  });
  expect(wrote.ok(), "запись ответа игры не прошла").toBe(true);

  // Браузер настаивает на «знаю» про ОБЕ карточки.
  const entries = {
    [answered]: { known: true, updatedAt: Date.now() },
    [untouched]: { known: true, updatedAt: Date.now() },
  };
  const res = await page.request.post("/api/flashcards/summary", { data: { entries } });
  expect(res.ok(), "маршрут сводки не ответил").toBe(true);
  const summary = (await res.json()) as { totalKnown: number };

  // Одна карточка, а не две: про первую сервер уже сказал своё.
  expect(summary.totalKnown, "заявление браузера перебило строку сервера «не знаю»").toBe(1);
});
