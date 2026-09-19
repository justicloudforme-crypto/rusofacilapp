/**
 * ПОДПИСЬ ТАРИФА НАЗЫВАЕТ ПОСЛЕДНЕЕ СОБЫТИЕ — ДОЛГ 102 (заход 7.217).
 *
 * Строка долга дословно: «подпись тарифа называет того, кто строку
 * **создал**, а не последнее событие с ней: `extendOrGrantSubscription`
 * продлевает любую живую непремиальную строку, не глядя на её план. Код,
 * погашенный поверх живой ручной выдачи, продлит строку `"manual"` и
 * подписи не сменит; ручная выдача поверх кода оставит `"access_code"`».
 *
 * ЧТО НАШЁЛ РАЗБОР 19.09.2026, и почему строка всё-таки закрыта кодом, а
 * не отложена доводом «подпись читает один человек в месяц». Цена была не
 * только в слове на экране. `isGrantSubscription` судит по двум условиям —
 * план не из оплаченных И подписки в кассе нет. У покупки через OXXO
 * подписки в кассе нет по построению, поэтому ОПЛАЧЕННЫЙ месяц, легший
 * продлением на живую строку `"manual"`, оставался подписан выдачей: не
 * попадал в «Historial de pagos» и показывал кнопку отмены там, где
 * отменять нечего. Это неверная запись о деньгах, а не вкусовщина.
 *
 * ТРИ ПРАВИЛА:
 *   а) ветка продления в `extendOrGrantSubscription` пишет `plan` — то
 *      есть подпись обновляется, а не остаётся от создателя строки;
 *   б) отбор строки-цели по-прежнему требует совпадения премиальности
 *      (`isPremiumPlan(row.plan) === premiumGrant`) — без него переписанный
 *      план менял бы РЕШЕНИЕ О ДОСТУПЕ, а не подпись;
 *   в) ни одна другая запись в `src/` не заводит второй способ узнать
 *      «кто выдал»: колонки `grantSource`/`lastGrantPlan` в схеме нет.
 *
 * ЧЕГО НЕ ОБЕЩАЕТ: сторож читает код, а не базу. Что продление
 * действительно переписывает значение, проверяет юнит-тест
 * `src/lib/subscription.plan-signature.test.ts`.
 *
 *   node scripts/check-plan-signature.mjs          # гейт
 *   node scripts/check-plan-signature.mjs --plant  # контроль
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.slice(2).includes("--plant");
const LIB = "src/lib/subscription.ts";
const SCHEMA = "prisma/schema.prisma";

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

/** Тело `db.subscription.update({...})` из ветки продления. */
function extendBranch(lib) {
  const fn = /export async function extendOrGrantSubscription\(([\s\S]*?)\n\}/.exec(lib)?.[0] ?? "";
  const upd = /await db\.subscription\.update\(\{([\s\S]*?)\n    \}\);/.exec(fn)?.[1] ?? "";
  return { fn, upd };
}

export function violations(libRaw, schemaRaw) {
  const lib = stripComments(libRaw);
  const schema = stripComments(schemaRaw);
  const bad = [];
  const { fn, upd } = extendBranch(lib);
  if (!fn) {
    bad.push(`${LIB}: объявления extendOrGrantSubscription не найдено — сторож ослеп, а не доволен`);
    return bad;
  }
  if (!upd) {
    bad.push(`${LIB}: ветки продления (db.subscription.update) в extendOrGrantSubscription нет`);
  } else if (!/^\s*plan,\s*$/m.test(upd) && !/\bplan\s*:/.test(upd)) {
    bad.push(`${LIB}: продление не переписывает plan — подпись снова называет СОЗДАТЕЛЯ строки (долг 102)`);
  }
  if (!/isPremiumPlan\(row\.plan\) === premiumGrant/.test(fn)) {
    bad.push(`${LIB}: отбор строки-цели больше не требует совпадения премиальности — переписанный план менял бы доступ, а не подпись (долг 102)`);
  }
  if (!schema) {
    bad.push(`${SCHEMA}: схема не прочитана — сторож ослеп`);
  } else if (/\n\s*(grantSource|lastGrantPlan|lastGrantSource)\s/.test(schema)) {
    bad.push(`${SCHEMA}: заведена вторая колонка о том, «кто выдал» — второй источник подписи расходится с первым молча (долг 102)`);
  }
  return bad;
}

function plant() {
  const lib = readFileSync(LIB, "utf8");
  const schema = readFileSync(SCHEMA, "utf8");
  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(lib, schema).length === 0 }];
  const add = (name, l, s, expect) => {
    if (l === lib && s === schema) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(l, s).some((f) => f.includes(expect)) });
  };

  add(
    "подсадка: продление перестало переписывать plan (состояние до 19.09.2026)",
    lib.replace(/\n        plan,\n        \/\/ The LATEST payment/, "\n        // The LATEST payment"),
    schema,
    "снова называет СОЗДАТЕЛЯ строки",
  );
  add(
    "подсадка: премиальность перестала совпадать при отборе цели",
    lib.replace("isPremiumPlan(row.plan) === premiumGrant", "true"),
    schema,
    "совпадения премиальности",
  );
  add(
    "подсадка: ветка продления снесена целиком",
    lib.replace(/await db\.subscription\.update\(\{[\s\S]*?\n    \}\);/, "// ничего"),
    schema,
    "ветки продления",
  );
  add(
    "подсадка: заведена вторая колонка подписи в схеме",
    lib,
    schema.replace("model Subscription {", "model Subscription {\n  lastGrantSource String?"),
    "вторая колонка",
  );

  for (const c of cases) {
    const verdict = c.ok ? (c.name.startsWith("отрицательный") ? "молчит" : "поймано") : "ПРОПУЩЕНО";
    console.log(`  ${verdict} — ${c.name}`);
  }
  const ok = cases.every((c) => c.ok);
  console.log(ok ? `check:plan-signature --plant — ${cases.length - 1} из ${cases.length - 1} подсадок, 1 из 1 отрицательный контроль` : "check:plan-signature --plant — FAILED");
  process.exitCode = ok ? 0 : 1;
}

function gate() {
  const read = (p) => {
    try {
      return readFileSync(p, "utf8");
    } catch {
      return "";
    }
  };
  const bad = violations(read(LIB), read(SCHEMA));
  if (bad.length) {
    console.error(`check:plan-signature — ОТКАЗ, нарушений ${bad.length}:`);
    for (const b of bad) console.error(`  ${b}`);
    process.exitCode = 1;
    return;
  }
  console.log("check:plan-signature — 3 правила, нарушений 0: подпись тарифа называет последнее событие (долг 102)");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (PLANT) plant();
  else gate();
}
