import { randomInt } from "node:crypto";
import { test, expect } from "./helpers/test";
import { loginWithoutSubscription, loginWithSubscription } from "./helpers/auth";
import es from "../src/dictionaries/es.json";
import ru from "../src/dictionaries/ru.json";

/**
 * Экран ввода кода доступа В БРАУЗЕРЕ (PROGRESS.md 7.147, долг 90).
 *
 * Заход 7.146 построил механизм кодов и проверил его юнит-тестами маршрута и
 * сценариями на настоящей базе — но НЕ тем, что видит человек: ни отправка
 * формы, ни редирект с фразой отказа, ни обе локали браузером не
 * открывались. Это ровно тот класс слепоты, что у инцидента №1: 240 страниц
 * уроков отдавали HTTP 200 с корректным HTML и пустым «Something went
 * wrong», и ни один зелёный тест этого не видел.
 *
 * ЧТО ЗДЕСЬ УТВЕРЖДАЕТСЯ, кроме фразы. Фраза отказа — половина ответа;
 * вторая половина в том, ЧТО СТАЛО СО СТРАНИЦЕЙ И С АККАУНТОМ после неё.
 * Поэтому каждый случай отказа проверяет ещё три вещи:
 *
 *   1. платный материал (пазл `CROSSWORD B1/91`, см. `PAID_PUZZLE_PATH`)
 *      остался закрыт, и единая точка решения по-прежнему отвечает `free` —
 *      то есть отказ действительно отказ, а не «сказали нет, а доступ
 *      выдали»;
 *   2. форма ввода на месте и пуста — человеку есть куда ввести код заново;
 *   3. строка кода в базе не тронута (или тронута ровно так, как надо) —
 *      это читается стендом `/api/test/access-code`, а не выводится
 *      из фразы на экране.
 *
 * КОНТРОЛЬ НА СЛЕПОТУ встроен, а не приложен отдельно:
 *
 *   - `openRedeemForm` УТВЕРЖДАЕТ, что форма открыта и видима, до того как
 *     что-либо вводит. Спека, у которой форма не открылась (не та вкладка,
 *     не тот аккаунт), падает здесь, а не проходит молча;
 *   - `expectNotice` сверяет фразу с ЧУЖОЙ локалью тоже: текст обязан
 *     совпасть со своим словарём и НЕ совпасть с другим. Плюс `<html lang>`.
 *     Спека, открывшая не ту локаль, падает;
 *   - каждый закрытый материал проверяется и с другой стороны: в случае
 *     [успех] и [у человека уже есть доступ] тот же пазл обязан быть
 *     ОТКРЫТ. Без этого «закрыт» проходило бы и на сломанном для всех
 *     маршруте.
 *
 * Коды свои на каждый случай и на каждый прогон (см. `newCode`): файл идёт
 * в двух проектах Playwright параллельно, и общий код был бы погашен первым
 * прогоном. Заводит их СЕРВЕР, а не спека, — см. `bench` ниже.
 */

const DICTS = { es, ru };
type Lang = keyof typeof DICTS;
const OTHER: Record<Lang, Lang> = { es: "ru", ru: "es" };

/** Алфавит выпуска (src/lib/access-code-format.ts). Форма кода здесь та же,
 * что у настоящей партии, — иначе стенд проверял бы не тот вход. */
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY234679";

function newCode(): string {
  let body = "";
  for (let i = 0; i < 10; i += 1) body += ALPHABET[randomInt(ALPHABET.length)];
  return `E2E${body}`;
}

/**
 * Стенд кодов — маршрут `/api/test/access-code`, то есть ТОТ ЖЕ ПРОЦЕСС, что
 * держит сайт.
 *
 * Так было не всегда, и разница стоила красного CI. Первая редакция (7.147)
 * звала отдельный процесс `scripts/e2e-access-code.ts` под `tsx`, у которого
 * своё соединение к тому же файлу базы. На полном прогоне в форме CI это
 * роняло не эту спеку, а НАБОР: база в форме CI живёт в журнальном режиме
 * `delete`, второе соединение исключает пишущего, а libSQL под Prisma на
 * столкновении «писатель против писателя» не ждёт и не откатывает начатую
 * транзакцию — сервер отвечает `P1008 / SocketTimeout` до конца жизни
 * процесса (механизм измерен в 7.134, повторён числами в 7.148). Подпись
 * отказа поэтому обманчива: падал `POST /api/auth/register` СЛЕДУЮЩЕГО
 * теста, а не тот, который писал.
 *
 * `PRAGMA busy_timeout` на стороне стенда этого не лечит: ждать умеет только
 * стенд, а ломается сторона сервера, которая не ждёт.
 *
 * Правило, из-за нарушения которого всё это случилось, записано ещё в 7.134:
 * **базу e2e трогает ровно один процесс — сервер.**
 */
