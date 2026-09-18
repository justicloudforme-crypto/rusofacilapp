/**
 * ЯЗЫК ПО ЗАГОЛОВКУ УСТРОЙСТВА — ОДНА ФУНКЦИЯ И ТАБЛИЦА ЗНАЧЕНИЙ (ДОЛГ 155).
 *
 * ЧТО СТОРОЖИТСЯ. Посетитель, пришедший на адрес БЕЗ префикса локали (а
 * нативная оболочка грузит именно такой — корневой), уезжает на `/es` или
 * на `/ru` по заголовку `Accept-Language`. Решение это принимается для
 * КАЖДОГО адреса сайта, а до 18.09.2026 оно не было накрыто ни юнитом, ни
 * пробой: функция жила приватной внутри `src/proxy.ts`.
 *
 * ДВЕ ПОЛОВИНЫ, обе обязаны краснеть по отдельности.
 *
 * 1. ПОВЕДЕНЧЕСКАЯ. Таблица из 18 значений заголовка прогоняется через
 *    `preferredLocaleFromHeader` и сверяется со списком ожиданий. Значения
 *    не выдуманы: четыре из них сняты с живого прода 18.09.2026 (GET `/`,
 *    заголовок `Location` у 307), остальные — те, которых на проде
 *    спросить нельзя без второго выхода в сеть.
 *
 * 2. СТАТИЧЕСКАЯ. `src/proxy.ts` обязан спрашивать эту функцию и не имеет
 *    права разбирать заголовок сам. Без этой половины поведенческая
 *    проверяла бы модуль, которым никто не пользуется: ровно так дыра и
 *    прожила — разбор был на месте, а спросить его было нечем.
 *
 *   npx tsx scripts/check-device-locale.ts
 *   npx tsx scripts/check-device-locale.ts --plant          # контроль
 *   npx tsx scripts/check-device-locale.ts --proxy=<файл>   # проверить чужую копию proxy.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isEntryPoint } from "@/lib/entry-point";
import { preferredLocaleFromHeader } from "@/lib/preferred-locale";
import { defaultLocale, isLocale } from "@/i18n/config";

type Decide = (header: string | null | undefined) => string;

interface Case {
  header: string | null;
  expect: "es" | "ru";
  why: string;
}

/** Снято с прода 18.09.2026 — помечено «(прод)». Остальное — правило. */
const CASES: Case[] = [
  { header: "es-MX,es;q=0.9", expect: "es", why: "испанский телефон (прод)" },
  { header: "ru-RU,ru;q=0.9", expect: "ru", why: "русский телефон (прод)" },
  { header: "pt-BR,pt;q=0.9", expect: "es", why: "ТРЕТИЙ язык системы — португальский (прод)" },
  { header: "en-US,en;q=0.9", expect: "es", why: "третий язык системы — английский (прод)" },
  { header: null, expect: "es", why: "заголовка нет вовсе" },
  { header: "", expect: "es", why: "заголовок пуст" },
  { header: "de-DE,de;q=0.9,fr;q=0.8", expect: "es", why: "двух чужих языков подряд нам мало" },
  { header: "zh-Hans-CN,zh;q=0.9", expect: "es", why: "тег из трёх частей" },
  { header: "en-US,ru;q=0.3,es;q=0.9", expect: "es", why: "ВЕС решает, а не порядок — это и была дыра" },
  { header: "es;q=0.2,ru;q=0.8", expect: "ru", why: "вес решает и в обратную сторону" },
  { header: "ru;q=0.8,es;q=0.2", expect: "ru", why: "вес и порядок согласны" },
  { header: "ru,es", expect: "ru", why: "веса равны — остаётся порядок" },
  { header: "es,ru", expect: "es", why: "веса равны — остаётся порядок" },
  { header: "en,ru;q=0.5,es;q=0.5", expect: "ru", why: "равные веса, первым назван русский" },
  { header: "ru;q=0,es;q=0.1", expect: "es", why: "q=0 — «не предлагать», а не «слабее»" },
  { header: "ru;q=0,es;q=0", expect: "es", why: "отказались от обоих — молчаливый ответ испанский" },
  { header: "*", expect: "es", why: "звёздочка — «любой», то есть наш молчаливый" },
  { header: ",,;;,", expect: "es", why: "мусор не роняет разбор" },
];

