/**
 * В ОБОЛОЧКЕ, КОТОРАЯ УМЕЕТ ПОКУПАТЬ, НЕТ «В ЭТОЙ ВЕРСИИ НЕТ ПОКУПОК» —
 * заход 7.242, долг 346 (аудит 7.241, Р5).
 *
 * ОТКУДА. С 7.224 оболочка от версии 4 покупает через Google Play, и окно
 * замка (`PaywallContext`) это знало. А карточки замка НА СТРАНИЦЕ —
 * рассказ, видео, три закрытые вкладки урока — брали тексты «закрыто в
 * этой версии приложения», не спрашивая `canBuyInsideShell`. Проверяющий
 * Google на рассказе с короной прочитал бы «нет покупок» над работающей
 * покупкой. Та же фраза стояла в `<head>` у `/pricing` в оболочке.
 *
 * ФРАЗЫ — ПЕРЕПИСЬ, А НЕ СПИСОК РУКОЙ: каждая строка
 * `src/lib/native-access-copy.ts`, говорящая «в этой версии приложения»
 * (обе локали). Новая такая строка попадает под сторож сама.
 *
 * ДВЕ ПОЛОВИНЫ.
 *   1. СТАТИЧЕСКАЯ (без `--base`): `nativeLockBody` зовут только модуль
 *      текстов и окно (где ветка на покупку есть), `closedNote` читает
 *      только `nativeInlineLock`; три страницы спрашивают
 *      `nativeInlineLock(…, await canBuyInsideShell())` и рисуют кнопку к
 *      окну покупки; строка профиля «покупок нет» стоит ПОСЛЕ ветки
 *      `nativeCanBuy`; подпись `/pricing` в оболочке спрашивает покупку.
 *   2. ЖИВАЯ (`--base=…`, сервер с `E2E_TEST_SEED=1`): все адреса переписи
 *      (`route-census.mjs`) в двух ролях (гость, бесплатный аккаунт) в
 *      обличье оболочки с покупкой (`RFNativeShell/13`) — фраз 0 в видимом
 *      документе. Встроенный контроль измерителя: та же перепись в обличье
 *      старой оболочки (`RFNativeShell`, версия 2) обязана найти фразы — иначе
 *      ноль ничего не значит. `--plant`: фраза, подсаженная в отдачу каждой
 *      роли, ловится.
 *
 *   npx tsx scripts/check-lock-purchase-path.ts [--plant]
 *   npx tsx scripts/check-lock-purchase-path.ts --base=http://… [--plant]
 */
import { readFileSync } from "node:fs";
import { NATIVE_ACCESS_COPY_FOR_GUARD } from "../src/lib/native-access-copy";
import { isEntryPoint } from "../src/lib/entry-point";
import { collectAddresses } from "./route-census.mjs";
import { visibleDocument } from "./purchase-surface-rules.mjs";

const COPY_FILE = "src/lib/native-access-copy.ts";
const PAYWALL = "src/contexts/PaywallContext.tsx";
const STORY = "src/app/[lang]/stories/[id]/page.tsx";
const MEDIA = "src/app/[lang]/media/[id]/page.tsx";
const LESSON = "src/app/[lang]/courses/[level]/[lesson]/page.tsx";
const LESSON_VIEW = "src/components/lesson/LessonView.tsx";
const PROFILE = "src/app/[lang]/profile/page.tsx";
const PRICING = "src/app/[lang]/pricing/page.tsx";
const FILES = [COPY_FILE, PAYWALL, STORY, MEDIA, LESSON, LESSON_VIEW, PROFILE, PRICING] as const;
type Sources = Record<(typeof FILES)[number], string>;

/** Все строки текстов оболочки, говорящие «в этой версии приложения». */
export function noPurchasePhrases(): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (/esta versión de la aplicación|этой версии приложения/i.test(v)) out.add(v);
    } else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(NATIVE_ACCESS_COPY_FOR_GUARD);
  return [...out];
}

