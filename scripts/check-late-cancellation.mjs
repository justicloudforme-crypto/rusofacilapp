// ПОЗДНЯЯ ОТМЕНА НЕ ОЖИВЛЯЕТ ИСТЁКШУЮ ПОДПИСКУ — ДОЛГ 380, заход 7.266.
//
// ЧТО СТОРОЖИТСЯ. Возврат peterelin27 14.10.2026 пришёл от RevenueCat
// тремя событиями: CANCELLATION 02:05:09 → EXPIRATION 02:05:10 →
// CANCELLATION 02:08:13. Ветка CANCELLATION писала `status: "active"`
// всегда, и поздняя отмена вернула колонке `active` строке с истёкшим
// периодом (в боевой базе так лежали 5 из 14 строк магазина). Доступ это
// не открывало (его решает дата), но колонка врала любому счёту «платящих».
//
// ПОЧЕМУ ПОВЕДЕНИЕ, А НЕ ТЕКСТ. Сторож собирает НАСТОЯЩИЙ исходник вебхука
// (`src/app/api/webhooks/revenuecat/route.ts`) через esbuild, подменяет
// только базу (строки в памяти), кеш, Sentry и `next/server`, и проигрывает
// цепочки событий целиком. Судит итоговую строку и то, что по ней покажут
// настоящие `getDisplayStatus` / `isSubscriptionActive`.
//
// ДВЕ СТОРОНЫ. Сценарии, где отмена НЕ должна оживлять (возврат 14.10,
// песочница EXPIRATION → CANCELLATION, возврат одним CANCELLATION, отзыв
// и поздняя отмена с датой в будущем), и сценарии, которые правка обязана
// не сломать (обычная отмена — «Cancelada, acceso hasta…», UNCANCELLATION,
// RENEWAL после истечения, TRANSFER между учётками).
//
//   node scripts/check-late-cancellation.mjs                 # текущий исходник
//   node scripts/check-late-cancellation.mjs --source=<файл> # другой исходник (до/после)
//   node scripts/check-late-cancellation.mjs --plant         # контроль: подсадки + пустая выборка
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const ROOT = process.cwd();
const WEBHOOK = "src/app/api/webhooks/revenuecat/route.ts";
const SECRET = "rc_guard_secret";

const STUBS = {
  "@/lib/db": "export const db = new Proxy({}, { get: (_, key) => globalThis.__rfLateCancelDb[key] });",
  "@/lib/subscription": "export async function invalidateSubscriptionCache() {}",
  "@sentry/nextjs": "export function captureException() {}",
  "next/server":
    "export const NextResponse = { json: (body, init) => ({ status: (init && init.status) || 200, body }) };",
};