function behaviour(decide: Decide): string[] {
  const bad: string[] = [];
  for (const c of CASES) {
    const got = decide(c.header);
    if (got !== c.expect) {
      bad.push(`«${c.header ?? "<нет заголовка>"}» → ${got}, ожидалось ${c.expect} (${c.why})`);
    }
  }
  return bad;
}

const PROXY_DEFAULT = join(process.cwd(), "src", "proxy.ts");

/** Половина вторая: кто именно решает язык в `src/proxy.ts`. */
export function statics(proxyText: string): string[] {
  const bad: string[] = [];
  if (!/from\s+"@\/lib\/preferred-locale"/.test(proxyText)) {
    bad.push("src/proxy.ts не берёт разбор из @/lib/preferred-locale — решение снова в двух местах");
  }
  if (!/preferredLocaleFromHeader\s*\(/.test(proxyText)) {
    bad.push("src/proxy.ts не зовёт preferredLocaleFromHeader — модуль есть, пользователя нет");
  }
  // Свой разбор узнаётся по связке «взял заголовок → режет по ';'».
  const reads = /headers\.get\(\s*"accept-language"\s*\)/.test(proxyText);
  if (reads && /split\(\s*";"\s*\)/.test(proxyText)) {
    bad.push("src/proxy.ts разбирает Accept-Language сам — именно так долг 155 и прожил");
  }
  return bad;
}

/** Разбор, как он был в `src/proxy.ts` ДО правки, слово в слово. Живёт
 * здесь ради контроля: проверка обязана уметь на нём покраснеть. */
function legacyDecide(header: string | null | undefined): string {
  if (!header) return defaultLocale;
  const preferred = header
    .split(",")
    .map((part) => part.split(";")[0]?.trim().toLowerCase())
    .filter(Boolean);
  for (const lang of preferred) {
    const short = (lang as string).split("-")[0];
    if (isLocale(short)) return short;
  }
  return defaultLocale;
}

function plant(): void {
  let ok = true;
  const say = (name: string, caught: number, expectCaught: boolean) => {
    const verdict = expectCaught ? (caught > 0 ? "ПОЙМАНО" : "ПРОПУЩЕНО") : caught === 0 ? "ЧИСТО" : "ЛОЖНАЯ ТРЕВОГА";
    console.log(`  подсадка «${name}» → находок ${caught}: ${verdict}`);
    if (expectCaught ? caught === 0 : caught !== 0) ok = false;
  };

  say("прежний разбор по порядку (настоящий код до правки)", behaviour(legacyDecide).length, true);
  say("ответ всегда испанский (правка, которая просто игнорирует телефон)", behaviour(() => "es").length, true);
  say("ответ всегда русский", behaviour(() => "ru").length, true);
  say("настоящий разбор", behaviour(preferredLocaleFromHeader).length, false);

  const proxy = readFileSync(PROXY_DEFAULT, "utf8");
  say("настоящий src/proxy.ts", statics(proxy).length, false);
  say(
    "proxy.ts потерял вызов и разбирает сам",
    statics(
      proxy
        .replace(/import \{ preferredLocaleFromHeader \}.*\n/, "")
        .replace(/preferredLocaleFromHeader\s*\(/g, "ownParse(")
        .replace(
          /return ownParse\(request\.headers\.get\("accept-language"\)\);/,
          'const h = request.headers.get("accept-language"); return (h ?? "").split(",")[0]!.split(";")[0]!;',
        ),
    ).length,
    true,
  );

  console.log(ok ? "[check:device-locale] контроль пройден: проверка умеет краснеть на каждом входе" : "[check:device-locale] КОНТРОЛЬ ПРОВАЛЕН");
  if (!ok) process.exitCode = 1;
}

function main(argv: string[]): void {
  if (argv.includes("--plant")) return plant();

  const proxyArg = argv.find((a) => a.startsWith("--proxy="));
  const proxyPath = proxyArg ? proxyArg.slice("--proxy=".length) : PROXY_DEFAULT;

  const bad = [...behaviour(preferredLocaleFromHeader), ...statics(readFileSync(proxyPath, "utf8"))];
  console.log(
    `[check:device-locale] значений заголовка ${CASES.length}, расхождений ${bad.length}; ` +
      `решает язык ${proxyPath === PROXY_DEFAULT ? "src/proxy.ts" : proxyPath}`,
  );
  for (const line of bad) console.log(`  ${line}`);
  if (bad.length) process.exitCode = 1;
  else console.log("  третий язык системы получает испанский, вес q решает раньше порядка (контроль — --plant)");
}

if (isEntryPoint(import.meta.url)) main(process.argv.slice(2));
