/**
 * ВЫДАННЫЙ ДОСТУП — НЕ ПОКУПКА (долг 239, заход 7.206).
 *
 * Что было снято владельцем 17.09.2026 на телефоне, внутри оболочки,
 * аккаунтом `www.petrov.ru_1992@mail.ru` (доступ по коду до 08.12.2026):
 *
 *   • кнопка «Cancelar suscripción» — при том, что отменять нечего:
 *     кассы за этой строкой нет (`stripeSubscriptionId` пуст), она не
 *     продлевается и сама истекает в `currentPeriodEnd`. Нажатие ставило
 *     местной строке `canceledAt` и не меняло ни одного дня доступа;
 *   • та же строка в «Historial de pagos», подписанная ТАРИФОМ, — при
 *     том, что платежа не было вовсе.
 *
 * ЧТО СТОРОЖИТСЯ, И ПОЧЕМУ ИМЕННО ЭТО
 *
 *   1. Признак выдачи считается ОДНОЙ функцией (`isGrantSubscription`), а
 *      не выражением на месте: правило «не покупка и без кассы» обязано
 *      быть одно на кабинет, историю и на любой будущий экран.
 *   2. У выдачи в кабинете НЕТ формы отмены: ветка `grantAccess ? null :`
 *      стоит РАНЬШЕ формы `/api/subscription/cancel` в том же выражении.
 *      Правило по порядку, а не по наличию слова: ветка, приписанная
 *      после формы, кнопку бы не убрала.
 *   3. У выдачи в кабинете нет и кнопки покупки: та же ветка гасит весь
 *      блок органов управления целиком.
 *   4. Строка выдачи в истории подписана выдачей, а не тарифом.
 *   5. НИ ОДНОЙ ССЫЛКИ НА ПОРТАЛ ПЛАТЁЖНОЙ СИСТЕМЫ ВО ВСЁМ `src/` — ни
 *      для какого плана и ни в одной ветке. Внутри оболочки такая ссылка
 *      — это отклонение по политике магазина, а ветка «а тут только в
 *      вебе» проверяется чтением, то есть не проверяется никак. Поэтому
 *      правило безусловное: портала нет НИГДЕ.
 *
 * Разбор идёт после вычёркивания комментариев: на «ветку закомментировали»
 * стоит отдельная подсадка (класс 7.182).
 *
 *   node scripts/check-grant-not-a-purchase.mjs
 *   node scripts/check-grant-not-a-purchase.mjs --plant
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const PLANT = process.argv.includes("--plant");
const ROOT = join(process.cwd(), "src");
const CABINET = "src/app/[lang]/profile/page.tsx";
const GRANT_LIB = "src/lib/subscription-grant.ts";

/** Портал платёжной системы: любое из этих написаний означает, что
 *  человека уводят управлять покупкой наружу. */
export const PORTAL_MARKS = [
  "billing_portal",
  "billingPortal",
  "billing.portal",
  "/billing/portal",
];

export function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

export function violations({ cabinetRaw, grantLibRaw, portalHits }) {
  const cabinet = stripComments(cabinetRaw);
  const grantLib = stripComments(grantLibRaw);
  const bad = [];

  // 1. Правило выдачи — одно, и оно спрашивает ОБА условия.
  if (!/export function isGrantSubscription/.test(grantLib)) {
    bad.push(`${GRANT_LIB}: правила выдачи нет — сторож ослеп, а не доволен`);
  } else {
    if (!/isPurchasedPlan\(row\.plan\)/.test(grantLib)) {
      bad.push(`${GRANT_LIB}: выдача не отличается от оплаченного тарифа`);
    }
    if (!/!row\.stripeSubscriptionId/.test(grantLib)) {
      bad.push(`${GRANT_LIB}: выдача определяется одним планом — у настоящей подписки с новым именем тарифа отнимут отмену`);
    }
  }

  // 2. Кабинет считает признак той же функцией.
  if (!/const grantAccess = isActive && isGrantSubscription\(subscription\)/.test(cabinet)) {
    bad.push(`${CABINET}: \`grantAccess\` собран не общим правилом (долг 239)`);
  }

  // 3. Ветка стоит РАНЬШЕ формы отмены — иначе кнопка остаётся.
  const controls = cabinet.indexOf("grantAccess ? null :");
  const cancelForm = cabinet.indexOf('action="/api/subscription/cancel"');
  if (cancelForm === -1) {
    bad.push(`${CABINET}: формы отмены нет вовсе — сторож ослеп, а не доволен`);
  } else if (controls === -1 || controls > cancelForm) {
    bad.push(`${CABINET}: выданный доступ не гасит блок органов управления ДО формы отмены — кнопка «отменить» остаётся у того, кому нечего отменять`);
  }

  // 4. История не называет выдачу тарифом.
  if (!/isGrantSubscription\(row\)/.test(cabinet)) {
    bad.push(`${CABINET}: строка истории не отличает выдачу от платежа`);
  }
  if (!/historyGrantCode/.test(cabinet) || !/historyGrantManual/.test(cabinet)) {
    bad.push(`${CABINET}: у выдачи в истории нет своей подписи — она снова читается как оплаченный тариф`);
  }

  // 5. Портала нет нигде.
  for (const hit of portalHits) {
    bad.push(`${hit.file}:${hit.line}: ссылка на портал платёжной системы — внутри оболочки это отклонение по политике магазина`);
  }
  return bad;
}

