/**
 * ОДИН ЗНАК ПЛАТНОГО НА ВСЁ ПРИЛОЖЕНИЕ — СВЕРКА С ОТРИСОВАННЫМ ЭКРАНОМ.
 * Заход 7.196, часть 1. Плюс части 2 и 4 того же захода.
 *
 * ====================================================================
 * ОТКУДА ПРАВИЛО
 * ====================================================================
 *
 * Владелец прошёл 14.09.2026 по живому телефону и снял: корона доехала до
 * словаря и до вкладки «Литературные», а до рассказов, игр и плиток тем —
 * нет. Числом: коронованных строк на проде 2255, а корону видно у одной
 * семьи из четырёх.
 *
 * Причина была не в разметке, а в том, что каждая поверхность решала сама,
 * какой знак ей печатать. Правило теперь одно —
 * `accessSignFor`/`sortSign` в `src/lib/access-marks.ts`, — и этот сторож
 * держит его НА ЭКРАНЕ, а не в модуле.
 *
 * ====================================================================
 * ПОЧЕМУ ОН ДВУСТОРОННИЙ И ЧТО ЭТО ЗНАЧИТ ЗДЕСЬ
 * ====================================================================
 *
 * Живая половина: для каждой поверхности переписи ожидаемый знак
 * ВЫЧИСЛЯЕТСЯ тем же правилом, и сверяется с тем, что отрисовано.
 *
 * Подсадка (`--plant`): то же самое, но ожидание берётся у ПОДМЕНЁННОГО
 * правила, в котором корона и замок поменяны местами. Каждая поверхность,
 * на которой знак вообще есть, ОБЯЗАНА тогда покраснеть; молчание хоть на
 * одной означает, что эта поверхность прибором не судится вовсе, и прогон
 * красный. Ровно этой половины не было у прибора 7.195, и он отчитался
 * «знаков 11 из 11» про экраны, на которых знака не было.
 *
 * Третье направление — ВЕБ. До 18.09.2026 оно звучало «веб не тронут»: те
 * же адреса открывались БЕЗ признака оболочки, и знак обязан был совпасть
 * со старым `accessMarkFor`. Решением владельца от 18.09.2026 (долг 257)
 * правило поменялось у ОДНОЙ поверхности — у сетки тем словаря: там
 * браузер обязан говорить ровно то же, что оболочка. Поэтому направление
 * разделено на два утверждения, и оба живые:
 *
 *   `sameInWeb: true`  — знак в браузере ВЫЧИСЛЯЕТСЯ тем же правилом, что
 *                        и в оболочке, и обязан совпасть с ним знак в знак;
 *   иначе              — прежнее утверждение, `accessMarkFor`.
 *
 * Смена правила ослаблением не является, и это проверяется: под `--plant`
 * ожидание веб-половины тоже подменяется, и она ОБЯЗАНА покраснеть.
 *
 *   npx tsx scripts/check-access-signs.ts --base=http://localhost:3123
 *   npx tsx scripts/check-access-signs.ts --base=… --plant
 */
import { chromium, type BrowserContext } from "playwright";
import {
  accessMarkFor,
  accessSignFor,
  levelRequirement,
  meetsRequirement,
  sortSign,
  type AccessRequirement,
  type AccessSign,
  type ViewerTier,
} from "../src/lib/access-marks";
import { isEntryPoint } from "../src/lib/entry-point";

const TOKEN = "RFNativeShell";
const COOKIE = "rf_native_shell";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type Role = "guest" | "free" | "standard" | "premium";
const TIER_OF: Record<Role, ViewerTier> = {
  guest: "free",
  free: "free",
  // «Доступ по коду» — разряд `standard`. Заведён 18.09.2026 ради игр:
  // именно у него расхождение браузера и оболочки было самым дорогим
  // (в оболочке 580 замков, в браузере 0).
  standard: "standard",
  premium: "premium",
};

/** Что должно стоять на узле. `null` — знака быть не должно. */
type Expected = AccessSign | null;

