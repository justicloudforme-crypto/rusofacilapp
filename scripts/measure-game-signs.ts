/**
 * ЗНАКИ НА ПЛИТКАХ ИГР — ПЕРЕПИСЬ ПО 12 ЭКРАНАМ.
 *
 * Три роли (гость/бесплатный, доступ по коду, Premium) × две локали ×
 * оболочка/браузер. Считает отрисованные знаки, а не правило: корон
 * (`data-access-mark="premium-tier"`), замков (`data-access-mark=
 * "subscription"` плюс `data-access-locked`), и сумму.
 *
 * Прибор замера, а не сторож: он ничего не утверждает и всегда зелёный.
 * Утверждает `check:access-signs`.
 *
 *   npx tsx scripts/measure-game-signs.ts --base=http://localhost:3124
 */
import { chromium, type BrowserContext } from "playwright";
import { isEntryPoint } from "../src/lib/entry-point";

const TOKEN = "RFNativeShell";
const COOKIE = "rf_native_shell";
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type Role = "free" | "standard" | "premium";
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];

async function session(base: string, plan: "e2e-test" | "lifetime") {
  const email = `games-${process.pid}-${plan}-${Math.floor(process.hrtime()[1] / 1000)}@example.test`;
  const registered = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": SAFARI },
    body: new URLSearchParams({ email, password: "TestPass123!", lang: "ru", redirectTo: "/ru" }).toString(),
  });
  const cookies = registered.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("="));
  if (!cookies.length) throw new Error(`register -> ${registered.status}, куки нет`);
  const granted = await fetch(`${base}/api/test/grant-subscription`, {
    method: "POST",
    headers: { cookie: cookies.join("; "), "content-type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!granted.ok) throw new Error(`grant -> ${granted.status}`);
  return cookies.map((c) => { const [n, ...r] = c.split("="); return { name: n, value: r.join("="), url: base }; });
}

async function countOn(ctx: BrowserContext, base: string, lang: string) {
  const page = await ctx.newPage();
  const totals = { crowns: 0, locks: 0, tiles: 0, levelCrowns: 0, levelLocks: 0 };
  try {
    await page.goto(`${base}/${lang}/word-games`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("[data-testid=word-game-level-filter] button", { timeout: 30_000 });
    for (const level of LEVELS) {
      await page.click(`[data-testid=word-game-level-filter] button:has-text("${level}")`);
      await page.waitForTimeout(400);
      const got = await page.evaluate(() => {
        const tiles = [...document.querySelectorAll("a[href*='/word-games/']")].filter((a) =>
          /\/word-games\/[A-Z_]+\/[A-Z0-9]+\/\d+$/.test(a.getAttribute("href") ?? ""),
        );
        let crowns = 0, locks = 0;
        for (const t of tiles) {
          if (t.querySelector('[data-access-mark="premium-tier"]')) crowns += 1;
          if (t.querySelector('[data-access-mark="subscription"]')) locks += 1;
          if (t.querySelector("[data-access-locked]")) locks += 1;
        }
        const strip = document.querySelector("[data-testid=word-game-level-filter]");
        const lc = strip ? strip.querySelectorAll('[data-access-mark="premium-tier"]').length : 0;
        const ll = strip ? strip.querySelectorAll('[data-access-mark="subscription"]').length : 0;
        return { crowns, locks, tiles: tiles.length, lc, ll };
      });
      totals.crowns += got.crowns;
      totals.locks += got.locks;
      totals.tiles += got.tiles;
      totals.levelCrowns = got.lc;
      totals.levelLocks = got.ll;
    }
  } finally {
    await page.close().catch(() => {});
  }
  return totals;
}

export async function main(): Promise<number> {
  const base = (process.argv.find((a) => a.startsWith("--base=")) ?? "").slice("--base=".length);
  if (!base) { console.error("нужен --base=http://…"); return 1; }
  const browser = await chromium.launch();
  try {
    const std = await session(base, "e2e-test");
    const prem = await session(base, "lifetime");
    const cookiesOf: Record<Role, { name: string; value: string; url: string }[]> = { free: [], standard: std, premium: prem };
    console.log("| роль | место | локаль | плиток | корон | замков | сумма знаков |");
    console.log("|---|---|---|---|---|---|---|");
    for (const role of ["free", "standard", "premium"] as Role[]) {
      for (const shell of [true, false]) {
        for (const lang of ["ru", "es"]) {
          const ctx = await browser.newContext({
            userAgent: shell ? `${SAFARI} ${TOKEN}` : SAFARI,
            viewport: { width: 384, height: 800 },
          });
          await ctx.addCookies([...(shell ? [{ name: COOKIE, value: "1", url: base }] : []), ...cookiesOf[role]]);
          const t = await countOn(ctx, base, lang);
          console.log(
            `| ${role} | ${shell ? "приложение" : "браузер"} | /${lang} | ${t.tiles} | ${t.crowns} | ${t.locks} | ${t.crowns + t.locks} |`,
          );
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  main().then((c) => { process.exitCode = c; }).catch((e) => { console.error(e); process.exitCode = 1; });
}
