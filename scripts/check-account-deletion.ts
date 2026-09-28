/**
 * УДАЛЕНИЕ АККАУНТА ГОВОРИТ ПРАВДУ ПРО ПОДПИСКУ GOOGLE PLAY, И У НЕГО ЕСТЬ
 * ПУБЛИЧНАЯ СТРАНИЦА — заход 7.242, долги 344 и 345 (аудит 7.241, Р3 и Р4).
 *
 * ОТКУДА. Аудит 7.241 прошёл удаление аккаунта на локальной копии базы
 * пользователем с подпиской Google Play: 5 строк → 0, а подписка у Google
 * осталась бы списывать деньги — сервер отменяет только Stripe
 * (`confirm-account-deletion/route.ts`). Предупреждений на двух экранах
 * удаления — 0, страница подтверждения писала «se eliminará tu
 * suscripción». Адреса для поля «Delete account URL» анкеты Google Play не
 * было: `/es/delete-account` → 404, якорь политики — один абзац.
 *
 * ЧТО СТЕРЕЖЁТСЯ.
 *   1. ПРАВИЛО, а не текст: настоящая `hasRenewingStoreSubscription`
 *      исполняется на семи строках (Google Play активна / пробная /
 *      отменённая / истёкшая / Premium, Stripe, пусто) — предупреждать
 *      обязано ровно двух первых.
 *   2. ТРИ МЕСТА, где человек подтверждает удаление, спрашивают это
 *      правило и рисуют предупреждение: форма в профиле (ДО формы с
 *      паролем), страница подтверждения, письмо со ссылкой (обе локали).
 *   3. ПУБЛИЧНАЯ СТРАНИЦА `/[lang]/eliminar-cuenta`: не читает сессию, в
 *      карте сайта, и её тексты в ОБЕИХ локалях называют факты кода —
 *      имя приложения, срок ссылки (из `verification-token.ts`), срок
 *      резервных копий (из `backup.ts`), почту поддержки, адрес центра
 *      подписок. Ссылка на неё — из профиля.
 *   4. ГЛАВНАЯ после `?accountDeleted=1` говорит, что аккаунт удалён.
 *   5. ЖИВАЯ ПОЛОВИНА (`--base=…`): обе страницы отвечают 200 гостю и
 *      оболочке и несут факты; главная с параметром несёт строку, без
 *      параметра — нет (встроенный контроль измерителя).
 *
 * Разбор исходников идёт по тексту в памяти — подсадки файлов не пишут.
 *
 *   npx tsx scripts/check-account-deletion.ts                  # статическая
 *   npx tsx scripts/check-account-deletion.ts --plant          # её контроль
 *   npx tsx scripts/check-account-deletion.ts --base=http://…  # живая (+ --plant)
 */
import { readFileSync } from "node:fs";
import { hasRenewingStoreSubscription } from "../src/lib/store-subscription";
import {
  ACCOUNT_DELETION_COPY,
  ACCOUNT_DELETION_PATH,
  APP_NAME,
  PLAY_SUBSCRIPTIONS_URL,
  SUPPORT_EMAIL,
} from "../src/lib/legal/account-deletion";
import { isEntryPoint } from "../src/lib/entry-point";

const PROFILE = "src/app/[lang]/profile/page.tsx";
const CONFIRM = "src/app/[lang]/confirm-delete-account/page.tsx";
const EMAIL = "src/app/api/auth/request-account-deletion/route.ts";
const PAGE = "src/app/[lang]/eliminar-cuenta/page.tsx";
const SITEMAP = "src/app/sitemap.ts";
const HOME = "src/app/[lang]/page.tsx";
const TOKEN = "src/lib/verification-token.ts";
const BACKUP = "src/lib/backup.ts";
const FILES = [PROFILE, CONFIRM, EMAIL, PAGE, SITEMAP, HOME, TOKEN, BACKUP] as const;
type Sources = Record<(typeof FILES)[number], string>;

