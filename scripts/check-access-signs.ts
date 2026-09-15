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
 * Третье направление — ВЕБ НЕ ТРОНУТ: те же адреса открываются БЕЗ
 * признака оболочки, и там знак обязан совпасть со старым `accessMarkFor`.
 *
 *   npx tsx scripts/check-access-signs.ts --base=http://localhost:3123
 *   npx tsx scripts/check-access-signs.ts --base=… --plant
 */
import { chromium, type BrowserContext } from "playwright";
import {
  accessMarkFor,
  accessSignFor,
  levelRequirement,
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

type Role = "guest" | "free" | "premium";
const TIER_OF: Record<Role, ViewerTier> = { guest: "free", free: "free", premium: "premium" };

/** Что должно стоять на узле. `null` — знака быть не должно. */
type Expected = AccessSign | null;

/**
 * ПОДМЕНЁННОЕ ПРАВИЛО — то самое «замок вместо короны и наоборот».
 * Живёт здесь, а не в продуктовом коде, и используется ТОЛЬКО в `--plant`.
 */
function swapped(sign: Expected): Expected {
  if (!sign) return { mark: "subscription", labelKey: "subscriptionBadge" };
  return sign.mark === "premium-tier"
    ? { mark: "subscription", labelKey: "subscriptionBadge" }
    : { mark: "premium-tier", labelKey: "premiumTierBadge" };
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
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

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
): Promise<Array<{ key: string; text: string; mark: string | null; uppercase: boolean; label: string }>> {
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
        const key = (el.getAttribute("data-level") ?? el.textContent ?? "").trim().split(/\s+/)[0] ?? "";
        return {
          key,
          text: (el.textContent ?? "").trim(),
          mark: badge?.getAttribute("data-access-mark") ?? null,
          uppercase: badge ? /uppercase/.test(badge.className) : false,
          label: (badge?.getAttribute("title") ?? badge?.textContent ?? "").trim(),
        };
      }),
    );
  } finally {
    await page.close().catch(() => {});
  }
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
    const contexts: Partial<Record<Role, BrowserContext>> = {};
    for (const role of ["guest", "premium"] as Role[]) {
      const ctx = await browser.newContext({
        userAgent: `${SAFARI} ${TOKEN}`,
        viewport: { width: 360, height: 720 },
      });
      await ctx.addCookies([
        { name: COOKIE, value: "1", url: base },
        ...(role === "premium" ? premiumCookies : []),
      ]);
      contexts[role] = ctx;
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
          if (node.uppercase) problems.push(`${surface.name} (${role}, «${node.key}»): на знаке стоит uppercase`);
        }
      }
      problemsBySurface.set(surface.name, problems);
    }

    // ТРЕТЬЕ НАПРАВЛЕНИЕ: в вебе ответ прежний. Открываем те же адреса без
    // признака оболочки и сверяем со СТАРЫМ правилом.
    if (!plant) {
      const web = await browser.newContext({ viewport: { width: 360, height: 720 } });
      const webProblems: string[] = [];
      for (const surface of SURFACES) {
        const nodes = await readNodes(web, base, surface);
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
            webProblems.push(`${surface.name} (веб, «${node.key}»): знак ${node.mark}, прежнее правило даёт ${legacy}`);
          }
        }
      }
      await web.close();
      problemsBySurface.set("ВЕБ не тронут", webProblems);
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
