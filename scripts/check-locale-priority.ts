/**
 * ПОРЯДОК ИСТОЧНИКОВ ЯЗЫКА — ЗАПОМНЕННЫЙ ВЫБОР СИЛЬНЕЕ УСТРОЙСТВА (7.214).
 *
 * ЧТО СТОРОЖИТСЯ И ЗАЧЕМ. Посетитель приходит на адрес БЕЗ префикса
 * локали (нативная оболочка грузит именно такой — корневой), и язык ему
 * выбирают три источника подряд: запомненный выбор (кука `rf-lang`),
 * заголовок устройства `Accept-Language`, молчаливый ответ `es`.
 * ПОРЯДОК этих трёх — правило продукта, а не деталь реализации: наоборот
 * и была жалоба 7.198 (выбранный русский не переживал перезапуск
 * приложения), и наоборот же 18.09.2026 выглядело бы дефектом
 * наблюдение владельца, у которого испанский телефон открыл `/ru`.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ СТОРОЖ, КОГДА РЯДОМ УЖЕ ДВА. Числом:
 *   · `check:device-locale` (7.213) смотрит ТОЛЬКО заголовок и про куку
 *     не знает вовсе — поменяй источники местами, он останется зелёным;
 *   · `check:remembered-locale` (7.198) порядок проверяет, но это
 *     браузерная проба на поднятом сервере, и она не стоит НИ в
 *     `npm run verify`, НИ в `ci.yml` — в CI исполняется 0 раз.
 * То есть правило было записано в коде и не было накрыто ничем, что
 * действительно гоняется.
 *
 * ДВЕ ПОЛОВИНЫ, обе обязаны краснеть по отдельности.
 *
 * 1. ПОВЕДЕНЧЕСКАЯ. Таблица пар «что запомнено × что сказало
 *    устройство» прогоняется через `localeDecision` и сверяется с
 *    ожиданиями. Семь строк сняты с ЖИВОГО ПРОДА 18.09.2026 (GET `/`,
 *    заголовок `Location` у 307) и помечены «(прод)».
 *
 * 2. СТАТИЧЕСКАЯ. `src/proxy.ts` обязан спрашивать эту функцию и НЕ
 *    имеет права выбирать между источниками сам: ни `??`, ни `||` между
 *    запомненным и заголовком. Без этой половины поведенческая
 *    проверяла бы модуль, которым никто не пользуется, — ровно так дыра
 *    долга 155 и прожила.
 *
 *   npx tsx scripts/check-locale-priority.ts
 *   npx tsx scripts/check-locale-priority.ts --plant          # контроль
 *   npx tsx scripts/check-locale-priority.ts --proxy=<файл>   # чужая копия
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isEntryPoint } from "@/lib/entry-point";
import { localeDecision, type LocaleSourceName } from "@/lib/locale-decision";
import { preferredLocaleFromHeader } from "@/lib/preferred-locale";
import { rememberedLocale } from "@/lib/remembered-locale";
import { defaultLocale } from "@/i18n/config";

type Decide = (sources: { remembered: string | null; acceptLanguage: string | null }) => {
  locale: string;
  source?: LocaleSourceName;
};

interface Case {
  remembered: string | null;
  acceptLanguage: string | null;
  expect: "es" | "ru";
  source: LocaleSourceName;
  why: string;
}

const CASES: Case[] = [
  // Семь обязательных строк промта 7.214 — все сняты с живого прода.
  { remembered: "ru", acceptLanguage: "es-MX,es;q=0.9", expect: "ru", source: "remembered", why: "НАБЛЮДЕНИЕ ВЛАДЕЛЬЦА: испанский телефон, выбран русский (прод)" },
  { remembered: "ru", acceptLanguage: "en-US,en;q=0.9", expect: "ru", source: "remembered", why: "запомнен ru, устройство английское (прод)" },
  { remembered: "es", acceptLanguage: "ru-RU,ru;q=0.9", expect: "es", source: "remembered", why: "и в обратную сторону: запомнен es, устройство русское (прод)" },
  { remembered: null, acceptLanguage: "es-MX,es;q=0.9", expect: "es", source: "device", why: "не запомнено — решает устройство (прод)" },
  { remembered: null, acceptLanguage: "en-US,en;q=0.9", expect: "es", source: "default", why: "не запомнено, третий язык системы — молчаливый ответ (прод)" },
  { remembered: null, acceptLanguage: "ru-RU,ru;q=0.9", expect: "ru", source: "device", why: "не запомнено, устройство русское (прод)" },
  { remembered: null, acceptLanguage: null, expect: "es", source: "default", why: "не запомнено и заголовка нет вовсе (прод)" },
  // Границы самой куки — их на проде спрашивать не надо, они правило.
  { remembered: "ru", acceptLanguage: null, expect: "ru", source: "remembered", why: "запомнено, заголовка нет — кука работает и в одиночку (прод)" },
  { remembered: "xx", acceptLanguage: "ru-RU,ru;q=0.9", expect: "ru", source: "device", why: "ЧУЖОЕ значение куки читается как «не запомнено», а не как ошибка (прод)" },
  { remembered: "", acceptLanguage: "es-MX,es;q=0.9", expect: "es", source: "device", why: "пустая кука — то же самое" },
  { remembered: "RU", acceptLanguage: "es-MX,es;q=0.9", expect: "es", source: "device", why: "регистр не наш: список локалей один и он в нижнем регистре" },
  { remembered: "ru", acceptLanguage: "en-US,ru;q=0.3,es;q=0.9", expect: "ru", source: "remembered", why: "кука сильнее даже верно разобранного веса q" },
  { remembered: null, acceptLanguage: "en-US,ru;q=0.3,es;q=0.9", expect: "es", source: "device", why: "куки нет — решает вес q, а не порядок (прод, долг 155)" },
];

function behaviour(decide: Decide, checkSource: boolean): string[] {
  const bad: string[] = [];
  for (const c of CASES) {
    const got = decide({ remembered: c.remembered, acceptLanguage: c.acceptLanguage });
    const where = `запомнено «${c.remembered ?? "<нет>"}» + заголовок «${c.acceptLanguage ?? "<нет>"}»`;
    if (got.locale !== c.expect) {
      bad.push(`${where} → /${got.locale}, ожидалось /${c.expect} (${c.why})`);
      continue;
    }
    if (checkSource && got.source !== c.source) {
      bad.push(`${where} → ответ верный, но его дал источник «${got.source}» вместо «${c.source}» (${c.why})`);
    }
  }
  return bad;
}

const PROXY_DEFAULT = join(process.cwd(), "src", "proxy.ts");

/** Половина вторая: кто именно решает порядок в `src/proxy.ts`. */
export function statics(proxyText: string): string[] {
  const bad: string[] = [];
  if (!/from\s+"@\/lib\/locale-decision"/.test(proxyText)) {
    bad.push("src/proxy.ts не берёт решение из @/lib/locale-decision — порядок источников снова в двух местах");
  }
  if (!/localeForPrefixlessPath\s*\(/.test(proxyText)) {
    bad.push("src/proxy.ts не зовёт localeForPrefixlessPath — модуль есть, пользователя нет");
  }
  // Собственный выбор между источниками узнаётся по связке
  // «запомненное значение → `??`/`||` → что-то ещё» в одной строке.
  for (const line of proxyText.split("\n")) {
    if (/rememberedLocale\s*\(/.test(line) && /(\?\?|\|\|)/.test(line)) {
      bad.push(`src/proxy.ts выбирает между источниками сам: «${line.trim()}» — порядок обязан жить в одном месте`);
    }
    if (/preferredLocaleFromHeader\s*\(/.test(line)) {
      bad.push(`src/proxy.ts зовёт разбор заголовка напрямую, минуя порядок: «${line.trim()}»`);
    }
  }
  return bad;
}

/** Порядок ДО правки 7.214, слово в слово из `src/proxy.ts`, — ради
 *  контроля: перевёрнутый порядок обязан ронять прогон. */
function deviceFirst(sources: { remembered: string | null; acceptLanguage: string | null }) {
  const device = preferredLocaleFromHeader(sources.acceptLanguage);
  return { locale: device, source: "device" as LocaleSourceName };
}

function rememberedOnly(sources: { remembered: string | null; acceptLanguage: string | null }) {
  const remembered = rememberedLocale(sources.remembered ?? undefined);
  return { locale: remembered ?? defaultLocale, source: "remembered" as LocaleSourceName };
}

function plant(): void {
  let ok = true;
  const say = (name: string, caught: number, expectCaught: boolean) => {
    const verdict = expectCaught ? (caught > 0 ? "ПОЙМАНО" : "ПРОПУЩЕНО") : caught === 0 ? "ЧИСТО" : "ЛОЖНАЯ ТРЕВОГА";
    console.log(`  подсадка «${name}» → находок ${caught}: ${verdict}`);
    if (expectCaught ? caught === 0 : caught !== 0) ok = false;
  };

  say("устройство сильнее выбора — порядок перевёрнут (жалоба 7.198)", behaviour(deviceFirst, true).length, true);
  say("кука решает всё, заголовок не спрашивается вовсе", behaviour(rememberedOnly, true).length, true);
  say(
    "чужое значение куки считается запомненным, а не мусором",
    behaviour((s) => {
      const r = s.remembered;
      if (r) return { locale: r === "ru" ? "ru" : "es", source: "remembered" as LocaleSourceName };
      return localeDecision(s);
    }, true).length,
    true,
  );
  say("ответ всегда испанский", behaviour(() => ({ locale: "es", source: "default" }), false).length, true);
  say("настоящий порядок", behaviour(localeDecision, true).length, false);

  const proxy = readFileSync(PROXY_DEFAULT, "utf8");
  say("настоящий src/proxy.ts", statics(proxy).length, false);
  say(
    "proxy.ts выбирает между источниками сам (код ДО правки 7.214)",
    statics(
      proxy
        .replace(/import \{ localeForPrefixlessPath \}.*\n/, 'import { preferredLocaleFromHeader } from "@/lib/preferred-locale";\n')
        .replace(
          /const locale = localeForRoot\(request\);/,
          "const locale = rememberedLocale(request.cookies.get(LOCALE_COOKIE)?.value) ?? preferredLocaleFromHeader(request.headers.get(\"accept-language\"));",
        ),
    ).length,
    true,
  );

  console.log(ok ? "[check:locale-priority] контроль пройден: проверка умеет краснеть на каждом входе" : "[check:locale-priority] КОНТРОЛЬ ПРОВАЛЕН");
  if (!ok) process.exitCode = 1;
}

function main(argv: string[]): void {
  if (argv.includes("--plant")) return plant();

  const proxyArg = argv.find((a) => a.startsWith("--proxy="));
  const proxyPath = proxyArg ? proxyArg.slice("--proxy=".length) : PROXY_DEFAULT;

  const bad = [...behaviour(localeDecision, true), ...statics(readFileSync(proxyPath, "utf8"))];
  console.log(
    `[check:locale-priority] пар «запомнено × устройство» ${CASES.length}, расхождений ${bad.length}; ` +
      `порядок читается из ${proxyPath === PROXY_DEFAULT ? "src/proxy.ts" : proxyPath}`,
  );
  for (const line of bad) console.log(`  ${line}`);
  if (bad.length) process.exitCode = 1;
  else console.log("  запомненный выбор сильнее устройства, устройство сильнее молчаливого ответа (контроль — --plant)");
}

if (isEntryPoint(import.meta.url)) main(process.argv.slice(2));