function readSources(): Sources {
  return Object.fromEntries(FILES.map((f) => [f, readFileSync(f, "utf8")])) as Sources;
}

function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/** Факты кода, которые обязана назвать страница. */
function facts(src: Sources) {
  const ttl = /delete_account:\s*(\d+)\s*\*\s*60\s*\*\s*1000/.exec(src[TOKEN]);
  const backup = /const RETENTION_COUNT = (\d+);/.exec(src[BACKUP]);
  return { linkMinutes: ttl ? Number(ttl[1]) : NaN, backupDays: backup ? Number(backup[1]) : NaN };
}

type Copy = typeof ACCOUNT_DELETION_COPY;

export function judgeStatic(src: Sources, copy: Copy = ACCOUNT_DELETION_COPY): string[] {
  const problems: string[] = [];
  const live = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, withoutComments(v)])) as Sources;

  // 1. Правило исполняется.
  const day = 86_400_000;
  const future = new Date(Date.now() + 30 * day);
  const past = new Date(Date.now() - day);
  const row = (o: Partial<{ provider: string; plan: string; status: string; currentPeriodEnd: Date; canceledAt: Date | null }>) => ({
    provider: "revenuecat",
    plan: "monthly",
    status: "active",
    currentPeriodEnd: future,
    canceledAt: null,
    ...o,
  });
  const cases: [string, ReturnType<typeof row>[], boolean][] = [
    ["Google Play, активна", [row({})], true],
    ["Google Play, пробный период", [row({ status: "trialing" })], true],
    ["Google Play, продление уже отменено", [row({ canceledAt: new Date() })], false],
    ["Google Play, истекла", [row({ currentPeriodEnd: past })], false],
    ["Google Play, Premium (разовая)", [row({ plan: "lifetime" })], false],
    ["Stripe, активна", [row({ provider: "stripe" })], false],
    ["строк нет", [], false],
  ];
  for (const [name, rows, want] of cases) {
    if (hasRenewingStoreSubscription(rows) !== want) {
      problems.push(`правило hasRenewingStoreSubscription: «${name}» → ${!want}, а должно ${want}`);
    }
  }

  // 2. Три места подтверждения.
  const danger = live[PROFILE].indexOf("dict.profile.dangerZoneHeading");
  const warn = live[PROFILE].indexOf("<PlayDeletionWarning", danger);
  const form = live[PROFILE].indexOf("<DeleteAccountForm", danger);
  if (danger < 0 || form < 0) problems.push(`${PROFILE}: не найдены «Zona de riesgo» и форма удаления — перечитайте сторож`);
  else if (warn < 0 || warn > form) problems.push(`${PROFILE}: в «Zona de riesgo» нет предупреждения про Google Play ДО формы с паролем`);
  if (!/hasRenewingStoreSubscription\(subscriptionHistory\)/.test(live[PROFILE])) {
    problems.push(`${PROFILE}: предупреждение не спрашивает hasRenewingStoreSubscription по всем строкам подписок`);
  }
  if (!live[PROFILE].includes("ACCOUNT_DELETION_PATH")) problems.push(`${PROFILE}: нет ссылки на страницу удаления`);
  if (!/<PlayDeletionWarning/.test(live[CONFIRM]) || !/hasRenewingStoreSubscription\(/.test(live[CONFIRM])) {
    problems.push(`${CONFIRM}: страница подтверждения не предупреждает про подписку Google Play`);
  }
  if (!/"unknown"/.test(live[CONFIRM])) {
    problems.push(`${CONFIRM}: без входа (ссылка из письма в браузере) предупреждение не показывается вовсе`);
  }
  if (!/hasRenewingStoreSubscription\(/.test(live[EMAIL]) || !live[EMAIL].includes('${playLine("es")}') || !live[EMAIL].includes('${playLine("ru")}')) {
    problems.push(`${EMAIL}: письмо подтверждения не предупреждает про Google Play в обеих локалях`);
  }

  // 3. Публичная страница.
  if (/getCurrentUser|redirect\(|cookies\(\)/.test(live[PAGE])) {
    problems.push(`${PAGE}: страница удаления читает сессию или уводит — она обязана открываться без входа`);
  }
  if (!live[SITEMAP].includes(`"${ACCOUNT_DELETION_PATH}"`)) problems.push(`${SITEMAP}: страницы удаления нет в карте сайта`);
  const f = facts(src);
  for (const locale of ["es", "ru"] as const) {
    const c = copy[locale];
    const all = [c.title, c.intro, ...c.sections.flatMap((s) => [s.heading, ...(s.paragraphs ?? []), ...(s.items ?? [])])].join("\n");
    const minutes = locale === "es" ? `${f.linkMinutes} minutos` : `${f.linkMinutes} минут`;
    const days = locale === "es" ? `${f.backupDays} días` : `${f.backupDays} дней`;
    for (const [what, needle] of [
      ["имя приложения", APP_NAME],
      ["почта поддержки (способ без приложения и пароля)", SUPPORT_EMAIL],
      ["адрес центра подписок Google Play", PLAY_SUBSCRIPTIONS_URL],
      [`срок ссылки из ${TOKEN}`, minutes],
      ["сайт", "rusofacilapp.com"],
    ] as const) {
      if (!all.includes(needle)) problems.push(`страница удаления /${locale}: не названо — ${what} («${needle}»)`);
    }
    // Срок копий судится В ФРАЗЕ О КОПИЯХ, а не где угодно: «30 días» в
    // тексте уже есть (срок ответа поддержки), и поиск по всей странице
    // принял бы его за срок копий — поймано подсадкой «копии стали 30 дней».
    const backupLine = all.split("\n").find((l) => /copias de seguridad|резервные копии/i.test(l)) ?? "";
    if (!backupLine.includes(days)) {
      problems.push(`страница удаления /${locale}: фраза о резервных копиях не называет срок из ${BACKUP} («${days}»)`);
    }
    if (!c.sections.some((s) => s.ordered && (s.items?.length ?? 0) >= 3)) {
      problems.push(`страница удаления /${locale}: нет нумерованных шагов`);
    }
  }

  // 4. Главная после удаления.
  if (!/\(await searchParams\)\.accountDeleted === "1"/.test(live[HOME]) || !live[HOME].includes("deletedNotice")) {
    problems.push(`${HOME}: после ?accountDeleted=1 главная молчит, что аккаунт удалён`);
  }
  return problems;
}

async function fetchText(url: string, shell: boolean): Promise<{ status: number; html: string }> {
  const ua = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36";
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": shell ? `${ua} RFNativeShell/13` : ua },
    signal: AbortSignal.timeout(60_000),
  });
  return { status: res.status, html: await res.text() };
}