/** Собирает исходник вебхука (и правила статуса) в один модуль и грузит его. */
async function loadRoute(source) {
  const dir = mkdtempSync(join(tmpdir(), "rf-late-cancel-"));
  try {
    const entry = `export { POST } from "virtual:webhook";\nexport { getDisplayStatus, isSubscriptionActive } from "@/lib/subscription-status";\n`;
    const result = await build({
      stdin: { contents: entry, resolveDir: ROOT, loader: "ts" },
      bundle: true,
      format: "esm",
      platform: "node",
      write: false,
      logLevel: "silent",
      plugins: [
        {
          name: "rf-stubs",
          setup(b) {
            b.onResolve({ filter: /^virtual:webhook$/ }, () => ({ path: "webhook", namespace: "rf-webhook" }));
            b.onLoad({ filter: /.*/, namespace: "rf-webhook" }, () => ({
              contents: source,
              loader: "ts",
              resolveDir: resolve(ROOT, "src/app/api/webhooks/revenuecat"),
            }));
            b.onResolve({ filter: /^(@\/lib\/db|@\/lib\/subscription|@sentry\/nextjs|next\/server)$/ }, (a) => ({
              path: a.path,
              namespace: "rf-stub",
            }));
            b.onLoad({ filter: /.*/, namespace: "rf-stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
            b.onResolve({ filter: /^@\// }, async (a) => {
              const r = await b.resolve("./" + a.path.slice(2), { resolveDir: resolve(ROOT, "src"), kind: a.kind });
              return { path: r.path };
            });
          },
        },
      ],
    });
    const file = join(dir, "route.mjs");
    writeFileSync(file, result.outputFiles[0].text);
    return await import(pathToFileURL(file).href + `?t=${Date.now()}${Math.random()}`);
  } finally {
    // модуль уже в памяти; файл больше не нужен
    setTimeout(() => rmSync(dir, { recursive: true, force: true }), 0);
  }
}

/** База в памяти: ровно те вызовы, что делает вебхук. */
function fakeDb(users) {
  const rows = [];
  const events = new Set();
  const match = (row, where) =>
    Object.entries(where).every(([key, want]) => {
      if (want && typeof want === "object" && "not" in want) return row[key] !== want.not;
      if (want && typeof want === "object" && "in" in want) return want.in.includes(row[key]);
      return row[key] === want;
    });
  return {
    rows,
    subscription: {
      findUnique: async ({ where }) => rows.find((r) => match(r, where)) ?? null,
      upsert: async ({ where, update, create }) => {
        const row = rows.find((r) => match(r, where));
        if (row) Object.assign(row, update, { updatedAt: new Date() });
        else rows.push({ ...create, updatedAt: new Date() });
      },
      updateMany: async ({ where, data }) => {
        const hit = rows.filter((r) => match(r, where));
        for (const r of hit) Object.assign(r, data, { updatedAt: new Date() });
        return { count: hit.length };
      },
    },
    user: { findUnique: async ({ where }) => (users.includes(where.id) ? { id: where.id } : null) },
    revenueCatEvent: {
      findUnique: async ({ where }) => (events.has(where.id) ? { id: where.id } : null),
      create: async ({ data }) => {
        if (events.has(data.id)) throw new Error("duplicate");
        events.add(data.id);
      },
    },
  };
}

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function ev(type, at, extra = {}) {
  return {
    id: `${type}-${at}-${Math.random()}`,
    type,
    app_user_id: "u_a",
    original_transaction_id: "GPA.guard-0001",
    product_id: "standard:monthly",
    store: "PLAY_STORE",
    environment: "PRODUCTION",
    event_timestamp_ms: at,
    ...extra,
  };
}

/** Каждая цепочка — события по порядку и что обязано получиться. */
export function scenarios(now = Date.now()) {
  const revoked = now - 4 * MIN; // как 02:04:36 при поздней отмене в 02:08
  const paidUntil = now + 29 * DAY;
  return [
    {
      name: "возврат 14.10: CANCELLATION → EXPIRATION → поздний CANCELLATION",
      side: "не оживлять",
      events: [
        ev("INITIAL_PURCHASE", now - 6 * 60 * MIN, { expiration_at_ms: paidUntil }),
        ev("CANCELLATION", now - 3 * MIN, { expiration_at_ms: revoked }),
        ev("EXPIRATION", now - 3 * MIN + 1257, { expiration_at_ms: revoked }),
        ev("CANCELLATION", now, { expiration_at_ms: revoked }),
      ],
      want: { status: "canceled", access: false, display: "expired" },
    },
    {
      name: "песочница: EXPIRATION, затем CANCELLATION",
      side: "не оживлять",
      events: [
        ev("INITIAL_PURCHASE", now - 10 * MIN, { expiration_at_ms: now - 5 * MIN, environment: "SANDBOX" }),
        ev("EXPIRATION", now - 4 * MIN, { expiration_at_ms: now - 5 * MIN, environment: "SANDBOX" }),
        ev("CANCELLATION", now - MIN, { expiration_at_ms: now - 5 * MIN, environment: "SANDBOX" }),
      ],
      want: { status: "canceled", access: false, display: "expired" },
    },
    {
      name: "возврат с «Remove entitlement» одним CANCELLATION (дата окончания уже прошла)",
      side: "не оживлять",
      events: [
        ev("INITIAL_PURCHASE", now - DAY, { expiration_at_ms: paidUntil }),
        ev("CANCELLATION", now, { expiration_at_ms: now - 30_000 }),
      ],
      want: { status: "canceled", access: false, display: "expired" },
    },
    {
      name: "закрыто EXPIRATION, затем отмена с датой в будущем",
      side: "не оживлять",
      events: [
        ev("INITIAL_PURCHASE", now - DAY, { expiration_at_ms: paidUntil }),
        ev("EXPIRATION", now - MIN, { expiration_at_ms: paidUntil }),
        ev("CANCELLATION", now, { expiration_at_ms: paidUntil }),
      ],
      want: { status: "canceled", access: false },
    },
    {
      name: "обычная отмена активной подписки — «Cancelada, acceso hasta el final del periodo pagado»",
      side: "не сломать",
      events: [
        ev("INITIAL_PURCHASE", now - DAY, { expiration_at_ms: paidUntil }),
        ev("CANCELLATION", now, { expiration_at_ms: paidUntil }),
      ],
      want: { status: "active", access: true, display: "canceling" },
    },
    {
      name: "UNCANCELLATION после отмены",
      side: "не сломать",
      events: [
        ev("INITIAL_PURCHASE", now - DAY, { expiration_at_ms: paidUntil }),
        ev("CANCELLATION", now - MIN, { expiration_at_ms: paidUntil }),
        ev("UNCANCELLATION", now, { expiration_at_ms: paidUntil }),
      ],
      want: { status: "active", access: true, display: "active" },
    },
    {
      name: "RENEWAL после EXPIRATION",
      side: "не сломать",
      events: [
        ev("INITIAL_PURCHASE", now - 40 * DAY, { expiration_at_ms: now - 10 * DAY }),
        ev("EXPIRATION", now - 10 * DAY, { expiration_at_ms: now - 10 * DAY }),
        ev("RENEWAL", now, { expiration_at_ms: paidUntil }),
      ],
      want: { status: "active", access: true, display: "active" },
    },
    {
      name: "TRANSFER между учётками сайта",
      side: "не сломать",
      events: [
        ev("INITIAL_PURCHASE", now - DAY, { expiration_at_ms: paidUntil }),
        ev("TRANSFER", now, { transferred_from: ["u_a"], transferred_to: ["u_b"], original_transaction_id: null }),
      ],
      want: { status: "active", access: true, display: "active", userId: "u_b" },
    },
  ];
}

/** Проигрывает все цепочки на исходнике; возвращает число сличений и нарушения. */
export async function judge(source, list = scenarios()) {
  const mod = await loadRoute(source);
  const problems = [];
  let compared = 0;
  const savedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  try {
    for (const s of list) {
      const db = fakeDb(["u_a", "u_b"]);
      globalThis.__rfLateCancelDb = db;
      for (const event of s.events) {
        const res = await mod.POST({
          headers: { get: (k) => (k.toLowerCase() === "authorization" ? `Bearer ${SECRET}` : null) },
          json: async () => ({ event }),
        });
        if (res.status !== 200) problems.push(`${s.name}: ${event.type} → ответ ${res.status}`);
      }
      if (db.rows.length !== 1) {
        problems.push(`${s.name}: строк ${db.rows.length}, ждали 1`);
        continue;
      }
      const row = db.rows[0];
      const got = {
        status: row.status,
        access: mod.isSubscriptionActive(row),
        display: mod.getDisplayStatus(row),
        userId: row.userId,
      };
      for (const [key, want] of Object.entries(s.want)) {
        compared++;
        if (got[key] !== want) problems.push(`[${s.side}] ${s.name}: ${key} = ${got[key]}, ждали ${want}`);
      }
    }
  } finally {
    process.env.REVENUECAT_WEBHOOK_SECRET = savedSecret;
    delete globalThis.__rfLateCancelDb;
  }
  // Пустая выборка — не результат (ПРАВИЛА ЗАМЕРА 4.1): «0 нарушений на 0 сличений» обязано падать.
  if (compared === 0) problems.push("сличений 0 — выборка пуста, сравнивать нечего");
  return { compared, problems };
}

async function main() {
  const args = process.argv.slice(2);
  const sourceArg = args.find((a) => a.startsWith("--source="))?.slice("--source=".length);
  const source = readFileSync(sourceArg ?? WEBHOOK, "utf8");

  if (!args.includes("--plant")) {
    const { compared, problems } = await judge(source);
    if (problems.length) {
      console.error(`check:late-cancellation — НАРУШЕНИЙ ${problems.length} (сличений ${compared}):`);
      for (const p of problems) console.error(`  ${p}`);
      process.exit(1);
    }
    console.log(
      `check:late-cancellation — ${scenarios().length} цепочек, ${compared} сличений, нарушений 0: ` +
        `поздняя отмена не оживляет истёкшую строку, обычная отмена / UNCANCELLATION / RENEWAL / TRANSFER целы.`,
    );
    return;
  }

  // КОНТРОЛЬ. Отрицательный — здоровый исходник молчит; подсадки обязаны быть пойманы.
  let ok = true;
  const clean = await judge(source);
  ok &&= clean.problems.length === 0;
  console.log(`  ${clean.problems.length === 0 ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — текущий вебхук (${clean.compared} сличений)`);
  const plants = [
    ["отмена снова пишет то, что пришло (поведение до 7.266)", source.replaceAll("status: writtenStatus", "status")],
    ["забыта прошедшая дата окончания", source.replace("|| periodEnd.getTime() <= Date.now()", "")],
    ["забыта уже закрытая EXPIRATION строка", source.replace('existing?.status === "canceled" ||', "")],
    ["перегиб: любая отмена закрывает строку", source.replace('intent === "canceled" &&', 'intent === "canceled" || ')],
  ];
  for (const [name, planted] of plants) {
    if (planted === source) {
      ok = false;
      console.log(`  ПОДСАДКА НЕ ПРИЛОЖИЛАСЬ — ${name}: исходник и сторож разошлись`);
      continue;
    }
    const found = await judge(planted);
    if (found.problems.length === 0) ok = false;
    console.log(`  ${found.problems.length ? "поймано" : "ПРОПУЩЕНО"} — ${name}${found.problems.length ? ` (${found.problems[0]})` : ""}`);
  }
  const empty = await judge(source, []);
  if (empty.problems.length === 0) ok = false;
  console.log(`  ${empty.problems.length ? "поймано" : "ПРОПУЩЕНО"} — пустая выборка (0 цепочек) не сходит за «0 нарушений»`);
  console.log(
    ok
      ? `check:late-cancellation --plant — ${plants.length + 1} из ${plants.length + 1} подсадок, 1 из 1 отрицательного контроля`
      : "check:late-cancellation --plant — FAILED",
  );
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
