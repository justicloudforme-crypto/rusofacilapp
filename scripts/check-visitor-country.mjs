// СТРАНА ПОСЕТИТЕЛЯ НА ЖИВОМ ПРОДЕ — сторож долга 42 (7.296).
//
// ЧТО ВИСИТ НА СТРАНЕ. Сайт узнаёт страну по заголовку `x-vercel-ip-country`,
// который ставит граница Vercel по IP запроса (`src/lib/country.ts`). От неё
// зависят две вещи на `/pricing`:
//   * OXXO (наличные в мексиканском магазине) — ТОЛЬКО в Мексике;
//     иностранцу — «Aceptamos tarjetas de crédito y débito»;
//   * валюта: в Мексике песо, в стране из списка `src/lib/currency.ts` —
//     «≈ сумма CODE*» по курсу дня, песо — в сноске.
//
// ДОЛГ 42. Замер «страну определяем верно» был сделан с ОДНОГО адреса
// (Тихуана) и на превью — второго выхода к боевому домену не было. Он есть:
// раннер GitHub стоит вне Мексики (США), Mac владельца — в Мексике. Этот
// сторож — один и тот же прибор для обоих адресов:
//
//   node scripts/check-visitor-country.mjs --expect=abroad   # раннер GitHub (prod-smoke.yml)
//   node scripts/check-visitor-country.mjs --expect=MX       # Mac в Мексике (руками)
//   node scripts/check-visitor-country.mjs --plant           # контроли, наружу ни одного запроса
//
// ПРАВИЛА (`--expect=abroad`):
//   1. на странице подпись «только карты», подписи OXXO нет — иначе
//      иностранцу предлагают ваучер, который негде оплатить (отказ хуже
//      неудобства, см. `country.ts`);
//   2. цена пересчитана: «≈ … CODE*», CODE ≠ MXN — иначе сайт не узнал
//      страну (заголовок не дошёл) или не пришёл курс (open.er-api.com);
//      один повтор после паузы, потом отказ — иностранцы в этот момент
//      видят песо;
//   3. ПОДДЕЛКА НЕ ПРОХОДИТ: тот же запрос с `x-vercel-ip-country: MX`
//      обязан дать ту же отрисовку. Vercel перезаписывает заголовок на
//      границе (замер 07.09.2026, долг 41); если однажды перестанет — или
//      если сайт начнёт брать страну из того, что присылает клиент, —
//      любой получит OXXO, назвавшись мексиканцем.
// `--expect=MX` — зеркально: OXXO есть, пересчёта нет, подделка `US` не
// проходит.
//
// ПРИЗНАКИ — ИЗ СЛОВАРЯ, НЕ ПРИДУМАНЫ. Подписи берутся из
// `src/dictionaries/es.json` (`pricing.paymentMethodsNote` /
// `paymentMethodsNoteCardOnly`) и ищутся в ВИДИМОМ тексте (скрипты и
// payload вырезаны — там словарь лежит целиком, с обеими подписями).
// Ни одной подписи или обе сразу — сторож слеп, это отказ.
//
// ЦЕНА ПРОГОНА. Два GET страницы `/es/pricing` (≈180 КБ каждый), ни одного
// входа, ни одной записи.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ARGS = process.argv.slice(2);
const argValue = (name) => ARGS.findLast((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const PLANT = ARGS.includes("--plant");
const BASE = (argValue("base") ?? "https://rusofacilapp.com").replace(/\/+$/, "");
const EXPECT = argValue("expect") ?? "abroad";
const RETRY_DELAY_MS = Number(argValue("retry-delay-ms") ?? 30_000);
const PATH = "/es/pricing";

/** Написание не брендовое — та же причина, что у `RFProdSmoke` (`prod-smoke.mjs`). */
const USER_AGENT = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 RFCountryCheck";
const COUNTRY_HEADER = "x-vercel-ip-country";

export function notes(root = process.cwd()) {
  const dict = JSON.parse(readFileSync(join(root, "src", "dictionaries", "es.json"), "utf8"));
  const cash = dict?.pricing?.paymentMethodsNote;
  const card = dict?.pricing?.paymentMethodsNoteCardOnly;
  if (typeof cash !== "string" || typeof card !== "string" || !cash || !card || cash === card) {
    throw new Error("в es.json нет pricing.paymentMethodsNote / paymentMethodsNoteCardOnly — сторож ослеп бы молча");
  }
  return { cash, card };
}

/** Видимый текст: без скриптов, стилей и тегов (как `visibleText` в check-store-seo). */
export function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Что отрисовал сервер: подпись способа оплаты и валюта карточек. */
export function readRendering(html, n) {
  const text = visibleText(html);
  const cash = text.includes(n.cash);
  const card = text.includes(n.card);
  const codes = [...new Set([...text.matchAll(/≈\s?[\d.,   ]+\s([A-Z]{3})\*/g)].map((m) => m[1]))];
  return { cash, card, currency: codes.length === 1 ? codes[0] : codes.length ? codes.join("+") : null };
}

export function describe(r) {
  if (!r) return "нет ответа";
  const method = r.cash && !r.card ? "OXXO и карты" : r.card && !r.cash ? "только карты" : r.cash ? "ОБЕ подписи" : "НИ ОДНОЙ подписи";
  return `${method}, ${r.currency ? `≈ ${r.currency}` : "песо (без пересчёта)"}`;
}

/** Приговор одной отрисовке. Пустой массив — чисто. */
export function judge(r, expect) {
  const why = [];
  if (r.cash === r.card) {
    why.push(r.cash ? "на странице обе подписи способа оплаты" : "на странице нет ни одной подписи способа оплаты — сторож слеп (разошлись словарь и разметка?)");
    return why;
  }
  if (expect === "MX") {
    if (!r.cash) why.push("Мексика без OXXO: сайт не узнал мексиканца");
    if (r.currency) why.push(`Мексика видит пересчёт ≈ ${r.currency} вместо песо`);
  } else {
    if (r.cash) why.push("иностранцу предложен OXXO — сайт принял его за мексиканца");
    if (!r.currency) why.push("цена не пересчитана: сайт не узнал страну (заголовок не дошёл) или не пришёл курс");
    else if (r.currency.includes("+") || r.currency === "MXN") why.push(`странная валюта пересчёта «${r.currency}»`);
  }
  return why;
}

async function fetchRendering(base, n, spoof) {
  const headers = { "user-agent": USER_AGENT };
  if (spoof) headers[COUNTRY_HEADER] = spoof;
  try {
    const res = await fetch(`${base}${PATH}`, { headers, redirect: "follow", signal: AbortSignal.timeout(60_000) });
    const html = await res.text();
    if (res.status !== 200) return { status: res.status, error: `ответ ${res.status}` };
    return { status: 200, ...readRendering(html, n) };
  } catch (err) {
    return { status: 0, error: `не ответил: ${String(err.cause?.code ?? err).slice(0, 80)}` };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Один проход: честный запрос и подделка. Список отказов. */
async function once(base, expect, n) {
  const spoof = expect === "MX" ? "US" : "MX";
  const honest = await fetchRendering(base, n, null);
  const forged = await fetchRendering(base, n, spoof);
  const fails = [];
  if (honest.error) fails.push(`честный запрос: ${honest.error}`);
  else fails.push(...judge(honest, expect).map((w) => `честный запрос: ${w}`));
  if (forged.error) fails.push(`запрос с подделкой «${COUNTRY_HEADER}: ${spoof}»: ${forged.error}`);
  else if (!honest.error && (forged.cash !== honest.cash || forged.currency !== honest.currency)) {
    fails.push(`подделка «${COUNTRY_HEADER}: ${spoof}» ПРОШЛА: без неё — ${describe(honest)}, с ней — ${describe(forged)}`);
  } else if (!honest.error) fails.push(...judge(forged, expect).map((w) => `запрос с подделкой: ${w}`));
  return { honest, forged, spoof, fails };
}

export async function runCheck({ base = BASE, expect = EXPECT, retryDelayMs = RETRY_DELAY_MS, quiet = false } = {}) {
  if (expect !== "MX" && expect !== "abroad") throw new Error(`--expect=MX или --expect=abroad, а не «${expect}»`);
  const n = notes();
  const log = quiet ? () => {} : console.log;
  let pass = await once(base, expect, n);
  if (pass.fails.length) {
    log(`  первый проход: ${pass.fails.length} отказ(а), повтор через ${retryDelayMs} мс`);
    await sleep(retryDelayMs);
    pass = await once(base, expect, n);
  }
  log(`[check:visitor-country] база ${base}, ожидание «${expect === "MX" ? "Мексика" : "не Мексика"}»`);
  log(`  без подделки: ${describe(pass.honest.error ? null : pass.honest)}`);
  log(`  с «${COUNTRY_HEADER}: ${pass.spoof}»: ${describe(pass.forged.error ? null : pass.forged)}`);
  for (const f of pass.fails) (quiet ? () => {} : console.error)(`  ОТКАЗ — ${f}`);
  return pass.fails.length ? 1 : 0;
}

/**
 * СКВОЗНОЙ КОНТРОЛЬ. Местный «сайт» `/es/pricing`, который отрисовывает
 * страницу по «стране» так же, как настоящий, — и каждая поломка задаётся
 * одной правкой. Исправный обязан дать 0, сломанный — 1.
 */
async function runPlant() {
  const n = notes();
  let site;
  const server = createServer((req, res) => {
    if (req.url.split("?")[0] !== PATH) {
      res.writeHead(404);
      res.end();
      return;
    }
    if (site.status) {
      res.writeHead(site.status, { "content-type": "text/html" });
      res.end("<h1>Algo salió mal</h1>");
      return;
    }
    // «Граница» местного сайта: страна по «IP» — `site.ipCountry`; если
    // сайт сломан доверием, заголовок клиента её перекрывает.
    const country = (site.trustsClient && req.headers[COUNTRY_HEADER]) || site.ipCountry;
    const mx = country === "MX";
    const cash = site.cashEverywhere || mx;
    const converted = !mx && country && !site.rateDown ? site.currency ?? "USD" : null;
    const price = converted ? `≈ 8,66 ${converted}*` : "$150 MXN";
    const note = site.noNote ? "" : cash ? n.cash : n.card;
    const payload = `<script>self.__next_f.push([1,"{\\"paymentMethodsNote\\":\\"${n.cash}\\",\\"paymentMethodsNoteCardOnly\\":\\"${n.card}\\"}"])</script>`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<main><p class="price">${price}</p><p class="text-sm">${note}</p>${payload}</main>`);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cases = [
    { name: "раннер вне Мексики, исправный сайт (отрицательный контроль)", expect: "abroad", site: { ipCountry: "US" }, want: 0 },
    { name: "Mac в Мексике, исправный сайт (отрицательный контроль)", expect: "MX", site: { ipCountry: "MX" }, want: 0 },
    { name: "иностранец, евро (отрицательный контроль: валюта любая, кроме MXN)", expect: "abroad", site: { ipCountry: "ES", currency: "EUR" }, want: 0 },
    { name: "OXXO показан иностранцу", expect: "abroad", site: { ipCountry: "US", cashEverywhere: true }, want: 1 },
    { name: "сайт верит заголовку клиента (подделка MX проходит)", expect: "abroad", site: { ipCountry: "US", trustsClient: true }, want: 1 },
    { name: "сайт верит заголовку клиента — с мексиканского адреса (подделка US проходит)", expect: "MX", site: { ipCountry: "MX", trustsClient: true }, want: 1 },
    { name: "заголовок страны не дошёл (страна неизвестна → песо)", expect: "abroad", site: { ipCountry: null }, want: 1 },
    { name: "курс не пришёл (песо у иностранца)", expect: "abroad", site: { ipCountry: "US", rateDown: true }, want: 1 },
    { name: "Мексика без OXXO (сайт не узнал мексиканца)", expect: "MX", site: { ipCountry: "US" }, want: 1 },
    { name: "подписи способа оплаты нет (сторож слеп)", expect: "abroad", site: { ipCountry: "US", noNote: true }, want: 1 },
    { name: "страница цен отвечает 500", expect: "abroad", site: { ipCountry: "US", status: 500 }, want: 1 },
  ];
  let ok = 0;
  try {
    for (const c of cases) {
      site = c.site;
      const code = await runCheck({ base, expect: c.expect, retryDelayMs: 20, quiet: true });
      const good = code === c.want;
      if (good) ok += 1;
      console.log(`  ${good ? (c.want ? "поймано" : "чисто") : c.want ? "ПРОПУЩЕНО" : "ЛОЖНОЕ СРАБАТЫВАНИЕ"} — ${c.name} (код ${code})`);
    }
  } finally {
    server.close();
  }
  console.log(`check:visitor-country --plant: случаев ${cases.length}, сошлось ${ok} из ${cases.length}`);
  return ok === cases.length ? 0 : 1;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exit(PLANT ? await runPlant() : await runCheck());