/** Судит отдачу. Отдельная функция — чтобы подсадка подала ей испорченный HTML. */
export function judgeLive(pages: { what: string; status: number; html: string; mustHave: string[]; mustNot?: string[] }[]): string[] {
  const problems: string[] = [];
  for (const p of pages) {
    if (p.status !== 200) {
      problems.push(`${p.what}: ответ ${p.status}, а нужен 200 без входа`);
      continue;
    }
    for (const needle of p.mustHave) if (!p.html.includes(needle)) problems.push(`${p.what}: нет «${needle.slice(0, 60)}»`);
    for (const needle of p.mustNot ?? []) if (p.html.includes(needle)) problems.push(`${p.what}: есть «${needle.slice(0, 60)}», которого быть не должно`);
  }
  return problems;
}

async function livePages(base: string) {
  const out: Parameters<typeof judgeLive>[0] = [];
  for (const locale of ["es", "ru"] as const) {
    const c = ACCOUNT_DELETION_COPY[locale];
    for (const shell of [false, true]) {
      const tag = shell ? "оболочка" : "браузер";
      const page = await fetchText(`${base}/${locale}${ACCOUNT_DELETION_PATH}`, shell);
      out.push({
        what: `/${locale}${ACCOUNT_DELETION_PATH} (${tag}, гость)`,
        ...page,
        mustHave: [c.title, APP_NAME, SUPPORT_EMAIL, PLAY_SUBSCRIPTIONS_URL, "data-rf-account-deletion-page"],
      });
      const home = await fetchText(`${base}/${locale}?accountDeleted=1`, shell);
      out.push({ what: `/${locale}?accountDeleted=1 (${tag})`, ...home, mustHave: [c.deletedNotice] });
      // Встроенный контроль: без параметра строки нет — измеритель умеет сказать «нет».
      const plain = await fetchText(`${base}/${locale}`, shell);
      out.push({ what: `/${locale} без параметра (${tag})`, ...plain, mustHave: [], mustNot: [c.deletedNotice] });
    }
  }
  return out;
}

