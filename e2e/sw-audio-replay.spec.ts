import { test, expect } from "./helpers/test";
import { expectPageIsItself } from "./helpers/page-identity";
import { loginWithSubscription } from "./helpers/auth";
import { serveClipLocally } from "./helpers/audio-clip-origin";

/**
 * ТО, ЧТО ЧЕЛОВЕК УЖЕ СЛУШАЛ, ОБЯЗАНО ИГРАТЬ И ВО ВТОРОЙ РАЗ — ЗАХОД 7.218.
 *
 * ЧТО МЕРИТСЯ И ЗАЧЕМ. Владелец 20.09.2026: рассказ «День стирки» на Маке
 * в Chrome не играет вовсе — кнопка остаётся «play», полоса не движется,
 * звука нет; в тот же час на Android в оболочке тот же рассказ играет.
 * Причина найдена экспериментом и лежит в воркере: элемент `<audio>`
 * ходит за клипом БЕЗ CORS и С заголовком `Range`, чужой источник отдаёт
 * непрозрачный ответ (`status 0`, тело нечитаемо), прежнее правило
 * `statuses: [0, 200]` клало его в кеш, а `RangeRequestsPlugin` на втором
 * прослушивании резал из пустого тела кусок и отдавал 416. То есть кеш
 * клипов ЛОМАЛ повторное прослушивание всего, что уже слушали, — а на
 * Android воркера в оболочке нет, и там играло.
 *
 * ПРОБА ПРОВЕРЯЕТ САМА СЕБЯ В ТОМ ЖЕ ПРОГОНЕ. Последним шагом она кладёт
 * в кеш клипов пустую запись своими руками — ровно ту форму, которой
 * дефект и был, — и требует, чтобы воспроизведение СЛОМАЛОСЬ. Без этого
 * шага «играет во второй раз» и «проба смотрит не туда» читались бы
 * одинаково.
 *
 * ЗВУК БЕРЁТСЯ НЕ ИЗ ИНТЕРНЕТА — ЗАХОД 7.221, ДОЛГ 297. Заход 7.218
 * положил в строку фикстуры НАСТОЯЩИЙ боевой `fullAudioUrl`, и проба
 * стала качать живой файл с `*.public.blob.vercel-storage.com` в каждом
 * прогоне CI. Из четырёх прогонов 20–21.09.2026 два были красными, один
 * из них — даже после второй повторной попытки, и падало ПЕРВОЕ
 * воспроизведение с `error.code 2` (`MEDIA_ERR_NETWORK`), то есть ещё до
 * всякого кеша: меряли связь, а не воркер. Теперь байты клипа собираются
 * здесь же (`helpers/audio-clip-fixture.ts`) и отдаются с ТЕМИ ЖЕ
 * заголовками, которыми отвечает боевой источник. Подменён ровно один
 * слой — откуда приходят байты; весь путь, который проверяется
 * (`<audio>` → воркер → `CacheFirst` → `RangeRequestsPlugin`), остаётся
 * настоящим, и адрес клипа остаётся ЧУЖИМ источником, иначе дефект 7.218
 * (непрозрачный ответ `status 0`) было бы нечем воспроизвести.
 *
 * ТОЛЬКО CHROMIUM — по той же измеренной причине, что у
 * `e2e/sw-cache-budget.spec.ts`: WebKit под Playwright навигацию воркеру
 * отдаёт не так. Ограничение стоит в `playwright.config.ts`, а не
 * пропуском внутри теста.
 */

/** Рассказ «День стирки» — тот самый, на котором владелец и снял дефект.
 *  Ищется ПО НАЗВАНИЮ в каталоге, а не по идентификатору: локально это
 *  боевая строка, в CI — строка фикстуры с тем же текстом знак в знак и с
 *  НАСТОЯЩИМИ боевыми `fullAudioUrl` и смещениями предложений
 *  (`e2e/fixtures/stories.json`). Идентификаторы у них разные, название —
 *  одно. */
const STORY_TITLE = "День стирки";

interface ClipState {
  currentTime: number;
  paused: boolean;
  errorCode: number | null;
  src: string;
}

async function clipState(page: import("@playwright/test").Page): Promise<ClipState> {
  return page.evaluate(() => {
    const el = document.querySelector("audio");
    return {
      currentTime: el ? el.currentTime : -1,
      paused: el ? el.paused : true,
      errorCode: el && el.error ? el.error.code : null,
      src: el ? el.currentSrc || el.src : "",
    };
  });
}

async function playOnce(page: import("@playwright/test").Page): Promise<ClipState> {
  await page.getByRole("button", { name: /слушать|escuchar/i }).first().click();
  await page.waitForTimeout(4000);
  return clipState(page);
}

