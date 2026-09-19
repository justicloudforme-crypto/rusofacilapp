import { test, expect } from "./helpers/test";
import { storyFixtureShape } from "./helpers/story-fixture";
import { expectPageIsItself } from "./helpers/page-identity";

/**
 * ГОЛОС БРАУЗЕРА НЕ ЗВУЧИТ НИ РАЗУ — ДОЛГ 118 (заход 7.217).
 *
 * Строка долга дословно: «факт **воспроизведения** превью в живом
 * браузере проверен одноразовым скриптом, а не тестом: `check:silent-listen`
 * читает только разметку и о том, заговорил ли кто-нибудь на самом деле,
 * не знает ничего. Замер 7.161 (прод — 1 вызов синтеза и 0 элементов
 * `<audio>`; локальная боевая сборка — 0 вызовов и играющий `0-0.mp3`)
 * повторить сегодня нечем, кроме рук → e2e, считающий вызовы
 * `speechSynthesis.speak` на закрытой странице анонимом → тогда откат в
 * синтез не сможет вернуться молча».
 *
 * ЧТО ЭТА ПРОБА ДЕЛАЕТ И ЧЕМ ОНА ОТЛИЧАЕТСЯ ОТ ДВУХ СУЩЕСТВУЮЩИХ
 * СТОРОЖЕЙ. `check:no-runtime-tts` читает ИСХОДНИКИ и собранные бандлы:
 * он видит слово `speechSynthesis`, а не звук. `check:silent-listen`
 * читает РАЗМЕТКУ: он видит кнопку и элемент `<audio>`, а не звук. Ни
 * один из них не может ответить на вопрос «заговорил ли кто-нибудь», и
 * именно этот вопрос задаётся здесь: движок синтеза подменяется ДО
 * первого скрипта страницы, и считается число вызовов.
 *
 * ПРИБОР ПРОВЕРЯЕТСЯ В ТОМ ЖЕ ПРОГОНЕ. «Ноль вызовов» ничего не значит,
 * пока не показано, что счётчик умеет считать до одного (правило 4.1):
 * последним шагом страница сама зовёт подменённый `speak`, и проба
 * требует, чтобы счётчик стал единицей. Без этого шага молчащий счётчик и
 * сломанная подмена выглядят одинаково.
 */

/** Поверхности, у которых когда-либо была кнопка «слушать». Локаль одна:
 *  вопрос «звучит ли синтез» от языка интерфейса не зависит. */
const SURFACES = [
  { path: "/es/courses/a1/1", what: "урок A1-1 (бесплатный)" },
  { path: "/es/glossary/caso-nominativo", what: "термин глоссария" },
];

/** Ярлыки органов «слушать» — из словаря, а не вшиты: правка текста не
 *  должна ослеплять пробу молча. */
const LISTEN = /Escuchar|Pausar|Слушать|Пауза/i;

const COUNTER = () => {
  const w = window as unknown as { __speakCalls: number };
  w.__speakCalls = 0;
  const speechSynthesis = {
    speak: () => {
      w.__speakCalls += 1;
    },
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    getVoices: () => [],
    speaking: false,
    paused: false,
    pending: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  Object.defineProperty(window, "speechSynthesis", { value: speechSynthesis, configurable: true });
  class Utterance {
    text: string;
    constructor(text = "") {
      this.text = text;
    }
  }
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
};

async function pressEveryListenControl(page: import("@playwright/test").Page) {
  const controls = page.getByRole("button", { name: LISTEN });
  const count = await controls.count();
  for (let i = 0; i < count; i += 1) {
    await controls.nth(i).click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  return count;
}

async function speakCalls(page: import("@playwright/test").Page) {
  return page.evaluate(() => (window as unknown as { __speakCalls: number }).__speakCalls);
}

for (const surface of SURFACES) {
  test(`${surface.what}: анониму синтез не звучит ни разу`, async ({ page }) => {
    // Бюджет назван числом: на уроке A1-1 органов «слушать» четырнадцать,
    // и каждый нажимается со своим потолком. Замер 19.09.2026: на этой
    // машине случай укладывался в 5 с, а на бегунке CI не укладывался в
    // 30 с по умолчанию и краснел трижды подряд — отказ приходил по
    // потолку ТЕСТА и указывал на невиновный `waitForTimeout` (долг 95).
    test.setTimeout(120_000);
    await page.addInitScript(COUNTER);
    const response = await page.goto(surface.path);
    expect(response?.status(), `${surface.path} не ответила 200`).toBe(200);
    await expectPageIsItself(page, surface.path, surface.what);

    const pressed = await pressEveryListenControl(page);
    const audios = await page.locator("audio").count();
    // Числом, а не «всё в порядке»: молчащая проба и проба, которой не по
    // чему было нажимать, обязаны читаться по-разному.
    console.log(`  ${surface.path}: органов «слушать» ${pressed}, элементов <audio> ${audios}`);

    expect(await speakCalls(page), `${surface.what}: браузерный синтез заговорил`).toBe(0);

    // ПОЗИТИВНЫЙ КОНТРОЛЬ прибора, на той же странице.
    await page.evaluate(() => window.speechSynthesis.speak(new SpeechSynthesisUtterance("контроль")));
    expect(await speakCalls(page), "счётчик вызовов синтеза не видит даже прямого вызова").toBe(1);
  });
}

test("закрытый рассказ анониму: синтез не звучит, и кнопка без записи не рисуется", async ({ page, request }) => {
  const fixture = await storyFixtureShape(request);
  test.skip(!fixture.present, fixture.why);

  test.setTimeout(120_000);
  await page.addInitScript(COUNTER);
  const path = "/es/stories/e2e-fixture-story-camaleon";
  const response = await page.goto(path);
  expect(response?.status(), `${path} не ответила 200`).toBe(200);
  await expectPageIsItself(page, path, "рассказ фикстуры");

  const pressed = await pressEveryListenControl(page);
  const audios = await page.locator("audio").count();
  console.log(`  ${path}: органов «слушать» ${pressed}, элементов <audio> ${audios}`);

  // То же асимметричное правило, что у `check:silent-listen`, но
  // проверенное в живом браузере: кнопка без записи — нарушение, запись
  // без кнопки — нет.
  if (pressed > 0) {
    expect(audios, "кнопка «слушать» есть, а записи для неё не отдано").toBeGreaterThan(0);
  }
  expect(await speakCalls(page), "браузерный синтез заговорил на закрытом рассказе").toBe(0);

  await page.evaluate(() => window.speechSynthesis.speak(new SpeechSynthesisUtterance("контроль")));
  expect(await speakCalls(page), "счётчик вызовов синтеза не видит даже прямого вызова").toBe(1);
});