function plants(): [string, (s: Sources) => Sources | null, Copy | null, string][] {
  const edit = (file: keyof Sources, from: string | RegExp, to: string) => (s: Sources) => {
    const next = s[file].replace(from, to);
    return next === s[file] ? null : { ...s, [file]: next };
  };
  const copyWithout = (locale: "es" | "ru", needle: string): Copy => {
    const c = structuredClone(ACCOUNT_DELETION_COPY);
    c[locale].sections = c[locale].sections.map((sec) => ({
      ...sec,
      paragraphs: sec.paragraphs?.map((p) => p.split(needle).join("")),
      items: sec.items?.map((p) => p.split(needle).join("")),
    }));
    c[locale].intro = c[locale].intro.split(needle).join("");
    return c;
  };
  return [
    ["предупреждение убрано из «Zona de riesgo»", edit(PROFILE, /<PlayDeletionWarning[^>]*\/>/, "null"), null, "ДО формы"],
    ["предупреждение переехало ПОСЛЕ формы с паролем", (s) => {
      const m = /\{hasRenewingStoreSubscription\(subscriptionHistory\) \?[\s\S]*?\)\}\n/.exec(s[PROFILE]);
      if (!m) return null;
      const without = s[PROFILE].replace(m[0], "");
      const i = without.indexOf("</DeleteAccountForm>") >= 0 ? without.indexOf("</DeleteAccountForm>") : without.indexOf("/>", without.indexOf("<DeleteAccountForm")) + 2;
      return { ...s, [PROFILE]: without.slice(0, i) + "\n" + m[0] + without.slice(i) };
    }, null, "ДО формы"],
    ["страница подтверждения снова без предупреждения", edit(CONFIRM, /<PlayDeletionWarning[\s\S]*?\/>/, "null"), null, "страница подтверждения не предупреждает"],
    ["письмо без строки про Google Play в русской части", edit(EMAIL, '${playLine("ru")}', ""), null, "письмо подтверждения"],
    ["страница удаления стала требовать вход", edit(PAGE, "const copy = accountDeletionCopy(lang);", 'const copy = accountDeletionCopy(lang);\n  if (!(await getCurrentUser())) redirect("/login");'), null, "без входа"],
    ["страницы удаления нет в карте сайта", edit(SITEMAP, `"${ACCOUNT_DELETION_PATH}",`, ""), null, "карте сайта"],
    ["ссылка стала жить 60 минут, а страница говорит 30", edit(TOKEN, /delete_account:\s*30 \* 60 \* 1000/, "delete_account: 60 * 60 * 1000"), null, "60 minutos"],
    ["резервные копии стали жить 30 дней, а страница говорит 14", edit(BACKUP, "const RETENTION_COUNT = 14;", "const RETENTION_COUNT = 30;"), null, "30 días"],
    ["из русской страницы пропала почта поддержки", (s) => s, copyWithout("ru", SUPPORT_EMAIL), "/ru: не названо — почта"],
    ["из испанской страницы пропал адрес центра подписок", (s) => s, copyWithout("es", PLAY_SUBSCRIPTIONS_URL), "/es: не названо — адрес центра"],
    ["главная снова молчит после удаления", edit(HOME, '(await searchParams).accountDeleted === "1"', "false"), null, "главная молчит"],
  ];
}