test("клип, однажды сыгранный, играет и после перезагрузки — и кеш держит целый ответ", async ({ page, context }) => {
  /**
   * ЗАГОЛОВОК СТЕНДА СНИМАЕТСЯ, И ЭТО СВОЙСТВО СТЕНДА, А НЕ ПРОДУКТА.
   *
   * Общий стенд (`e2e/helpers/test.ts`) ставит каждому тесту свой
   * `x-forwarded-for` — ради честного счёта у ограничителей частоты. На
   * ЭТОЙ пробе он ломает замер, и измерено, почему: лишний заголовок
   * делает запрос к чужому источнику НЕпростым, браузер идёт туда
   * предварительным `OPTIONS`, а источник отвечает **405** и разрешает
   * ровно один заголовок (`content-type`). Прогон без снятия: `<audio>`
   * получает `MEDIA_ELEMENT_ERROR: Format error` (код 4) ещё на первом
   * воспроизведении — то есть меряется стенд.
   *
   * В браузере человека лишних заголовков нет; а на случай, если правила
   * источника когда-нибудь изменятся, у маршрута клипов есть запасной
   * выход в сеть (`src/app/sw.ts`), и он держится сторожем.
   */
  // Бюджет теста: три воспроизведения по 4 с, ожидание воркера до 30 с,
  // три навигации. Названо числом, а не «на всякий случай», — иначе
  // отказ придёт по потолку теста и укажет на невиновный вызов
  // (правило 5 сторожа `check:e2e-live-probes`, долг 95).
  test.setTimeout(30_000 + 3 * 4_000 + 30_000);

  await context.setExtraHTTPHeaders({});

  // Источник клипа — свой, и он считает обращения. Ноль обращений
  // означал бы, что подмена не попала по адресу и проба меряет что-то
  // другое; ниже это проверяется числом, а не на веру.
  const clipOrigin = await serveClipLocally(context);

  await loginWithSubscription(page);

  await page.goto("/ru");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });

  await page.goto("/ru/stories");
  const links = page.locator('a[href^="/ru/stories/"]').filter({ hasText: STORY_TITLE });
  expect(await links.count(), `в каталоге нет ни одной ссылки на «${STORY_TITLE}»`).toBeGreaterThan(0);
  const storyPath = new URL((await links.first().getAttribute("href"))!, "http://localhost").pathname;
  await page.goto(storyPath);
  await expectPageIsItself(page, storyPath, `рассказ «${STORY_TITLE}»`);

  const first = await playOnce(page);
  expect(
    clipOrigin.hits.length,
    "за клипом не сходили ни разу — значит подмена источника не попала по адресу и дальше мерилось бы не то",
  ).toBeGreaterThan(0);
  expect(first.errorCode, "первое воспроизведение: элемент <audio> сообщил об ошибке").toBeNull();
  expect(first.currentTime, "первое воспроизведение: время не сдвинулось").toBeGreaterThan(0);

  // Что именно лёг в кеш клипов. Непрозрачная запись (status 0, тело 0
  // байт) — это и есть дефект; настоящая запись читается и непуста.
  const cached = await page.evaluate(async () => {
    const cache = await caches.open("rf-audio");
    const out: Array<{ status: number; type: string; bodyLength: number }> = [];
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (!response) continue;
      out.push({ status: response.status, type: response.type, bodyLength: (await response.clone().arrayBuffer()).byteLength });
    }
    return out;
  });
  expect(cached.length, "в кеше клипов после воспроизведения не оказалось ни одной записи").toBeGreaterThan(0);
  expect(cached.filter((entry) => entry.status === 0).length, "в кеш клипов снова лёг непрозрачный ответ").toBe(0);
  expect(cached.filter((entry) => entry.bodyLength === 0).length, "в кеше клипов лежит запись с пустым телом").toBe(0);

  // ВТОРОЙ РАЗ — с кеша. Ровно то, что у владельца молчало.
  await page.reload();
  await expectPageIsItself(page, storyPath, `рассказ «${STORY_TITLE}», второй заход`);
  const second = await playOnce(page);
  expect(second.errorCode, "второе воспроизведение: элемент <audio> сообщил об ошибке — клип достали из кеша и отдать не смогли").toBeNull();
  expect(second.currentTime, "второе воспроизведение: время не сдвинулось — кнопка нажата, звука нет").toBeGreaterThan(0);

  // ПОЗИТИВНЫЙ КОНТРОЛЬ В ТОМ ЖЕ ПРОГОНЕ: кладём в кеш пустую запись на
  // тот же адрес — проба обязана увидеть поломку.
  const poisoned = await page.evaluate(async (url) => {
    const cache = await caches.open("rf-audio");
    await cache.put(new Request(url), new Response(new ArrayBuffer(0), { status: 200, headers: { "Content-Type": "audio/mpeg" } }));
    return url;
  }, second.src);
  expect(poisoned, "подсадка не нашла адреса клипа").toContain(".mp3");

  await page.reload();
  const broken = await playOnce(page);
  expect(
    broken.errorCode !== null || broken.currentTime === 0,
    "ПОДСАДКА НЕ ПОЙМАНА: в кеше лежит пустая запись, а проба всё равно считает, что клип играет",
  ).toBe(true);
  await context.close();
});