/**
 * ПОДМЕНЁННОЕ ПРАВИЛО — то самое «замок вместо короны и наоборот».
 * Живёт здесь, а не в продуктовом коде, и используется ТОЛЬКО в `--plant`.
 */
function swapped(sign: Expected): Expected {
  if (!sign) return { mark: "subscription", labelKey: "subscriptionBadge" };
  // Состояние подменяется вместе с сортом: иначе утверждение про замок
  // (долг 251) под подсадкой оставалось бы верным и красить было бы
  // нечего — то есть прибором оно не судилось бы вовсе.
  return sign.mark === "premium-tier"
    ? { mark: "subscription", labelKey: "subscriptionBadge", locked: !sign.locked }
    : { mark: "premium-tier", labelKey: "premiumTierBadge", locked: !sign.locked };
}

interface Surface {
  /** Имя для отчёта. */
  name: string;
  path: string;
  /** Под какими ролями смотреть. */
  roles: Role[];
  /** Селектор узлов, каждый из которых обязан нести (или не нести) знак. */
  selector: string;
  /**
   * Ожидание по узлу. Получает подпись узла и роль; отдаёт ожидаемый знак.
   * ВЫЧИСЛЯЕТСЯ правилом, а не перечислено руками, — иначе сторож
   * проверял бы вторую копию правила.
   */
  expect: (node: { text: string; key: string }, tier: ViewerTier) => Expected;
  /** Сколько узлов обязано найтись как минимум: иначе «0 нарушений» было
   *  бы доказано отсутствием экрана. */
  minNodes: number;
  /**
   * ДОЛГ 257. Поверхность, у которой браузер обязан говорить ТО ЖЕ, что
   * оболочка. Тогда веб-половина судит её тем же `expect`, а не прежним
   * `accessMarkFor`.
   */
  sameInWeb?: boolean;
  /**
   * ЗАКРЫТОСТЬ ЗНАЕТ ПОВЕРХНОСТЬ, А НЕ ПРАВИЛО.
   *
   * Сетка тем словаря считает `closed` сама, по переписи банка: тема,
   * в которой посетителю не отдано НИ ОДНОЙ карточки, закрыта, а тема,
   * где отдано хоть что-то, — нет (см. `accessSignFor`, опция `closed`).
   * Сторож эту перепись повторить не может и не должен — он судит
   * экран, а не второй экземпляр правила.
   *
   * Поэтому у таких поверхностей замок сверяется НЕ на равенство, а
   * односторонним утверждением, которое от данных не зависит вовсе:
   * **замка не может быть там, где тарифа ХВАТАЕТ**. Это ровно то
   * утверждение, ради которого проверка замка и заводилась: платящий за
   * Premium не должен видеть замок на том, за что заплатил.
   *
   * Цена отказа от равенства названа числом: на базе CI у 21 темы из 23
   * карточек уровня C1 нет вовсе, `closed` у них ложно, и равенство
   * покраснело бы на пустом банке, а не на дефекте. Поймано CI, а не
   * рассуждением.
   */
  surfaceOwnsClosed?: boolean;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

/**
 * Расходится ли ЗАМОК на узле с тем, что требуется. `null` — не
 * расходится.
 *
 * Две формы утверждения, и выбор между ними — не поблажка, а вопрос о
 * том, кто знает закрытость (см. `surfaceOwnsClosed`):
 *
 *   равенство       — правило знает закрытость целиком (полосы уровней);
 *   одностороннее   — закрытость считает поверхность, и тогда судится
 *                     только то, что от данных не зависит: замка не может
 *                     быть там, где тарифа хватает.
 */
function lockMismatch(surface: Surface, onScreen: boolean, want: Expected, tier: ViewerTier): string | null {
  if (surface.surfaceOwnsClosed) {
    if (!onScreen) return null;
    const requirement = want?.mark === "premium-tier" ? "premium-tier" : want?.mark === "subscription" ? "subscription" : "free";
    return meetsRequirement(requirement, tier)
      ? "на экране замок, хотя тарифа хватает — платящий не должен видеть замок на том, за что заплатил"
      : null;
  }
  if ((want?.locked ?? false) === onScreen) return null;
  return `на экране ${onScreen ? "замок" : "замка нет"}, правило требует ${want?.locked ? "замок" : "замка нет"}`;
}



const SURFACES: Surface[] = [
  {
    name: "словарь — полоса уровней",
    path: "/ru/vocabulary",
    roles: ["guest", "premium"],
    selector: "[data-testid=level-filter] button",
    expect: (node) => (LEVELS.includes(node.key) ? sortSign(levelRequirement("flashcards", node.key)) : null),
    minNodes: 6,
  },
  {
    name: "словарь — плитки тем на C1",
    path: "/ru/vocabulary?level=C1",
    roles: ["guest", "premium"],
    selector: "[data-testid=category-tile]",
    expect: (_node, tier) => accessSignFor(levelRequirement("flashcards", "C1"), tier, { nativeShell: true }),
    minNodes: 23,
    // Закрытость здесь считает плитка, по переписи банка — см. выше.
    surfaceOwnsClosed: true,
    // Долг 257: та же корона и в браузере, у той же роли.
    sameInWeb: true,
  },
  {
    name: "словарь — плитки тем на B1 (отрицательный контроль сорта)",
    path: "/ru/vocabulary?level=B1",
    roles: ["premium"],
    // У подписчика Premium на B1 открыто всё: знака быть не должно ни
    // одного. Без этой строки «корона везде» прошло бы как «корона там,
    // где надо».
    selector: "[data-testid=category-tile]",
    expect: () => null,
    minNodes: 23,
    // И отрицательный контроль сорта тоже общий: «корона везде» не должно
    // проходить ни в оболочке, ни в браузере.
    sameInWeb: true,
  },
  {
    name: "каталог рассказов — полоса уровней",
    path: "/ru/stories",
    roles: ["guest", "premium"],
    selector: "[data-testid=story-level-filter] button",
    expect: (node) => (LEVELS.includes(node.key) ? sortSign(levelRequirement("stories", node.key)) : null),
    minNodes: 6,
  },
  {
    name: "игры — полоса уровней",
    path: "/ru/word-games",
    roles: ["guest", "premium"],
    selector: "[data-testid=word-game-level-filter] button",
    // Долг того же класса, что 257: до 18.09.2026 полоса уровней игр в
    // браузере не несла знака вовсе.
    sameInWeb: true,
    expect: (node, tier) =>
      LEVELS.includes(node.key)
        ? accessSignFor("subscription", tier, {
            nativeShell: true,
            // C1 у игр премиальным сортом НЕ является: 344 пазла из 482
            // открывает обычная подписка. Закрыт он бесплатной пробе
            // целиком — это и печатается.
            closed: tier === "free" && node.key === "C1",
          })
        : null,
    minNodes: 5,
  },
];

async function readNodes(
  context: BrowserContext,
  base: string,
  surface: Surface,
): Promise<Array<{ key: string; text: string; mark: string | null; locked: boolean; uppercase: boolean; label: string }>> {
  const page = await context.newPage();
  try {
    await page.goto(`${base}${surface.path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForSelector(surface.selector, { timeout: 30_000 });
    // Знак сорта не ждёт сетевого ответа по построению, но плитки ждут
    // переписи банка: без этой паузы сторож судил бы заглушку.
    await page.waitForTimeout(2500);
    return await page.$$eval(surface.selector, (els) =>
      els.map((el) => {
        const badge = el.querySelector("[data-access-mark]");
        // ЗАМОК СЧИТАЕТСЯ ОТДЕЛЬНО (долг 251): у него свой признак,
        // потому что знак платного на узле по-прежнему один.
        const lock = el.querySelector("[data-access-locked]");
        const key = (el.getAttribute("data-level") ?? el.textContent ?? "").trim().split(/\s+/)[0] ?? "";
        return {
          key,
          text: (el.textContent ?? "").trim(),
          mark: badge?.getAttribute("data-access-mark") ?? null,
          locked: lock !== null,
          uppercase: badge ? /uppercase/.test(badge.className) : false,
          label: (badge?.getAttribute("title") ?? badge?.textContent ?? "").trim(),
        };
      }),
    );
  } finally {
    await page.close().catch(() => {});
  }
}


/**
 * ====================================================================
 * ПЛИТКИ ПАЗЛОВ — ЧЕТВЁРТОЕ НАПРАВЛЕНИЕ (18.09.2026)
 * ====================================================================
 *
 * Поверхности выше судятся ПРАВИЛОМ: сторож вычисляет ожидаемый знак сам
 * и сверяет с экраном. Для плиток пазлов так не выйдет: требование
 * отдельной плитки зависит от колонок `curved`/`premiumOnly` той строки,
 * а в разметке их нет и быть не должно — плитка носит ЗНАК, а не данные,
 * по которым он выбран.
 *
 * Поэтому здесь утверждение другой формы, и оно ровно то, что просил
 * владелец: **браузер и оболочка обязаны давать одинаковые знаки для
 * ОДНОЙ роли**. Сравниваются два отрисованных экрана, плитка к плитке, а
 * не экран с пересказом правила.
 *
 * Рядом — второе утверждение, которое сравнением не доказывается: **у
 * Premium замков нет нигде**. Одинаковость прошла бы и на двух экранах,
 * где замок стоит у всех. Замеров у этого утверждения два (оболочка и
 * браузер), и у него есть пол: корон у Premium обязано быть больше нуля,
 * иначе «замков 0» доказывалось бы несобравшимся экраном.
 */
const GAME_TYPES = ["WORD_SEARCH", "CROSSWORD"] as const;

interface Tile {
  /** Адрес плитки — она же и подпись узла в отчёте. */
  key: string;
  mark: string | null;
  locked: boolean;
}

async function readGameTiles(context: BrowserContext, base: string, lang = "ru"): Promise<Tile[]> {
  const page = await context.newPage();
  const out: Tile[] = [];
  try {
    await page.goto(`${base}/${lang}/word-games`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("[data-testid=word-game-level-filter] button", { timeout: 30_000 });
    for (const type of GAME_TYPES) {
      // Вкладка выбирается по порядку в tablist: подпись локаль-зависима,
      // а порядок — нет (см. WordGamesPicker: филворд, затем кроссворд).
      const tabs = page.locator('[role=tablist] [role=tab]');
      await tabs.nth(GAME_TYPES.indexOf(type)).click();
      for (const level of LEVELS) {
        await page.locator(`[data-testid=word-game-level-filter] button`, { hasText: level }).first().click();
        await page.waitForTimeout(250);
        out.push(
          ...(await page.$$eval("a[href*='/word-games/']", (els) =>
            els
              .filter((el) => /\/word-games\/[A-Z_]+\/[A-Za-z0-9]+\/\d+$/.test(el.getAttribute("href") ?? ""))
              .map((el) => ({
                key: el.getAttribute("href") ?? "",
                mark: el.querySelector("[data-access-mark]")?.getAttribute("data-access-mark") ?? null,
                locked: el.querySelector("[data-access-locked]") !== null,
              })),
          )),
        );
      }
    }
  } finally {
    await page.close().catch(() => {});
  }
  return out;
}

/** Подпись плитки одной строкой — по ней и идёт сравнение. */
const tileSign = (t: Tile) => `${t.key}:${t.mark ?? "-"}${t.locked ? "+lock" : ""}`;

/**
 * ПОДСАДКИ ДЛЯ ПЛИТОК — в обе стороны, как просил владелец.
 *
 *   `extra-lock`   — у Premium в браузере появился лишний замок;
 *   `missing-lock` — у роли без доступа замок в браузере пропал.
 *
 * Подменяется ТОЛЬКО веб-половина: сравнение обязано это заметить.
 * Подсадка живёт здесь, в стороже, и в продуктовый код не уходит.
 */
function plantTiles(tiles: Tile[], kind: "extra-lock" | "missing-lock"): Tile[] {
  if (kind === "extra-lock") {
    const at = tiles.findIndex((t) => !t.locked);
    return at === -1 ? tiles : tiles.map((t, i) => (i === at ? { ...t, locked: true } : t));
  }
  const at = tiles.findIndex((t) => t.locked || t.mark === "subscription");
  return at === -1 ? tiles : tiles.map((t, i) => (i === at ? { ...t, locked: false, mark: null } : t));
}

async function makeSession(base: string, plan: "e2e-test" | "lifetime"): Promise<Array<{ name: string; value: string; url: string }>> {
  const email = `signs-${process.pid}-${plan}@example.test`;
  const registered = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": SAFARI },
    body: new URLSearchParams({ email, password: "TestPass123!", lang: "ru", redirectTo: "/ru" }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const cookies = registered.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="));
  if (cookies.length === 0) {
    throw new Error(
      `не удалось завести роль: /api/auth/register ответил ${registered.status} без сессионной куки. ` +
        `Сервер поднят без E2E_TEST_SEED=1? Тихо пропустить роль нельзя.`,
    );
  }
  const granted = await fetch(`${base}/api/test/grant-subscription`, {
    method: "POST",
    headers: { cookie: cookies.join("; "), "content-type": "application/json" },
    body: JSON.stringify({ plan }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!granted.ok) throw new Error(`/api/test/grant-subscription ответил ${granted.status}`);
  return cookies.map((c) => {
    const [name, ...rest] = c.split("=");
    return { name, value: rest.join("="), url: base };
  });
}

export async function main(): Promise<number> {
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  if (!baseArg) {
    console.error("нужен --base=http://… — этой проверке нечего открывать без сервера");
    return 1;
  }
  const base = baseArg.slice("--base=".length);
  const plant = process.argv.includes("--plant");
  /**
   * `--ci` — форма пустой базы. Полосы фильтров рисуются всегда (они не от
   * данных), а сетка тем на базе CI может отдать меньше плиток, чем на
   * полной. Правило судит КАЖДЫЙ найденный узел, поэтому под `--ci` пол
   * опускается до одного: ноль узлов по-прежнему отказ.
   */
  const ci = process.argv.includes("--ci");

  const browser = await chromium.launch();
  const problemsBySurface = new Map<string, string[]>();
  let nodesSeen = 0;
  let signsSeen = 0;

  try {
    const premiumCookies = await makeSession(base, "lifetime");
    /** «Доступ по коду» — разряд `standard`, нужен играм (см. ниже). */
    const standardCookies = await makeSession(base, "e2e-test");
    const contexts: Partial<Record<Role, BrowserContext>> = {};
    /** Те же роли без признака оболочки — третье направление (долг 257). */
    const webContexts: Partial<Record<Role, BrowserContext>> = {};
    const cookiesOf: Record<Role, Array<{ name: string; value: string; url: string }>> = {
      guest: [],
      free: [],
      standard: standardCookies,
      premium: premiumCookies,
    };
    for (const role of ["guest", "standard", "premium"] as Role[]) {
      const ctx = await browser.newContext({
        userAgent: `${SAFARI} ${TOKEN}`,
        viewport: { width: 360, height: 720 },
      });
      await ctx.addCookies([{ name: COOKIE, value: "1", url: base }, ...cookiesOf[role]]);
      contexts[role] = ctx;
      /**
       * ТА ЖЕ РОЛЬ, НО БРАУЗЕРОМ — долг 257. Роль обязана быть ТОЙ ЖЕ:
       * иначе веб-половина сравнивала бы не «два места», а «два разных
       * посетителя». Первая редакция этой правки именно так и ошиблась —
       * судила отрицательный контроль плана Premium ролью гостя, и он
       * честно покраснел на замках, которые гостю положены.
       */
      const web = await browser.newContext({ userAgent: SAFARI, viewport: { width: 360, height: 720 } });
      await web.addCookies(cookiesOf[role]);
      webContexts[role] = web;
    }

    for (const surface of SURFACES) {
      const problems: string[] = [];
      for (const role of surface.roles) {
        const nodes = await readNodes(contexts[role]!, base, surface);
        const minNodes = ci ? 1 : surface.minNodes;
        if (nodes.length < minNodes) {
          problems.push(
            `${surface.name} (${role}): узлов ${nodes.length} при ожидаемых минимум ${minNodes} — ` +
              `экран не собрался, и «0 нарушений» здесь ничего не значит`,
          );
          continue;
        }
        for (const node of nodes) {
          nodesSeen += 1;
          const want0 = surface.expect(node, TIER_OF[role]);
          const want = plant ? swapped(want0) : want0;
          if (node.mark) signsSeen += 1;
          if ((want?.mark ?? null) !== node.mark) {
            problems.push(
              `${surface.name} (${role}, «${node.key}»): на экране ${node.mark ?? "знака нет"}, ` +
                `правило требует ${want?.mark ?? "знака нет"}`,
            );
          }
          const lockProblem = lockMismatch(surface, node.locked, want, TIER_OF[role]);
          if (lockProblem) problems.push(`${surface.name} (${role}, «${node.key}»): ${lockProblem}`);
          if (node.uppercase) problems.push(`${surface.name} (${role}, «${node.key}»): на знаке стоит uppercase`);
        }
      }
      problemsBySurface.set(surface.name, problems);
    }

    /**
     * ТРЕТЬЕ НАПРАВЛЕНИЕ — ВЕБ. Два утверждения, см. шапку:
     *   `sameInWeb` — браузер говорит то же, что оболочка (долг 257);
     *   остальные   — браузер говорит прежнее (`accessMarkFor`).
     *
     * Под `--plant` половина НЕ пропускается: ожидание подменяется тем же
     * `swapped`, и поверхности обязаны покраснеть. Пропуск означал бы, что
     * про веб прибор не судит вовсе, — ровно тот промах, ради которого у
     * этого сторожа и заводилась подсадка.
     */
    {
      const webSame: string[] = [];
      const webLegacy: string[] = [];
      for (const surface of SURFACES) {
        if (surface.sameInWeb) {
          for (const role of surface.roles) {
            const nodes = await readNodes(webContexts[role]!, base, surface);
            if (nodes.length < (ci ? 1 : surface.minNodes)) {
              webSame.push(
                `${surface.name} (веб, ${role}): узлов ${nodes.length} при ожидаемых минимум ${ci ? 1 : surface.minNodes} — ` +
                  `экран не собрался, и «0 нарушений» здесь ничего не значит`,
              );
              continue;
            }
            for (const node of nodes) {
              const want0 = surface.expect(node, TIER_OF[role]);
              const want = plant ? swapped(want0) : want0;
              if ((want?.mark ?? null) !== node.mark) {
                webSame.push(
                  `${surface.name} (веб, ${role}, «${node.key}»): на экране ${node.mark ?? "знака нет"}, ` +
                    `правило требует ${want?.mark ?? "знака нет"} — браузер и оболочка обязаны говорить одно (долг 257)`,
                );
              }
              const lockProblem = lockMismatch(surface, node.locked, want, TIER_OF[role]);
              if (lockProblem) {
                webSame.push(`${surface.name} (веб, ${role}, «${node.key}»): ${lockProblem}`);
              }
            }
          }
          continue;
        }
        if (plant) continue;
        const nodes = await readNodes(webContexts.guest!, base, surface);
        for (const node of nodes) {
          const requirement: AccessRequirement = LEVELS.includes(node.key)
            ? levelRequirement(surface.name.includes("рассказ") ? "stories" : surface.name.includes("игры") ? "wordGames" : "flashcards", node.key)
            : "free";
          const legacy = accessMarkFor(requirement, "free");
          // Полоса уровней словаря печатает сорт и в вебе — так было и до
          // правки (7.195), и это её единственное отличие от `accessMarkFor`.
          const allowed = new Set<string | null>([legacy, null]);
          if (surface.name.startsWith("словарь — полоса")) allowed.add(sortSign(requirement)?.mark ?? null);
          if (!allowed.has(node.mark)) {
            webLegacy.push(`${surface.name} (веб, «${node.key}»): знак ${node.mark}, прежнее правило даёт ${legacy}`);
          }
        }
      }
      problemsBySurface.set("ВЕБ: словарь говорит то же, что оболочка (долг 257)", webSame);
      if (!plant) problemsBySurface.set("ВЕБ: остальные поверхности не тронуты", webLegacy);
    }

    /**
     * ЧЕТВЁРТОЕ НАПРАВЛЕНИЕ — ПЛИТКИ ПАЗЛОВ. См. шапку `readGameTiles`.
     */
    {
      const mirror: string[] = [];
      const premiumFree: string[] = [];
      let tilesSeen = 0;
      let premiumCrowns = 0;
      for (const role of ["guest", "standard", "premium"] as Role[]) {
        const shellTiles = await readGameTiles(contexts[role]!, base);
        const webRaw = await readGameTiles(webContexts[role]!, base);
        const webTiles = plant
          ? plantTiles(webRaw, role === "premium" ? "extra-lock" : "missing-lock")
          : webRaw;
        tilesSeen += shellTiles.length;
        const floor = ci ? 1 : 100;
        if (shellTiles.length < floor || webTiles.length !== shellTiles.length) {
          mirror.push(
            `игры (${role}): плиток в оболочке ${shellTiles.length}, в браузере ${webTiles.length} ` +
              `при ожидаемых минимум ${floor} — экран не собрался, и «расхождений 0» здесь ничего не значит`,
          );
          continue;
        }
        const a = shellTiles.map(tileSign);
        const b = webTiles.map(tileSign);
        for (let i = 0; i < a.length; i += 1) {
          if (a[i] !== b[i]) {
            mirror.push(
              `игры (${role}): оболочка «${a[i]}», браузер «${b[i]}» — ` +
                `браузер и оболочка обязаны говорить одно`,
            );
          }
        }
        if (role === "premium") {
          premiumCrowns = shellTiles.filter((t) => t.mark === "premium-tier").length;
          for (const [place, tiles] of [["приложение", shellTiles], ["браузер", webTiles]] as const) {
            for (const t of tiles) {
              if (t.locked || t.mark === "subscription") {
                premiumFree.push(`Premium, ${place}: на плитке ${t.key} стоит замок — он платит именно за это`);
              }
            }
          }
        }
      }
      /**
       * ПОЛ У ВТОРОГО УТВЕРЖДЕНИЯ. «У Premium замков 0» обязано быть
       * доказано НЕПУСТЫМ экраном: если корон у него нет ни одной, знака
       * на экране нет вовсе, и утверждение доказано отсутствием экрана.
       */
      if (premiumCrowns < 1) {
        premiumFree.push(
          `Premium: корон на плитках ${premiumCrowns} — «замков 0» доказано пустым экраном, а это не доказательство`,
        );
      }
      problemsBySurface.set("ИГРЫ: браузер говорит то же, что оболочка", mirror);
      problemsBySurface.set("ИГРЫ: у Premium замков нет нигде", premiumFree);
      if (!plant) {
        console.log(
          `  игры: плиток просмотрено ${tilesSeen} (три роли × два места), корон у Premium ${premiumCrowns}`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  if (plant) {
    let ok = true;
    for (const [name, problems] of problemsBySurface) {
      const caught = problems.length > 0;
      console.log(`  ${caught ? "поймано" : "ПРОПУЩЕНО"} — ${name}${caught ? ` (${problems.length})` : ""}`);
      if (!caught) ok = false;
    }
    console.log(
      ok
        ? `check:access-signs --plant — подсадка «замок вместо короны и наоборот» роняет ВСЕ ${problemsBySurface.size} поверхностей`
        : "check:access-signs --plant — FAILED: поверхность, на которой подсадка не срабатывает, прибором не судится вовсе",
    );
    return ok ? 0 : 1;
  }

  const all = [...problemsBySurface.values()].flat();
  if (all.length) {
    console.error("ЗНАК НА ЭКРАНЕ РАСХОДИТСЯ С ПРАВИЛОМ:");
    for (const p of all.slice(0, 40)) console.error(`  ${p}`);
    if (all.length > 40) console.error(`  … и ещё ${all.length - 40}`);
    return 1;
  }
  console.log(
    `check:access-signs — поверхностей ${SURFACES.length}, узлов ${nodesSeen}, знаков ${signsSeen}: ` +
      `расхождений с правилом 0.`,
  );
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
