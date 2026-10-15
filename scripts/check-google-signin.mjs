// ВХОД ЧЕРЕЗ GOOGLE: ТА ЖЕ УЧЁТКА, НЕ ВТОРАЯ — заход 7.267.
//
// ЧТО СТОРОЖИТСЯ.
//   * Google подтвердил адрес, и он у нас есть → вход в СУЩЕСТВУЮЩУЮ учётку
//     (иначе раздвоятся прогресс и покупки: RevenueCat привязан к User.id);
//     регистр, пробелы и точки Gmail второй учётки не делают;
//   * неподтверждённый адрес Google — отказ, учётка не открывается и не
//     создаётся;
//   * токен с чужим `aud`, истёкший, с чужой подписью, с чужим nonce,
//     с подложенным state — отказ;
//   * регистрация паролем: «Foo@Gmail.com» при «foo@gmail.com» — не вторая
//     учётка; учётку без пароля (Google) регистрация не присваивает;
//   * флаг выключен (нет GOOGLE_CLIENT_ID/SECRET) — все четыре маршрута 404;
//     веб-вход из приложения — 404;
//   * долг 381 (7.268, вариант «а»): ПЕРВЫЙ вход через Google в учётку с
//     паролем снимает пароль, гасит прочие сессии (`sessionVersion + 1`,
//     сессия этого входа — с новой версией) и шлёт письмо — и в вебе, и в
//     приложении; повторный вход (`googleLinkedAt` заполнен) не меняет
//     ничего; учётку без пароля не сбрасывает; учётку, привязанную до
//     7.268 (владельца), не сбрасывает; письмо не ушло — вход всё равно
//     успешен, неудача в Sentry.
//
// ПОЧЕМУ ПОВЕДЕНИЕ, А НЕ ТЕКСТ. Собираются НАСТОЯЩИЕ маршруты
// (`src/app/api/auth/register`, `…/google/[step]` с обработчиками
// `src/lib/google-auth/handlers.ts`: start, callback, nonce, native)
// через esbuild. Подменены только база (строки в памяти по правилам SQLite:
// `=` и UNIQUE — с учётом регистра, LIKE — без, ASCII), выдача сессии
// (записывается, кому её дали), признак оболочки, ограничитель частоты и
// сеть (ключи Google и обмен кода — свой RSA-ключ). Проверка подписи,
// aud/срок/nonce, выбор учётки, кука state — настоящие.
//
//   node scripts/check-google-signin.mjs          # текущий исходник: 0 нарушений
//   node scripts/check-google-signin.mjs --plant  # контроль: подсадки ловятся, пустая выборка — красный
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const ROOT = process.cwd();
const CLIENT_ID = "guard-web.apps.googleusercontent.com";
const CLIENT_SECRET = "guard-secret";
const ORIGIN = "https://rusofacilapp.com";

const STUBS = {
  "server-only": "export {};",
  "@/lib/db": "export const db = new Proxy({}, { get: (_, key) => globalThis.__rfG.db[key] });",
  "@/lib/auth":
    "export async function createSession(userId, version) { globalThis.__rfG.sessions.push({ userId, version }); }",
  "@/lib/native-shell":
    "export async function isNativeShellRequest() { return globalThis.__rfG.inApp; }\n" +
    "export async function nativeShellVersionOfRequest() { return globalThis.__rfG.inApp ? 17 : null; }",
  "@/lib/rate-limit":
    "export function getRateLimiter() { return { check: async () => false }; }\nexport function requestIp() { return '203.0.113.1'; }",
  "@/lib/referral": "export async function captureReferralOnRegister() {}",
  "@sentry/nextjs":
    "export function captureException(e) { globalThis.__rfG.sentry.push(String(e?.message ?? e)); }\n" +
    "export function captureMessage(m) { globalThis.__rfG.sentry.push(String(m)); }",
  "@/lib/email": `
    export async function sendEmail(mail) {
      const mode = globalThis.__rfG.mailMode;
      if (mode === "throw") throw new Error("guard: resend unreachable");
      if (mode === "fail") return false;
      globalThis.__rfG.mails.push(mail);
      return true;
    }`,
  "next/server": `
    class Jar { constructor() { this.map = {}; } set(name, value, opts) { this.map[name] = { value, opts }; } get(name) { return this.map[name]; } }
    export class NextResponse {
      constructor(body, init = {}) { this.status = init.status ?? 200; this.body = body; this.headers = new Map(); this.cookies = new Jar(); }
      static redirect(url, init = {}) { const r = new NextResponse(null, { status: typeof init === "number" ? init : init.status ?? 307 }); r.location = String(url); return r; }
      static json(body, init = {}) { return new NextResponse(body, init); }
    }`,
};

