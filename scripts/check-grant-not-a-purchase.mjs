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
 *   2. У выдачи в кабинете НЕТ формы отмены: ветка `grantAccess ? grantUpgrade :`
 *      стоит РАНЬШЕ формы `/api/subscription/cancel` в том же выражении.
 *      Правило по порядку, а не по наличию слова: ветка, приписанная
 *      после формы, кнопку бы не убрала.
 *   3. У выдачи в кабинете нет и кнопки покупки: та же ветка гасит весь
 *      блок органов управления целиком. ИСКЛЮЧЕНИЕ 7.242 (решение
 *      владельца, долг 346): внутри оболочки, которая умеет покупать, у
 *      выдачи без Premium стоит панель магазина ТОЛЬКО с Premium
 *      (`grantUpgrade`, правило 3б) — и больше ничего.
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
const LABEL_LIB = "src/lib/subscription-plan-label.ts";

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

export function violations({ cabinetRaw, grantLibRaw, labelLibRaw, portalHits }) {
  const cabinet = stripComments(cabinetRaw);
  const grantLib = stripComments(grantLibRaw);
  const labelLib = stripComments(labelLibRaw ?? "");
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
  const controls = cabinet.indexOf("grantAccess ? grantUpgrade :");
  const cancelForm = cabinet.indexOf('action="/api/subscription/cancel"');
  if (cancelForm === -1) {
    bad.push(`${CABINET}: формы отмены нет вовсе — сторож ослеп, а не доволен`);
  } else if (controls === -1 || controls > cancelForm) {
    bad.push(`${CABINET}: выданный доступ не гасит блок органов управления ДО формы отмены — кнопка «отменить» остаётся у того, кому нечего отменять`);
  }

  // 3б. ПУТЬ К PREMIUM (7.242, решение владельца, долг 346). У выдачи
  //     может стоять ровно одно: панель покупки магазина только с Premium,
  //     только внутри оболочки, которая умеет покупать, и только у того, у
  //     кого Premium ещё нет. Ни формы отмены, ни ссылки на цены, ни
  //     Standard ещё раз.
  const upgradeAt = cabinet.indexOf("const grantUpgrade =");
  const upgrade = upgradeAt === -1 ? "" : cabinet.slice(upgradeAt, cabinet.indexOf(": null;", upgradeAt) + 7);
  if (!upgrade) {
    bad.push(`${CABINET}: нет \`grantUpgrade\` — у выданного доступа снова нет пути к Premium (долг 346)`);
  } else {
    if (!/grantAccess && nativeCanBuy && !isPremiumUser \?/.test(upgrade)) {
      bad.push(`${CABINET}: путь к Premium у выдачи не ограничен «оболочка умеет покупать и Premium ещё нет»`);
    }
    if (!/<NativePurchasePanel[\s\S]*\bonlyPremium\b/.test(upgrade)) {
      bad.push(`${CABINET}: панель у выдачи предлагает не только Premium`);
    }
    if (/subscription\/cancel|\/pricing|<Link\b|<form\b/.test(upgrade)) {
      bad.push(`${CABINET}: у выдачи появилась отмена, форма или ссылка на цены — это снова покупка там, где её не было (долг 239)`);
    }
  }

  // 4. История не называет выдачу тарифом, а строка «Plan» не спорит с
  //    ней (долг 248, 7.207): обе подписи собирает ОДНА функция, и признак
  //    «код или рука» в ней ровно один.
  if (!/subscriptionRowLabel\(row,\s*dict,\s*redeemedCodeDates,\s*"history"\)/.test(cabinet)) {
    bad.push(`${CABINET}: строка истории не отличает выдачу от платежа`);
  }
  if (!/subscriptionRowLabel\(subscription,\s*dict,\s*redeemedCodeDates,\s*"plan"\)/.test(cabinet)) {
    bad.push(`${CABINET}: строка «Plan» подписана мимо общего признака — она снова может сказать «выдано вручную» тому, кто погасил код (долг 248)`);
  }
  if (/planDisplayLabel\s*\(/.test(cabinet)) {
    bad.push(`${CABINET}: подпись тарифа зовётся напрямую, в обход признака выдачи — второй ответ на тот же вопрос (долг 248)`);
  }
  if (!labelLib) {
    bad.push(`${LABEL_LIB}: файла подписи нет — сторож ослеп, а не доволен`);
  } else {
    if (!/isGrantSubscription\(row\)/.test(labelLib)) {
      bad.push(`${LABEL_LIB}: подпись не спрашивает, выдача ли это, — тариф из колонки снова говорит за неё`);
    }
    if (!/grantSource\(row,\s*redeemedCodeDates\)\s*===\s*"code"/.test(labelLib)) {
      bad.push(`${LABEL_LIB}: «код или рука» решается не общим признаком по времени погашения (долг 248)`);
    }
    if (!/historyGrantCode/.test(labelLib) || !/historyGrantManual/.test(labelLib) || !/planManualLabel/.test(labelLib)) {
      bad.push(`${LABEL_LIB}: у выдачи нет своих подписей — она снова читается как оплаченный тариф`);
    }
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
  const labelLibRaw = read(LABEL_LIB);
  const live = { cabinetRaw, grantLibRaw, labelLibRaw, portalHits: portalTouches(files, read) };

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
    { cabinetRaw: cabinetRaw.replace("grantAccess ? grantUpgrade : isActive", "isActive") },
    "не гасит блок органов управления",
  );
  planted(
    "подсадка: приписать ветку ПОСЛЕ формы отмены — поймана",
    {
      cabinetRaw: cabinetRaw
        .replace("grantAccess ? grantUpgrade : isActive", "isActive")
        .replace("</div>\n\n        <div className=\"mt-6 border-t", "grantAccess ? grantUpgrade : null}</div>\n\n        <div className=\"mt-6 border-t"),
    },
    "не гасит блок органов управления",
  );
  planted(
    "подсадка: закомментировать ветку — поймана (класс 7.182)",
    { cabinetRaw: cabinetRaw.replace("grantAccess ? grantUpgrade : isActive", "/* grantAccess ? null : */ isActive") },
    "не гасит блок органов управления",
  );
  // 7.242, долг 346: путь к Premium у выдачи — ровно панель с Premium.
  planted(
    "подсадка 7.242: у выдачи вместо Premium — ссылка на цены — поймана",
    { cabinetRaw: cabinetRaw.replace("onlyPremium\n      />\n    ) : null;", "onlyPremium\n      />\n    ) : <Link href={`/${lang}/pricing`}>x</Link>;") },
    "ссылка на цены",
  );
  planted(
    "подсадка 7.242: панель у выдачи предлагает все тарифы — поймана",
    { cabinetRaw: cabinetRaw.replace("        onlyPremium\n      />", "      />") },
    "не только Premium",
  );
  planted(
    "подсадка 7.242: путь к Premium и у того, у кого Premium уже есть — поймана",
    { cabinetRaw: cabinetRaw.replace("grantAccess && nativeCanBuy && !isPremiumUser ?", "grantAccess && nativeCanBuy ?") },
    "не ограничен",
  );
  planted(
    "подсадка 7.242: путь к Premium у выдачи убран — поймана",
    { cabinetRaw: cabinetRaw.replace("const grantUpgrade =", "const grantUpgradeGone =") },
    "нет `grantUpgrade`",
  );
  planted(
    "подсадка: история снова называет выдачу тарифом — поймана",
    { cabinetRaw: cabinetRaw.replace('subscriptionRowLabel(row, dict, redeemedCodeDates, "history")', "planDisplayLabel(row.plan, dict)") },
    "не отличает выдачу от платежа",
  );
  planted(
    "подсадка: строка «Plan» снова подписана одной колонкой — поймана (долг 248)",
    { cabinetRaw: cabinetRaw.replace('subscriptionRowLabel(subscription, dict, redeemedCodeDates, "plan")', "planDisplayLabel(subscription.plan, dict)") },
    "подписана мимо общего признака",
  );
  planted(
    "подсадка: подпись перестала спрашивать, выдача ли это — поймана",
    { labelLibRaw: labelLibRaw.replace("if (!isGrantSubscription(row)) return planDisplayLabel(row.plan, dict);", "") },
    "не спрашивает, выдача ли это",
  );
  planted(
    "подсадка: «код или рука» решается планом, а не временем — поймана",
    { labelLibRaw: labelLibRaw.replace('grantSource(row, redeemedCodeDates) === "code"', 'row.plan === "access_code"') },
    "не общим признаком по времени",
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
    labelLibRaw: read(LABEL_LIB),
    portalHits: portalTouches(files, read),
  });
  if (bad.length) {
    console.error("ВЫДАННЫЙ ДОСТУП СНОВА ВЫГЛЯДИТ ПОКУПКОЙ (долг 239):");
    for (const b of bad) console.error(`  ${b}`);
    return 1;
  }
  console.log(`[check:grant-not-a-purchase] ${files.length} файлов: у выданного доступа нет отмены, а покупка — только Premium в оболочке с покупкой (7.242), история его платежом не называет, «Plan» и история подписаны одним признаком, ссылок на портал платёжной системы 0 (контроль — --plant).`);
  return 0;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