async function main(): Promise<number> {
  const plant = process.argv.includes("--plant");
  const baseArg = process.argv.find((a) => a.startsWith("--base="));
  const src = readSources();

  if (baseArg) {
    const base = baseArg.slice("--base=".length);
    const pages = await livePages(base);
    if (plant) {
      const clean = judgeLive(pages).length === 0;
      const spoiled = pages.map((p) => ({ ...p, html: p.html.replace("data-rf-account-deletion-page", "").split(ACCOUNT_DELETION_COPY.es.deletedNotice).join("") }));
      const caught = judgeLive(spoiled).length;
      const withNotice = pages.map((p) => (p.mustNot?.length ? { ...p, html: p.html + p.mustNot[0] } : p));
      const caughtNot = judgeLive(withNotice).length;
      const ok = clean && caught >= 6 && caughtNot === 4;
      console.log(`  ${clean ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящая отдача (отрицательный контроль)`);
      console.log(`  поймано ${caught} — страница без признака и главная /es без строки (ожидалось ≥ 6)`);
      console.log(`  поймано ${caughtNot} из 4 — строка «удалён» на главной без параметра`);
      console.log(ok ? "check:account-deletion --base --plant — подсадки пойманы" : "check:account-deletion --base --plant — FAILED");
      return ok ? 0 : 1;
    }
    const problems = judgeLive(pages);
    if (problems.length) {
      console.error("check:account-deletion (живая) — ОТКАЗ:");
      for (const p of problems) console.error(`  ${p}`);
      return 1;
    }
    console.log(`check:account-deletion (живая) — ${pages.length} ответов: страница удаления 200 гостю в браузере и оболочке, обе локали; «cuenta eliminada» на главной только с параметром.`);
    return 0;
  }

  if (plant) {
    let ok = judgeStatic(src).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — настоящие исходники (отрицательный контроль)`);
    let caught = 0;
    const list = plants();
    for (const [name, patch, copy, expected] of list) {
      const patched = patch(src);
      if (!patched) {
        console.log(`  НЕ ПРИМЕНИЛАСЬ — ${name} (подсадка не нашла место)`);
        ok = false;
        continue;
      }
      // Поймано ТЕМ правилом, ради которого подсадка написана, а не соседним.
      const found = judgeStatic(patched, copy ?? ACCOUNT_DELETION_COPY).filter((m) => m.includes(expected));
      if (found.length) caught++;
      console.log(`  ${found.length ? "поймано" : "ПРОПУЩЕНО"} — ${name}${found.length ? ` (${found[0].slice(0, 90)})` : ""}`);
    }
    ok &&= caught === list.length;
    console.log(ok ? `check:account-deletion --plant — ${caught} из ${list.length} подсадок, 1 из 1 отрицательный контроль` : "check:account-deletion --plant — FAILED");
    return ok ? 0 : 1;
  }

  const problems = judgeStatic(src);
  if (problems.length) {
    console.error("check:account-deletion — ОТКАЗ:");
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  const f = facts(src);
  console.log(
    `check:account-deletion — правило «подписка Google Play продлевается» верно на 7 строках; предупреждение стоит в форме ` +
      `(до пароля), на странице подтверждения (и без входа) и в письме (es, ru); страница ${ACCOUNT_DELETION_PATH} без входа, ` +
      `в карте сайта, называет ссылку на ${f.linkMinutes} минут и копии на ${f.backupDays} дней в обеих локалях; главная ` +
      `говорит «аккаунт удалён». Контроль — --plant; живая половина — --base=.`,
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