const ENTRY = `
export { POST as register } from "@/app/api/auth/register/route";
import { GET, POST } from "@/app/api/auth/google/[step]/route";
const step = (handler, name) => (req) => handler(req, { params: Promise.resolve({ step: name }) });
export const start = step(GET, "start");
export const callback = step(GET, "callback");
export const nonce = step(POST, "nonce");
export const native = step(POST, "native");
export { makeTestSigner, googleClaims } from "@/lib/google-auth/test-tokens";
export { mailboxKey } from "@/lib/google-auth/account";
`;

/** Собирает настоящие маршруты в один модуль; `overrides` — подменённые исходники (подсадки). */
async function loadRoutes(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "rf-google-guard-"));
  const absOverrides = Object.fromEntries(Object.entries(overrides).map(([rel, text]) => [resolve(ROOT, rel), text]));
  try {
    const result = await build({
      stdin: { contents: ENTRY, resolveDir: ROOT, loader: "ts" },
      bundle: true,
      format: "esm",
      platform: "node",
      write: false,
      logLevel: "silent",
      plugins: [
        {
          name: "rf-stubs",
          setup(b) {
            const stubbed = new RegExp(`^(${Object.keys(STUBS).map((k) => k.replace(/[/@.-]/g, "\\$&")).join("|")})$`);
            b.onResolve({ filter: stubbed }, (a) => ({ path: a.path, namespace: "rf-stub" }));
            b.onLoad({ filter: /.*/, namespace: "rf-stub" }, (a) => ({ contents: STUBS[a.path], loader: "js" }));
            b.onResolve({ filter: /^@\// }, async (a) => {
              const r = await b.resolve("./" + a.path.slice(2), { resolveDir: resolve(ROOT, "src"), kind: a.kind });
              return { path: r.path };
            });
            b.onLoad({ filter: /\.tsx?$/ }, (a) =>
              absOverrides[a.path] !== undefined ? { contents: absOverrides[a.path], loader: "ts" } : undefined
            );
          },
        },
      ],
    });
    const file = join(dir, "routes.mjs");
    writeFileSync(file, result.outputFiles[0].text);
    return await import(pathToFileURL(file).href + `?t=${Date.now()}${Math.random()}`);
  } finally {
    setTimeout(() => rmSync(dir, { recursive: true, force: true }), 0);
  }
}

/** База как SQLite: ровно те вызовы, что делают маршруты. */
function fakeDb(seed) {
  const rows = seed.map((r, i) => ({ id: `seed${i}`, sessionVersion: 0, passwordHash: null, googleLinkedAt: null, ...r }));
  let next = 0;
  const pick = (row, select) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : { ...row });
  return {
    rows,
    user: {
      findUnique: async ({ where, select }) => {
        const row = rows.find((r) => (where.id !== undefined ? r.id === where.id : r.email === where.email));
        return row ? pick(row, select) : null;
      },
      findMany: async ({ where, select }) => {
        const suffix = where.email.endsWith.toLowerCase();
        return rows.filter((r) => r.email.toLowerCase().endsWith(suffix)).map((r) => pick(r, select));
      },
      create: async ({ data, select }) => {
        if (rows.some((r) => r.email === data.email)) throw new Error("UNIQUE constraint failed: User.email");
        const row = { id: `new${next++}`, sessionVersion: 0, passwordHash: null, googleLinkedAt: null, ...data };
        rows.push(row);
        return pick(row, select);
      },
      update: async ({ where, data }) => {
        const row = rows.find((r) => r.id === where.id);
        Object.assign(row, data);
        return { ...row };
      },
      // `UPDATE … WHERE id = ? AND googleLinkedAt IS NULL` (7.268).
      updateMany: async ({ where, data }) => {
        const hit = rows.filter((r) => r.id === where.id && (!("googleLinkedAt" in where) || r.googleLinkedAt === where.googleLinkedAt));
        for (const row of hit) {
          for (const [key, value] of Object.entries(data)) {
            row[key] = value && typeof value === "object" && "increment" in value ? row[key] + value.increment : value;
          }
        }
        return { count: hit.length };
      },
    },
    // Пакетная транзакция Prisma: запросы уже запущены по порядку.
    $transaction: async (queries) => Promise.all(queries),
  };
}