function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function judgeStatic(raw: Sources): string[] {
  const s = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, strip(v)])) as Record<string, string> & Sources;
  const bad: string[] = [];
  // 1. Кто зовёт тексты «закрыто в этой версии».
  for (const [file, src] of Object.entries(s)) {
    if (file === COPY_FILE || file === PAYWALL) continue;
    if (/nativeLockBody\(/.test(src)) bad.push(`${file}: зовёт nativeLockBody мимо nativeInlineLock — ветки «оболочка умеет покупать» у карточки нет`);
    if (/\.closedNote\b/.test(src)) bad.push(`${file}: читает closedNote мимо nativeInlineLock`);
  }
  if (!/nativePurchase\s*\?[\s\S]{0,200}:\s*nativeLockBody\(/.test(s[PAYWALL])) {
    bad.push(`${PAYWALL}: окно зовёт nativeLockBody не только в ветке «покупки нет»`);
  }
  // 2. Три страницы спрашивают покупку.
  for (const [file, kind] of [[STORY, "story"], [MEDIA, "video"], [LESSON, "lesson"]] as const) {
    if (!new RegExp(`nativeInlineLock\\(lang, "${kind}",[^;]*await canBuyInsideShell\\(\\)\\)`).test(s[file])) {
      bad.push(`${file}: карточка замка не спрашивает canBuyInsideShell (nativeInlineLock(…, "${kind}", …))`);
    }
  }
  for (const file of [STORY, MEDIA]) {
    if (!/<NativeBuyButton\b/.test(s[file])) bad.push(`${file}: у карточки замка нет кнопки к окну покупки`);
  }
  if (!/nativeBuyCta=\{nativeShellLessonLock\?\.buyCta/.test(s[LESSON]) || !/buyCta && <NativeBuyButton/.test(s[LESSON_VIEW])) {
    bad.push(`${LESSON}/${LESSON_VIEW}: закрытые вкладки урока без кнопки к окну покупки`);
  }
  // 3. Кабинет: «покупок нет» — только после ветки покупки.
  const buy = s[PROFILE].indexOf(") : nativeCanBuy ? (");
  const note = s[PROFILE].indexOf("nativeAccessCopy(lang).profileNote");
  if (note >= 0 && (buy < 0 || buy > note)) bad.push(`${PROFILE}: строка «покупок нет» стоит раньше ветки nativeCanBuy`);
  // 4. Подпись /pricing в оболочке.
  const meta = s[PRICING].slice(0, s[PRICING].indexOf("export default"));
  const canBuyAt = meta.indexOf("await canBuyInsideShell()");
  const bodyAt = meta.indexOf("description: copy.body");
  if (bodyAt >= 0 && (canBuyAt < 0 || canBuyAt > bodyAt)) bad.push(`${PRICING}: подпись страницы в оболочке говорит «покупок нет», не спросив canBuyInsideShell`);
  return bad;
}

// ---------------------------------------------------------------- живая
const UA = "Mozilla/5.0 (Linux; Android 14; POCO) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36";
const CAN_BUY = "RFNativeShell/13";
const OLD = "RFNativeShell";

async function makeFreeSession(base: string): Promise<string> {
  const email = `lockguard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
    body: new URLSearchParams({ email, password: "TestPass123!", lang: "es", redirectTo: "/es" }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const jar = res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("=")).join("; ");
  if (!jar) throw new Error(`не удалось завести роль «бесплатный аккаунт»: register ответил ${res.status} без куки (сервер без E2E_TEST_SEED=1?)`);
  return jar;
}

async function page(base: string, path: string, token: string, session: string | null): Promise<string | null> {
  const headers: Record<string, string> = { "user-agent": `${UA} ${token}` };
  if (session) headers.cookie = session;
  const res = await fetch(`${base}${path}`, { headers, redirect: "manual", signal: AbortSignal.timeout(60_000) });
  if (res.status !== 200) return null;
  return res.text();
}

async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export function countPhrases(html: string, phrases: string[]): number {
  const visible: string = visibleDocument(html);
  return phrases.reduce((n, p) => n + (visible.split(p).length - 1), 0);
}

async function live(base: string, plant: boolean): Promise<number> {
  const phrases = noPurchasePhrases();
  const census = await collectAddresses(base, { perDynamic: 3 });
  const addresses: string[] = census.addresses.filter((a: string) => !a.includes("/admin"));
  const roles: [string, string | null][] = [
    ["гость", null],
    ["бесплатный аккаунт", await makeFreeSession(base)],
  ];
  const problems: string[] = [];
  let oldHits = 0;
  let buyButtons = 0;
  let judged = 0;
  let planted = 0;
  for (const [role, session] of roles) {
    const results = await pool(addresses, 6, async (path) => {
      const [now, old] = await Promise.all([page(base, path, CAN_BUY, session), page(base, path, OLD, session)]);
      return { path, now, old };
    });
    for (const { path, now, old } of results) {
      if (old) oldHits += countPhrases(old, phrases);
      if (!now) continue;
      judged++;
      if (now.includes("data-rf-native-buy")) buyButtons++;
      const n = countPhrases(now, phrases);
      if (n > 0) problems.push(`${path} (${role}, оболочка с покупкой): фраз «в этой версии нет/закрыто» — ${n}`);
      if (plant && countPhrases(now.replace("</body>", `<p>${phrases[0]}</p></body>`), phrases) > 0) planted++;
    }
  }
  console.log(
    `  адресов ${addresses.length} × ролей ${roles.length}: судимых ответов ${judged}; в старой оболочке фраз найдено ${oldHits} ` +
      `(контроль измерителя); кнопок к окну покупки в оболочке с покупкой ${buyButtons}`,
  );
  if (oldHits === 0) problems.push("КОНТРОЛЬ: в старой оболочке фраз 0 — измеритель слеп, его ноль ничего не доказывает");
  if (plant) {
    const ok = problems.length === 0 && planted === judged && judged > 0;
    console.log(ok ? `check:lock-purchase-path --base --plant — подсадка поймана в ${planted} из ${judged} ответов, настоящая отдача молчит` : `check:lock-purchase-path --base --plant — FAILED (${planted}/${judged}; ${problems.length} проблем)`);
    return ok ? 0 : 1;
  }
  if (problems.length) {
    console.error("check:lock-purchase-path (живая) — ОТКАЗ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(`check:lock-purchase-path (живая) — в оболочке с покупкой фраз «нет покупок» 0 на ${judged} ответах.`);
  return 0;
}

function readSources(): Sources {
  return Object.fromEntries(FILES.map((f) => [f, readFileSync(f, "utf8")])) as Sources;
}

async function main(): Promise<number> {
  const plant = process.argv.includes("--plant");
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  if (baseArg) return live(baseArg.slice("--base=".length), plant);

  const src = readSources();
  const phrases = noPurchasePhrases();
  if (phrases.length < 5) {
    console.error(`check:lock-purchase-path — перепись фраз нашла ${phrases.length}: модуль текстов перестроен, перечитайте сторож`);
    return 1;
  }
  if (plant) {
    let ok = judgeStatic(src).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие исходники`);
    const edit = (file: keyof Sources, from: string | RegExp, to: string): Sources | null => {
      const next = src[file].replace(from, to);
      return next === src[file] ? null : { ...src, [file]: next };
    };
    const cases: [string, Sources | null, string][] = [
      ["рассказ снова зовёт nativeLockBody, как до 7.242", edit(STORY, "nativeShellStoryLock.body", 'nativeLockBody(lang, "story", false)'), "зовёт nativeLockBody"],
      ["видео снова читает closedNote", edit(MEDIA, "{nativeShellMediaLock.note}", "{nativeAccessCopy(lang).closedNote}"), "closedNote"],
      ["урок перестал спрашивать canBuyInsideShell", edit(LESSON, /nativeInlineLock\(lang, "lesson", false, await canBuyInsideShell\(\)\)/, 'nativeInlineLock(lang, "lesson", false, false)'), "не спрашивает canBuyInsideShell"],
      ["у рассказа пропала кнопка к окну покупки", edit(STORY, /<NativeBuyButton[\s\S]*?\/>/, "null"), "нет кнопки"],
      ["вкладки урока без кнопки", edit(LESSON_VIEW, "buyCta && <NativeBuyButton", "false && <NativeBuyButton"), "без кнопки"],
      ["строка «покупок нет» в кабинете раньше ветки покупки", edit(PROFILE, ") : nativeCanBuy ? (", ") : false ? ("), "раньше ветки"],
      ["подпись /pricing снова не спрашивает покупку", edit(PRICING, "if (await canBuyInsideShell()) {", "if (false) {"), "не спросив"],
    ];
    let caught = 0;
    for (const [name, patched, expect] of cases) {
      if (!patched) {
        console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name}`);
        ok = false;
        continue;
      }
      const hit = judgeStatic(patched).some((m) => m.includes(expect));
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}`);
    }
    ok &&= caught === cases.length;
    console.log(ok ? `check:lock-purchase-path --plant — ${caught} из ${cases.length} подсадок, 1 из 1 отрицательный контроль` : "check:lock-purchase-path --plant — FAILED");
    return ok ? 0 : 1;
  }
  const bad = judgeStatic(src);
  if (bad.length) {
    console.error("check:lock-purchase-path — ОТКАЗ:");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(
    `check:lock-purchase-path — фраз «в этой версии приложения» в текстах оболочки ${phrases.length} (перепись); ` +
      `их читают только окно (в ветке без покупки) и nativeInlineLock; рассказ, видео и урок спрашивают canBuyInsideShell ` +
      `и рисуют кнопку к окну покупки; кабинет и подпись /pricing — после ветки покупки. Контроль — --plant; живая — --base=.`,
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