async function createCode(
  page: import("@playwright/test").Page,
  options: { expired?: boolean; revoked?: boolean } = {}
): Promise<string> {
  const code = newCode();
  const response = await page.context().request.post("/api/test/access-code", {
    data: { code, ...options },
  });
  expect(response.status(), `POST /api/test/access-code ${code}`).toBe(200);
  expect((await response.json()).created).toBe(code);
  return code;
}

async function showCode(
  page: import("@playwright/test").Page,
  code: string
): Promise<Record<string, unknown>> {
  const response = await page.context().request.get(`/api/test/access-code?code=${code}`);
  expect(response.status(), `GET /api/test/access-code ${code}`).toBe(200);
  const row = (await response.json()) as Record<string, unknown>;
  // Стенд обязан НАЙТИ строку. Без этого «redeemedAt равен null» проходило бы
  // и на коде, которого в базе нет вовсе.
  expect(row.found, `строка кода ${code} есть в базе`).toBe(true);
  return row;
}

/**
 * ПЛАТНЫЙ МАТЕРИАЛ, на котором проверяется результат погашения.
 *
 * `CROSSWORD B1/91` — не случайный адрес: `sequence > 10`, то есть вне
 * бесплатного образца (`isFreeWordGamePuzzle`), и `premiumOnly = false`, то
 * есть подписчику уровня `standard` он открыт полностью. Ровно эта пара
 * свойств делает «закрыто» и «открыто» ниже утверждениями о ДОСТУПЕ, а не о
 * том, что страница сломана для всех. Тот же пазл по тем же причинам берёт
 * e2e/word-games-access.spec.ts, и он есть и в `dev.db`, и в фикстуре CI
 * (e2e/fixtures/word-games.json).
 *
 * ПОЧЕМУ НЕ `/media`, которым пользуется e2e/helpers/auth.ts. Замер 7.147:
 * `/es/media` для аккаунта БЕЗ подписки отдаёт 200 и свой список с замками —
 * страница давно перестала уводить на `/pricing` (`src/app/[lang]/media/page.tsx`
 * решает это позамочно, `canAccessMediaItem`). Первая версия этой спеки на
 * нём и стояла: 20 падений из 24, и все — на «до погашения материал закрыт».
 * Комментарий в `helpers/auth.ts`, называющий `/media` надёжной пробой
 * доступа, устарел; см. там же.
 */
const PAID_PUZZLE_PATH = "word-games/CROSSWORD/B1/91";

async function paidMaterialIsOpen(page: import("@playwright/test").Page, lang: Lang): Promise<boolean> {
  const response = await page.context().request.get(`/${lang}/${PAID_PUZZLE_PATH}`);
  expect(response.status(), `GET /${lang}/${PAID_PUZZLE_PATH}`).toBe(200);
  return !new URL(response.url()).pathname.includes("/pricing");
}

/** Второй, независимый признак: что о человеке говорит единая точка решения.
 * Страница может открыться или не открыться по десятку причин; здесь
 * спрашивается сам ответ. */
async function tierOf(page: import("@playwright/test").Page): Promise<string> {
  const response = await page.context().request.get("/api/subscription/status");
  expect(response.status(), "GET /api/subscription/status").toBe(200);
  return (await response.json()).tier;
}