function request(url, { method = "GET", headers = {}, body, cookies = {} } = {}) {
  const r = new Request(url, { method, headers, body });
  r.cookies = { get: (name) => (cookies[name] !== undefined ? { value: cookies[name] } : undefined) };
  return r;
}

/** Сеть Google: ключи — свои, обмен кода отдаёт заранее подписанный токен. */
function installFetch(signer, tokenFor) {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://www.googleapis.com/oauth2/v3/certs")) {
      return new Response(JSON.stringify({ keys: signer.jwks }), { headers: { "cache-control": "max-age=0" } });
    }
    if (url === "https://oauth2.googleapis.com/token") {
      const form = new URLSearchParams(String(init?.body ?? ""));
      if (form.get("client_secret") !== CLIENT_SECRET || !form.get("code_verifier")) {
        return new Response(JSON.stringify({ error: "invalid_client" }), { status: 401 });
      }
      return new Response(JSON.stringify({ id_token: tokenFor() }));
    }
    throw new Error(`guard: unexpected fetch ${url}`);
  };
}

async function webSignIn(routes, signer, claims, opts = {}) {
  const started = await routes.start(request(`${ORIGIN}/api/auth/google/start?lang=es&redirectTo=%2Fes%2Fprofile`));
  if (started.status === 404) return { status: 404 };
  const google = new URL(started.location);
  const sealed = started.cookies.get("rf_google_flow")?.value;
  const nonce = google.searchParams.get("nonce");
  const state = opts.state ?? google.searchParams.get("state");
  installFetch(signer, () => (opts.signWith ?? signer).sign(routes.googleClaims({ aud: CLIENT_ID, nonce, ...claims })));
  const back = await routes.callback(
    request(`${ORIGIN}/api/auth/google/callback?code=c0de&state=${encodeURIComponent(state)}`, { cookies: { rf_google_flow: sealed } })
  );
  return { status: back.status, location: back.location };
}

async function nativeSignIn(routes, signer, claims, opts = {}) {
  installFetch(signer, () => "");
  const issued = await routes.nonce(request(`${ORIGIN}/api/auth/google/nonce`, { method: "POST" }));
  if (issued.status === 404) return { status: 404 };
  const sealed = issued.cookies.get("rf_google_native")?.value;
  const token = signer.sign(routes.googleClaims({ aud: CLIENT_ID, nonce: opts.nonce ?? issued.body.nonce, ...claims }));
  const res = await routes.native(
    request(`${ORIGIN}/api/auth/google/native`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: token, lang: "es", redirectTo: "/es/profile" }),
      cookies: { rf_google_native: sealed },
    })
  );
  return { status: res.status, error: res.body?.error };
}