export function portalTouches(files, read) {
  const hits = [];
  for (const file of files) {
    const source = stripComments(read(file));
    source.split("\n").forEach((line, i) => {
      if (PORTAL_MARKS.some((mark) => line.includes(mark))) {
        hits.push({ file, line: i + 1 });
      }
    });
  }
  return hits;
}

function sourceFiles() {
  return walk(ROOT)
    .map((f) => relative(process.cwd(), f).split("\\").join("/"))
    .filter((f) => !/\.test\.tsx?$/.test(f))
    .filter((f) => !f.includes("/generated/"))
    .sort();
}

function plant() {
  const files = sourceFiles();
  const read = (f) => readFileSync(f, "utf8");
  const cabinetRaw = read(CABINET);
  const grantLibRaw = read(GRANT_LIB);
  const live = { cabinetRaw, grantLibRaw, portalHits: portalTouches(files, read) };

  const cases = [{ name: "отрицательный контроль: живые файлы сегодня чисты", ok: violations(live).length === 0 }];
  const planted = (name, patch, expect) => {
    const input = { ...live, ...patch };
    if (JSON.stringify(input) === JSON.stringify(live)) {
      cases.push({ name: `${name} — ЯКОРЬ ПОДСАДКИ УЕХАЛ`, ok: false });
      return;
    }
    cases.push({ name, ok: violations(input).some((f) => f.includes(expect)) });
  };

  planted(
    "подсадка: вернуть кнопку отмены выданному доступу — поймана",
    { cabinetRaw: cabinetRaw.replace("grantAccess ? null : isActive", "isActive") },
    "не гасит блок органов управления",
  );
  planted(
    "подсадка: приписать ветку ПОСЛЕ формы отмены — поймана",
    {
      cabinetRaw: cabinetRaw
        .replace("grantAccess ? null : isActive", "isActive")
        .replace("</div>\n\n        <div className=\"mt-6 border-t", "grantAccess ? null : null}</div>\n\n        <div className=\"mt-6 border-t"),
    },
    "не гасит блок органов управления",
  );
  planted(
    "подсадка: закомментировать ветку — поймана (класс 7.182)",
    { cabinetRaw: cabinetRaw.replace("grantAccess ? null : isActive", "/* grantAccess ? null : */ isActive") },
    "не гасит блок органов управления",
  );
  planted(
    "подсадка: история снова называет выдачу тарифом — поймана",
    { cabinetRaw: cabinetRaw.replace("isGrantSubscription(row)", "false") },
    "не отличает выдачу от платежа",
  );
  planted(
    "подсадка: признак выдачи собран мимо общего правила — поймана",
    { cabinetRaw: cabinetRaw.replace("const grantAccess = isActive && isGrantSubscription(subscription)", "const grantAccess = isActive && subscription?.plan === \"manual\"") },
    "собран не общим правилом",
  );
  planted(
    "подсадка: выдачу отличают одним планом, без кассы — поймана",
    { grantLibRaw: grantLibRaw.replace("return !row.stripeSubscriptionId;", "return true;") },
    "определяется одним планом",
  );
  planted(
    "подсадка: ссылка на портал платёжной системы — поймана",
    { portalHits: [{ file: "src/app/[lang]/profile/page.tsx", line: 1 }] },
    "портал платёжной системы",
  );

  let passed = 0;
  for (const c of cases) {
    console.log(`  ${c.ok ? "ок" : "ОТКАЗ"}: ${c.name}`);
    if (c.ok) passed++;
  }
  console.log(`[check:grant-not-a-purchase --plant] пройдено ${passed} из ${cases.length}`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  if (PLANT) return plant();
  const files = sourceFiles();
  const read = (f) => readFileSync(f, "utf8");
  const bad = violations({
    cabinetRaw: read(CABINET),
    grantLibRaw: read(GRANT_LIB),
    portalHits: portalTouches(files, read),
  });
  if (bad.length) {
    console.error("ВЫДАННЫЙ ДОСТУП СНОВА ВЫГЛЯДИТ ПОКУПКОЙ (долг 239):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(`[check:grant-not-a-purchase] ${files.length} файлов: у выданного доступа нет ни отмены, ни покупки, история его платежом не называет, ссылок на портал платёжной системы 0 (контроль — --plant).`);
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