/**
 * Открыть вкладку подписки и УБЕДИТЬСЯ, что форма кода на ней есть.
 *
 * `firstLanding` — не удобство, а утверждение. Модалка приветствия
 * (`WelcomeOverlay`) — full-screen `role="dialog"` с `z-[60]`, и она съела бы
 * клик по кнопке формы. Она гарантирована на ПЕРВОМ заходе каждого нового
 * аккаунта (ключ `localStorage` — пара `userId` + календарный день), и
 * гарантированно отсутствует на втором заходе того же. Поэтому здесь не
 * «посмотрим, есть ли», а два разных утверждения: «есть и снята» либо «её
 * нет вовсе». Подсматривание (`if (await isVisible())`) отвечало бы «нет»
 * одинаково и когда модалки нет, и когда её эффект ещё не отработал.
 */
async function openRedeemForm(
  page: import("@playwright/test").Page,
  lang: Lang,
  firstLanding: boolean,
) {
  const response = await page.goto(`/${lang}/profile?tab=subscription`, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `GET /${lang}/profile?tab=subscription`).toBe(200);

  // Признак конца гидратации приложение сообщает само (HydrationMarker.tsx):
  // модалка монтируется в эффекте, то есть ПОСЛЕ снятия этого атрибута.
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-hydrating"));
  const greeting = page.locator('[role="dialog"][aria-modal="true"]');
  if (firstLanding) {
    await expect(greeting, "приветствие на первом заходе аккаунта").toBeVisible();
    await greeting.click({ position: { x: 4, y: 4 } });
    await expect(greeting).toBeHidden();
  } else {
    await expect(greeting).toHaveCount(0);
  }

  const form = page.locator('form[action="/api/access-code/redeem"]');
  // ЭТО И ЕСТЬ КОНТРОЛЬ НА СЛЕПОТУ: без формы всё, что ниже, проверяло бы
  // пустоту. Спека со сломанной посылкой падает здесь.
  await expect(form, "форма ввода кода на вкладке подписки").toBeVisible();
  const input = form.locator('input[name="code"]');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("");
  return { form, input };
}

async function submitCode(
  page: import("@playwright/test").Page,
  lang: Lang,
  code: string,
  firstLanding = true,
) {
  const { form, input } = await openRedeemForm(page, lang, firstLanding);
  await input.fill(code);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL(/[?&]accessCode=/);
}

/**
 * Фраза на экране — своя и не чужая.
 *
 * `key` — ключ словаря, а не литерал: текст правится в словаре, и тест,
 * державший копию строки, начал бы врать в тот же день. Сверка с ЧУЖОЙ
 * локалью здесь обязательна: без неё спека, открывшая /es вместо /ru,
 * прошла бы на общей для двух словарей строке.
 */
async function expectNotice(
  page: import("@playwright/test").Page,
  lang: Lang,
  key: keyof typeof es.profile & keyof typeof ru.profile,
) {
  const mine = DICTS[lang].profile[key] as string;
  const theirs = DICTS[OTHER[lang]].profile[key] as string;
  expect(mine, `фразы ${key} в двух локалях обязаны различаться, иначе сверка локали пуста`).not.toBe(theirs);

  await expect(page.locator("html")).toHaveAttribute("lang", lang);
  await expect(page.getByText(mine, { exact: true })).toBeVisible();
  await expect(page.getByText(theirs, { exact: true })).toHaveCount(0);
}