async function registerWith(routes, email) {
  const form = new URLSearchParams({ email, password: "correct horse 1", lang: "es", redirectTo: "/es/profile" });
  const res = await routes.register(
    request(`${ORIGIN}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    })
  );
  return { status: res.status, location: res.location };
}

const pw = "$2a$12$guardguardguardguardguOe1v2x9w8Yb3V0o6K4lQmZcF7rTt5u"; // «есть пароль»
const LINKED = new Date("2026-10-20T12:00:00Z"); // привязано раньше этого входа
// Учётка владельца: привязана к Google 15.10.2026, до записи привязки (7.268).
// Адрес и так записан в PROGRESS.md; в коде сайта — только его SHA-256.
const OWNER = "justicloudforme@gmail.com";

/**
 * Долг 381: чего ждать от строки после входа. `reset` — первая привязка
 * учётки с паролем: пароль снят, версия +1, сессия — с новой версией,
 * письмо ровно одно, на адрес учётки. Иначе — пароль и версия как были,
 * писем 0. Отметка привязки после любого успешного входа заполнена.
 */
function linkCheck(id, { reset, version, hadPassword = true, email }) {
  return (db, g) => {
    const problems = [];
    const row = db.rows.find((r) => r.id === id);
    if (!row) return [`строки ${id} нет`];
    const wantVersion = reset ? version + 1 : version;
    if (reset && row.passwordHash) problems.push("пароль НЕ снят при первой привязке");
    if (!reset && hadPassword && row.passwordHash !== pw) problems.push("пароль снят, хотя не должен");
    if (!reset && !hadPassword && row.passwordHash) problems.push("учётке без пароля появился пароль");
    if (row.sessionVersion !== wantVersion) problems.push(`sessionVersion ${row.sessionVersion}, ждали ${wantVersion} (${reset ? "прочие сессии не закрыты" : "сессии закрыты зря"})`);
    const issued = g.sessions.find((s) => s.userId === id);
    if (issued && issued.version !== row.sessionVersion) problems.push(`сессия этого входа с версией ${issued.version}, у строки ${row.sessionVersion} — вход сам себя выкинет`);
    if (!row.googleLinkedAt) problems.push("отметка привязки не поставлена");
    const wantMails = reset && g.mailMode === "ok" ? 1 : 0;
    if (g.mails.length !== wantMails) problems.push(`писем ${g.mails.length}, ждали ${wantMails}`);
    const mail = g.mails[0];
    if (wantMails === 1 && mail) {
      if (mail.to !== email) problems.push(`письмо ушло на ${mail.to}, ждали ${email}`);
      for (const must of ["¿Olvidaste tu contraseña?", "/es/forgot-password", "¿No fuiste tú?", "Continuar con Google"]) {
        if (!mail.html.includes(must)) problems.push(`в письме нет «${must}»`);
      }
    }
    if (g.mailMode !== "ok" && reset && g.sentry.length === 0) problems.push("письмо не ушло, а в Sentry пусто");
    return problems;
  };
}

/**
 * Каждый сценарий: что в базе, что делает человек, что обязано получиться.
 * `session` — id учётки, которой выдана сессия ("new" — новая строка, null — никому).
 */
export function scenarios() {
  return [
    { name: "веб: адрес есть → та же учётка", seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "justi@gmail.com" }), session: "seed0", rows: 1 },
    { name: "веб: «Justi@Gmail.com» при «justi@gmail.com» → та же", seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "Justi@Gmail.com" }), session: "seed0", rows: 1 },
    { name: "веб: Gmail без точки при «j.doe@gmail.com» → та же", seed: [{ email: "j.doe@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "jdoe@gmail.com" }), session: "seed0", rows: 1 },
    { name: "веб: строка не в нижнем регистре «Ana@Example.com» → та же", seed: [{ email: "Ana@Example.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "ana@example.com" }), session: "seed0", rows: 1 },
    { name: "веб: адреса нет → одна новая учётка", seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "nuevo@example.com" }), session: "new", rows: 2 },
    { name: "веб: неподтверждённый адрес → отказ", seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "justi@gmail.com", email_verified: false }), session: null, rows: 1, error: "google_unverified" },
    { name: "веб: неподтверждённый новый адрес → не создаётся", seed: [], act: (r, s) => webSignIn(r, s, { email: "x@example.com", email_verified: false }), session: null, rows: 0, error: "google_unverified" },
    { name: "веб: чужой aud → отказ", seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "justi@gmail.com", aud: "evil.apps.googleusercontent.com" }), session: null, rows: 1, error: "google_failed" },
    { name: "веб: истёкший токен → отказ", seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "justi@gmail.com", exp: Math.floor(Date.now() / 1000) - 600 }), session: null, rows: 1, error: "google_failed" },
    { name: "веб: подпись чужим ключом → отказ", seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "justi@gmail.com" }, { signWith: r.makeTestSigner(s.kid) }), session: null, rows: 1, error: "google_failed" },
    { name: "веб: чужой nonce в токене → отказ", seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "justi@gmail.com", nonce: "stolen" }), session: null, rows: 1, error: "google_failed" },
    { name: "веб: подложенный state → отказ", seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "justi@gmail.com" }, { state: "forged" }), session: null, rows: 1, error: "google_failed" },
    { name: "приложение: адрес есть → та же учётка", inApp: true, seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => nativeSignIn(r, s, { email: "justi@gmail.com" }), session: "seed0", rows: 1 },
    { name: "приложение: «JUSTI@gmail.com» → та же", inApp: true, seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => nativeSignIn(r, s, { email: "JUSTI@gmail.com" }), session: "seed0", rows: 1 },
    { name: "приложение: чужой aud → отказ", inApp: true, seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => nativeSignIn(r, s, { email: "justi@gmail.com", aud: "other-app.apps.googleusercontent.com" }), session: null, rows: 1, error: "google_failed" },
    { name: "приложение: неподтверждённый адрес → отказ", inApp: true, seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => nativeSignIn(r, s, { email: "justi@gmail.com", email_verified: "false" }), session: null, rows: 1, error: "google_unverified" },
    { name: "приложение: токен с чужим nonce (повтор) → отказ", inApp: true, seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => nativeSignIn(r, s, { email: "justi@gmail.com" }, { nonce: "replayed" }), session: null, rows: 1, error: "google_failed" },
    { name: "приложение: веб-вход недоступен (404)", inApp: true, seed: [], act: (r, s) => webSignIn(r, s, { email: "a@example.com" }), session: null, rows: 0, status: 404 },
    { name: "браузер: нативный вход недоступен (404)", seed: [], act: (r, s) => nativeSignIn(r, s, { email: "a@example.com" }), session: null, rows: 0, status: 404 },
    { name: "флаг выключен: веб-вход 404", flagOff: true, seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => webSignIn(r, s, { email: "justi@gmail.com" }), session: null, rows: 1, status: 404 },
    { name: "флаг выключен: вход приложения 404", flagOff: true, inApp: true, seed: [{ email: "justi@gmail.com", passwordHash: pw }], act: (r, s) => nativeSignIn(r, s, { email: "justi@gmail.com" }), session: null, rows: 1, status: 404 },
    { name: "регистрация: «Foo@Gmail.com» при «foo@gmail.com» → не вторая", seed: [{ email: "foo@gmail.com", passwordHash: pw }], act: (r) => registerWith(r, "Foo@Gmail.com"), session: null, rows: 1, error: "email_taken" },
    { name: "регистрация: « FOO@gmail.com » при «foo@gmail.com» → не вторая", seed: [{ email: "foo@gmail.com", passwordHash: pw }], act: (r) => registerWith(r, " FOO@gmail.com "), session: null, rows: 1, error: "email_taken" },
    { name: "регистрация: учётка Google без пароля не присваивается", seed: [{ email: "foo@gmail.com" }], act: (r) => registerWith(r, "foo@gmail.com"), session: null, rows: 1, error: "account_exists_no_password", keepsNoPassword: "seed0" },
    // ——— долг 381 (7.268) ———
    { name: "381 веб: первая привязка учётки с паролем → пароль снят, сессии закрыты, письмо", seed: [{ email: "victima@gmail.com", passwordHash: pw, sessionVersion: 3 }], act: (r, s) => webSignIn(r, s, { email: "victima@gmail.com" }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: true, version: 3, email: "victima@gmail.com" }) },
    { name: "381 приложение: первая привязка учётки с паролем → то же правило", inApp: true, seed: [{ email: "victima@gmail.com", passwordHash: pw, sessionVersion: 3 }], act: (r, s) => nativeSignIn(r, s, { email: "victima@gmail.com" }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: true, version: 3, email: "victima@gmail.com" }) },
    { name: "381 веб: первая привязка по «V.ictima@Gmail.com» → письмо на адрес учётки", seed: [{ email: "victima@gmail.com", passwordHash: pw, sessionVersion: 0 }], act: (r, s) => webSignIn(r, s, { email: "V.ictima@Gmail.com" }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: true, version: 0, email: "victima@gmail.com" }) },
    { name: "381 веб: повторный вход через Google → ничего не меняется", seed: [{ email: "victima@gmail.com", passwordHash: pw, sessionVersion: 3, googleLinkedAt: LINKED }], act: (r, s) => webSignIn(r, s, { email: "victima@gmail.com" }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: false, version: 3 }) },
    { name: "381 приложение: повторный вход → ничего не меняется", inApp: true, seed: [{ email: "victima@gmail.com", passwordHash: pw, sessionVersion: 3, googleLinkedAt: LINKED }], act: (r, s) => nativeSignIn(r, s, { email: "victima@gmail.com" }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: false, version: 3 }) },
    { name: "381 веб: учётка без пароля → ничего не сбрасывается", seed: [{ email: "solo-google@gmail.com", sessionVersion: 2 }], act: (r, s) => webSignIn(r, s, { email: "solo-google@gmail.com" }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: false, version: 2, hadPassword: false }) },
    { name: "381 приложение: учётка без пароля → ничего не сбрасывается", inApp: true, seed: [{ email: "solo-google@gmail.com", sessionVersion: 2 }], act: (r, s) => nativeSignIn(r, s, { email: "solo-google@gmail.com" }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: false, version: 2, hadPassword: false }) },
    { name: "381 веб: новая учётка через Google → отметка сразу, писем нет", seed: [], act: (r, s) => webSignIn(r, s, { email: "nueva@example.com" }), session: "new", rows: 1, check: linkCheck("new0", { reset: false, version: 0, hadPassword: false }) },
    { name: "381 веб: учётка владельца, привязанная до 7.268 → не сбрасывается", seed: [{ email: OWNER, passwordHash: pw, sessionVersion: 1 }], act: (r, s) => webSignIn(r, s, { email: OWNER }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: false, version: 1 }) },
    { name: "381 веб: письмо не ушло (Resend отказал) → вход есть, сброс есть, Sentry", mailMode: "fail", seed: [{ email: "victima@gmail.com", passwordHash: pw, sessionVersion: 3 }], act: (r, s) => webSignIn(r, s, { email: "victima@gmail.com" }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: true, version: 3, email: "victima@gmail.com" }) },
    { name: "381 приложение: письмо упало исключением → вход есть, Sentry", inApp: true, mailMode: "throw", seed: [{ email: "victima@gmail.com", passwordHash: pw, sessionVersion: 3 }], act: (r, s) => nativeSignIn(r, s, { email: "victima@gmail.com" }), session: "seed0", rows: 1, check: linkCheck("seed0", { reset: true, version: 3, email: "victima@gmail.com" }) },
    { name: "регистрация: новый адрес → одна учётка (не сломать)", seed: [{ email: "foo@gmail.com", passwordHash: pw }], act: (r) => registerWith(r, "Bar@Example.com"), session: "new", rows: 2 },
  ];
}

async function runAll(routes, list) {
  const violations = [];
  for (const sc of list) {
    const db = fakeDb(sc.seed);
    globalThis.__rfG = { db, sessions: [], inApp: Boolean(sc.inApp), mails: [], sentry: [], mailMode: sc.mailMode ?? "ok" };
    process.env.SESSION_SECRET = "guard-session-secret";
    if (sc.flagOff) {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
      process.env.GOOGLE_CLIENT_SECRET = CLIENT_SECRET;
    }
    const signer = routes.makeTestSigner("guard-kid");
    const problems = [];
    let out;
    try {
      out = await sc.act(routes, signer);
    } catch (error) {
      problems.push(`упал: ${error?.message ?? error}`);
      out = {};
    }
    const sessions = globalThis.__rfG.sessions;
    const got = sessions.length === 0 ? null : sessions.map((s) => s.userId).join(",");
    const want = sc.session === "new" ? db.rows.find((r) => r.id.startsWith("new"))?.id ?? "new" : sc.session;
    if (got !== want) problems.push(`сессия у ${got ?? "никого"}, ждали ${want ?? "никого"}`);
    if (db.rows.length !== sc.rows) problems.push(`строк ${db.rows.length}, ждали ${sc.rows}`);
    const keys = db.rows.map((r) => routes.mailboxKey(r.email));
    if (new Set(keys).size !== keys.length) problems.push(`ДВЕ УЧЁТКИ НА ОДИН ЯЩИК: ${db.rows.map((r) => r.email).join(" / ")}`);
    if (sc.status && out.status !== sc.status) problems.push(`код ${out.status}, ждали ${sc.status}`);
    if (sc.error) {
      const seen = out.error ?? (out.location ? new URL(out.location).searchParams.get("error") : null);
      if (seen !== sc.error) problems.push(`ошибка «${seen}», ждали «${sc.error}»`);
    }
    if (sc.keepsNoPassword) {
      const row = db.rows.find((r) => r.id === sc.keepsNoPassword);
      if (row?.passwordHash) problems.push("учётке без пароля поставлен пароль без письма");
    }
    if (sc.check) problems.push(...sc.check(db, globalThis.__rfG));
    if (problems.length) violations.push({ name: sc.name, problems });
  }
  return { checked: list.length, violations };
}

function report(label, { checked, violations }) {
  console.log(`${label}: сценариев ${checked}, нарушений ${violations.length}`);
  for (const v of violations) console.log(`  ✗ ${v.name}: ${v.problems.join("; ")}`);
}

/** Подсадка = подмена одного места исходника; место обязано найтись. */
const PLANTS = [
  {
    name: "Google-вход с адресом существующего пользователя создаёт вторую учётку",
    file: "src/lib/google-auth/account.ts",
    from: [
      ['  if (exact) return { kind: "existing", user: exact };\n', ""],
      ['  if (sameAddress.length === 1) return { kind: "existing", user: sameAddress[0] };\n', ""],
      ['  if (sameMailbox.length === 1) return { kind: "existing", user: sameMailbox[0] };\n', ""],
    ],
  },
  {
    name: "адрес сравнивается с учётом регистра (без нормализации)",
    file: "src/lib/google-auth/account.ts",
    from: [
      ["  return raw.trim().toLowerCase();\n", "  return raw;\n"],
      ["  const sameAddress = candidates.filter((row) => normalizeEmail(row.email) === email);", "  const sameAddress = candidates.filter((row) => row.email === email);"],
      ["  const sameMailbox = candidates.filter((row) => mailboxKey(row.email) === key);", "  const sameMailbox = candidates.filter((row) => row.email === key);"],
    ],
  },
  {
    name: "неподтверждённый адрес Google пускают",
    file: "src/lib/google-auth/id-token.ts",
    from: [['  if (claims.email_verified !== true && claims.email_verified !== "true") return { ok: false, error: "email_unverified" };\n', ""]],
  },
  {
    name: "токен с чужим aud принят",
    file: "src/lib/google-auth/id-token.ts",
    from: [['  if (!audOk) return { ok: false, error: "wrong_audience" };\n', ""]],
  },
  {
    name: "регистрация: «Foo@Gmail.com» и «foo@gmail.com» — две учётки",
    file: "src/app/api/auth/register/route.ts",
    from: [['  const email = String(formData.get("email") ?? "")\n    .trim()\n    .toLowerCase();', '  const email = String(formData.get("email") ?? "");']],
  },
  {
    name: "регистрация присваивает учётку без пароля (захват Google-учётки)",
    file: "src/app/api/auth/register/route.ts",
    from: [
      [
        '  if (existing) return fail(existing.passwordHash ? "email_taken" : "account_exists_no_password");\n\n  const passwordHash = await hashPassword(password);\n  const user = await db.user.create({ data: { email, passwordHash } });',
        '  if (existing?.passwordHash) return fail("email_taken");\n\n  const passwordHash = await hashPassword(password);\n  const user = existing\n    ? await db.user.update({ where: { id: existing.id }, data: { passwordHash } })\n    : await db.user.create({ data: { email, passwordHash } });',
      ],
    ],
  },
  {
    name: "флаг игнорируется (вход включён без настроек)",
    file: "src/lib/google-auth/config.ts",
    from: [['  if (!clientId || !clientSecret) return null;\n  return { clientId, clientSecret };', '  return { clientId: clientId || "guard-web.apps.googleusercontent.com", clientSecret: clientSecret || "guard-secret" };']],
  },
  {
    name: "веб-вход открыт внутри приложения",
    file: "src/lib/google-auth/handlers.ts",
    from: [["  if (!config || (await isNativeShellRequest())) {", "  if (!config) {"]],
  },
  // ——— долг 381 (7.268) ———
  {
    // Позитивный контроль «без правки»: общий путь входа ровно как в
    // `main` до 7.268 (вход в учётку без всякой привязки).
    name: "правила 381 нет: sign-in.ts как до 7.268",
    file: "src/lib/google-auth/sign-in.ts",
    from: [
      ["  const link = await linkGoogleOnSignIn(prismaLinkStore(db), outcome.user.id);\n", "  const link = { kind: \"repeat\", sessionVersion: outcome.user.sessionVersion };\n"],
    ],
  },
  {
    // Обе преграды сразу: проверка в коде И условие `googleLinkedAt IS NULL`
    // в самой записи (одна снятая преграда другую не пробивает — это и есть
    // двойная защита).
    name: "повторный вход через Google тоже сбрасывает пароль",
    file: "src/lib/google-auth/link.ts",
    from: [
      ["  if (row.googleLinkedAt) return { kind: \"repeat\", sessionVersion: row.sessionVersion };\n", ""],
      ["          where: { id, googleLinkedAt: null },\n          data: { googleLinkedAt: at, passwordHash", "          where: { id },\n          data: { googleLinkedAt: at, passwordHash"],
    ],
  },
  {
    name: "учётку без пароля правило тоже «сбрасывает» (письмо, закрытые сессии)",
    file: "src/lib/google-auth/link.ts",
    from: [["  if (!row.passwordHash || linkedBefore7268(row.email)) {", "  if (linkedBefore7268(row.email)) {"]],
  },
  {
    name: "учётку, привязанную до 7.268 (владельца), сбрасывает",
    file: "src/lib/google-auth/link.ts",
    from: [["  if (!row.passwordHash || linkedBefore7268(row.email)) {", "  if (!row.passwordHash) {"]],
  },
  {
    name: "отметка привязки при сбросе не ставится (каждый вход — «первый»)",
    file: "src/lib/google-auth/link.ts",
    from: [["data: { googleLinkedAt: at, passwordHash: null, sessionVersion: { increment: 1 } }", "data: { passwordHash: null, sessionVersion: { increment: 1 } }"]],
  },
  {
    name: "сессия этого входа выдана со старой версией (сам себя выкидывает)",
    file: "src/lib/google-auth/sign-in.ts",
    from: [["  await createSession(outcome.user.id, link.sessionVersion);", "  await createSession(outcome.user.id, outcome.user.sessionVersion);"]],
  },
  {
    name: "ошибка отправки письма роняет вход",
    file: "src/lib/google-auth/sign-in.ts",
    from: [[".catch((error: unknown) => {\n      Sentry.captureException(error, { tags: { area: \"google-link-email\" } });\n      return null;\n    });", ";"]],
  },
  {
    name: "неотправленное письмо не попадает в Sentry",
    file: "src/lib/google-auth/sign-in.ts",
    from: [["      Sentry.captureMessage(\"google-link: password-disabled email not sent\", { level: \"error\", tags: { area: \"google-link-email\" }, extra: { userId: outcome.user.id } });\n", ""]],
  },
];

async function main() {
  const plantMode = process.argv.includes("--plant");
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  const list = scenarios().filter((sc) => !only || sc.name.includes(only));

  if (!plantMode) {
    const result = await runAll(await loadRoutes(), list);
    if (result.checked === 0) {
      console.log("сличений 0 — пустая выборка не результат");
      process.exit(1);
    }
    report("check:google-signin", result);
    process.exit(result.violations.length === 0 ? 0 : 1);
  }

  let ok = true;
  const baseline = await runAll(await loadRoutes(), list);
  report("исходник как есть", baseline);
  if (baseline.violations.length) ok = false;

  for (const plant of PLANTS) {
    let text = readFileSync(resolve(ROOT, plant.file), "utf8");
    for (const [from, to] of plant.from) {
      if (!text.includes(from)) {
        console.log(`✗ подсадка «${plant.name}»: место не найдено в ${plant.file} — подсадка устарела`);
        ok = false;
      }
      text = text.replace(from, to);
    }
    const result = await runAll(await loadRoutes({ [plant.file]: text }), list);
    const caught = result.violations.length > 0;
    console.log(`${caught ? "✓" : "✗"} подсадка «${plant.name}»: ${caught ? `поймана ${result.violations.length} сценариями (${result.violations.map((v) => v.name).slice(0, 3).join("; ")}…)` : "НЕ ПОЙМАНА"}`);
    if (!caught) ok = false;
  }

  // Пустая выборка: главный режим, которому не досталось ни одного
  // сценария, обязан упасть, а не сказать «нарушений 0».
  const { spawnSync } = await import("node:child_process");
  const emptyRun = spawnSync(process.execPath, [process.argv[1], "--only=__ни_одного__"], { encoding: "utf8" });
  const emptyRed = emptyRun.status !== 0 && /сличений 0/.test(emptyRun.stdout);
  console.log(`${emptyRed ? "✓" : "✗"} пустая выборка: выход ${emptyRun.status} → ${emptyRed ? "красный" : "зелёный (ошибка)"}`);
  if (!emptyRed) ok = false;

  console.log(ok ? `подсадки: ${PLANTS.length} из ${PLANTS.length} пойманы, пустая выборка красная` : "КОНТРОЛЬ НЕ ПРОЙДЕН");
  process.exit(ok ? 0 : 1);
}

// Только когда файл запущен сам, а не импортирован (src/lib/entry-point.ts).
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (IS_ENTRY_POINT) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