for (const lang of ["es", "ru"] as const) {
  test(`/${lang}: живой код открывает платный материал`, async ({ page }) => {
    await loginWithoutSubscription(page);
    // Контроль обратной стороны: до погашения материал закрыт. Без этой
    // строки «открыт после» проходило бы и на маршруте, открытом всем.
    expect(await tierOf(page), "до погашения единая точка решения говорит free").toBe("free");
    expect(await paidMaterialIsOpen(page, lang), "до погашения платный пазл закрыт").toBe(false);

    const code = await createCode(page);
    await submitCode(page, lang, code);

    expect(new URL(page.url()).searchParams.get("accessCode")).toBe("redeemed");
    await expectNotice(page, lang, "accessCodeRedeemed");

    await expect
      .poll(() => paidMaterialIsOpen(page, lang), { message: "после погашения платный пазл открыт" })
      .toBe(true);
    // Второй признак того же события, независимый от вёрстки страницы:
    // код кладёт строку плана `manual`, а она читается как `standard`.
    expect(await tierOf(page), "после погашения — standard, а не premium").toBe("standard");

    const row = await showCode(page, code);
    expect(row.redeemedAt, "код помечен погашенным").not.toBeNull();
    expect(typeof row.redeemedById, "у погашения записан человек").toBe("string");
    expect(row.revokedAt).toBeNull();
  });

  test(`/${lang}: неизвестный код — отказ, доступа нет, форма на месте`, async ({ page }) => {
    await loginWithoutSubscription(page);
    // Код той же формы, что настоящий, но не заведённый ничем.
    await submitCode(page, lang, newCode());

    expect(new URL(page.url()).searchParams.get("accessCode")).toBe("unknown");
    await expectNotice(page, lang, "accessCodeUnknown");
    expect(await tierOf(page), "после отказа доступа не появилось").toBe("free");
    expect(await paidMaterialIsOpen(page, lang), "после отказа платный пазл закрыт").toBe(false);
    // Состояние страницы после отказа: форма снова открыта и пуста.
    await openRedeemForm(page, lang, false);
  });

  test(`/${lang}: уже погашенный код — отказ второму, и код остаётся за первым`, async ({ page }) => {
    await loginWithoutSubscription(page);
    const code = await createCode(page);
    await submitCode(page, lang, code);
    await expectNotice(page, lang, "accessCodeRedeemed");
    const afterFirst = await showCode(page, code);
    expect(afterFirst.redeemedAt).not.toBeNull();

    // Второй человек в том же браузере: регистрация заменяет сессию.
    await loginWithoutSubscription(page);
    expect(await paidMaterialIsOpen(page, lang), "у второго доступа нет с самого начала").toBe(false);
    await submitCode(page, lang, code);

    expect(new URL(page.url()).searchParams.get("accessCode")).toBe("already_redeemed");
    await expectNotice(page, lang, "accessCodeAlreadyRedeemed");
    expect(await paidMaterialIsOpen(page, lang), "второму материал так и не открылся").toBe(false);

    const afterSecond = await showCode(page, code);
    expect(afterSecond.redeemedById, "погашение осталось за первым").toBe(afterFirst.redeemedById);
    expect(afterSecond.redeemedAt).toBe(afterFirst.redeemedAt);
  });

  test(`/${lang}: просроченный код — отказ, и код не израсходован`, async ({ page }) => {
    await loginWithoutSubscription(page);
    const code = await createCode(page, { expired: true });
    await submitCode(page, lang, code);

    expect(new URL(page.url()).searchParams.get("accessCode")).toBe("expired");
    await expectNotice(page, lang, "accessCodeExpired");
    expect(await paidMaterialIsOpen(page, lang), "после отказа платный пазл закрыт").toBe(false);
    expect((await showCode(page, code)).redeemedAt, "просроченный код не погашается").toBeNull();
  });

  test(`/${lang}: отозванный код — отказ, и код не израсходован`, async ({ page }) => {
    await loginWithoutSubscription(page);
    const code = await createCode(page, { revoked: true });
    await submitCode(page, lang, code);

    expect(new URL(page.url()).searchParams.get("accessCode")).toBe("revoked");
    await expectNotice(page, lang, "accessCodeRevoked");
    expect(await paidMaterialIsOpen(page, lang), "после отказа платный пазл закрыт").toBe(false);
    expect((await showCode(page, code)).redeemedAt, "отозванный код не погашается").toBeNull();
  });

  test(`/${lang}: у кого доступ уже есть — код не тратится`, async ({ page }) => {
    await loginWithSubscription(page);
    // Контроль: у этого человека материал открыт ДО ввода кода, поэтому
    // «открыт после» ниже ничего не доказывает само по себе — доказывает
    // то, что строка кода осталась нетронутой.
    expect(await paidMaterialIsOpen(page, lang), "у подписчика платный пазл открыт").toBe(true);

    const code = await createCode(page);
    await submitCode(page, lang, code);

    expect(new URL(page.url()).searchParams.get("accessCode")).toBe("already_has_access");
    await expectNotice(page, lang, "accessCodeAlreadyHasAccess");
    expect(await paidMaterialIsOpen(page, lang), "доступ на месте").toBe(true);

    const row = await showCode(page, code);
    expect(row.redeemedAt, "код не сожжён за доступ, который и так был").toBeNull();
    expect(row.revokedAt).toBeNull();
  });
}
