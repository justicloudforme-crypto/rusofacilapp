// ЦЕНЫ МАГАЗИНА СЛИЧАЮТСЯ С ЦЕНАМИ САЙТА — ДОЛГ 80.
//
// Что здесь сторожится. Источник правды по цене на сайте ровно один —
// `amountMxnCents` в `src/lib/plans.ts` («This is the ONLY place the figure
// is written down as a number»). Файл локального тестирования StoreKit
// `ios/App/App/RusoFacilappPRO.storekit` — второй, независимый список тех
// же трёх цен, и до 12.09.2026 он держал остатки долларовых 7,99 / 47,99 /
// 49,99: у Premium расхождение было в 2,7 раза. Два списка цен, которые
// никто не сличает, расходятся молча — и расходились.
//
// ОГОВОРКА, БЕЗ КОТОРОЙ ЭТОТ СТОРОЖ ВРЁТ. `.storekit` — файл ЛОКАЛЬНОГО
// тестирования StoreKit в Xcode, а НЕ источник правды для магазина. Боевые
// цены заводит владелец руками в App Store Connect и Play Console, и туда
// этот сторож не дотягивается вовсе. Зелёный здесь означает «локальная
// витрина обещает то же, что сайт», а не «в магазине стоит правильная
// цена».
//
// Решение владельца от 11.09.2026, от которого идут числа: цена везде одна
// и та же, база в мексиканских песо — 150 MXN в месяц, 899 MXN в год,
// 2299 MXN Premium разово. Локализацию по странам делает каждая площадка
// сама: на сайте Stripe Adaptive Pricing, в магазинах — их собственные
// таблицы цен от базовой.
//
// НЕВОСПРИИМЧИВОСТЬ К КОММЕНТАРИЯМ. `plans.ts` разбирается ПОСЛЕ того, как
// из него вычеркнуты комментарии и содержимое строк: закомментированная
// строка `amountMxnCents` не имеет права сойти за живую. В 7.182 посчитано,
// что девятнадцать сторожей этой слепотой больны; этот в их число не
// входит, и на это есть отдельная подсадка.
//
//   node scripts/check-price-parity.mjs          # гейт
//   node scripts/check-price-parity.mjs --plant  # позитивный контроль
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { stripCommentsAndStrings } from "./check-no-runtime-tts.mjs";

const PLANS_FILE = "src/lib/plans.ts";
const STOREKIT_FILE = "ios/App/App/RusoFacilappPRO.storekit";

// План сайта → продукт магазина. Имена продуктов заданы здесь литералами
// намеренно: сторож обязан судить о двух файлах, ничего не импортируя из
// проверяемого — иначе он проверяет сам себя.
const PRODUCT_OF_PLAN = {
  monthly: "com.rusofacilapp.app.pro.monthly",
  annual: "com.rusofacilapp.app.pro.yearly",
  lifetime: "com.rusofacilapp.app.pro.lifetime",
};

// Витрина файла — мексиканская, значит цены в нём читаются как MXN. Без
// этого «150» в файле с витриной США означало бы 150 долларов, то есть
// совпадение чисел при полном расхождении цен.
const EXPECTED_STOREFRONT = "MEX";

/** Суммы планов сайта в центаво, по ЖИВОМУ коду plans.ts. */
function sitePricesFrom(source) {
  const code = stripCommentsAndStrings(source);
  const out = {};
  // `monthly: { … amountMxnCents: 15_000, … }` — имя плана и его сумма
  // ищутся одной парой, а не двумя независимыми списками: иначе порядок
  // объявлений решал бы, какая цена к какому плану относится.
  for (const plan of Object.keys(PRODUCT_OF_PLAN)) {
    // `[^{}]*` — РОВНО тело объекта плана и ни знака дальше. С ленивым
    // `[\s\S]*?` поиск перешагивал закрывающую скобку и брал сумму
    // СЛЕДУЮЩЕГО плана: закомментированная сумма годового читалась как
    // 2299 — число Premium. Подсадка «сумма осталась только в
    // комментарии» на той редакции краснела по неверной причине.
    const m = code.match(new RegExp(`\\b${plan}\\s*:\\s*\\{[^{}]*?amountMxnCents\\s*:\\s*([\\d_]+)`));
    if (!m) continue;
    out[plan] = Number(m[1].replace(/_/g, ""));
  }
  return out;
}

/** Цены и вид покупки из файла StoreKit, в центаво. */
function storePricesFrom(json) {
  const doc = JSON.parse(json);
  const out = {};
  for (const product of doc.products ?? []) {
    out[product.productID] = {
      cents: Math.round(Number(product.displayPrice) * 100),
      kind: product.type,
      group: null,
    };
  }
  for (const group of doc.subscriptionGroups ?? []) {
    for (const sub of group.subscriptions ?? []) {
      out[sub.productID] = {
        cents: Math.round(Number(sub.displayPrice) * 100),
        kind: sub.type,
        group: group.id,
      };
    }
  }
  return { products: out, storefront: doc.settings?._storefront ?? null };
}

/** Подсадка: годовой уезжает в отдельную группу подписок. Правится JSON,
 * а не текст файла — текстовая замена этого узла оказалась хрупкой и
 * подсадка молча переставала срабатывать. */
function withYearlyInItsOwnGroup(json) {
  const doc = JSON.parse(json);
  const group = doc.subscriptionGroups[0];
  const yearly = group.subscriptions.find((s) => s.productID.endsWith(".yearly"));
  group.subscriptions = group.subscriptions.filter((s) => s !== yearly);
  doc.subscriptionGroups.push({
    id: "00000000-0000-0000-0000-00000000ABCD",
    localizations: [],
    name: "RusoFácilapp PRO (вторая группа)",
    subscriptions: [yearly],
  });
  return JSON.stringify(doc, null, 2);
}

function judge(plansSource, storekitJson) {
  const problems = [];
  const site = sitePricesFrom(plansSource);
  let store;
  try {
    store = storePricesFrom(storekitJson);
  } catch (error) {
    return [`${STOREKIT_FILE} не разбирается как JSON: ${error.message}`];
  }

  if (store.storefront !== EXPECTED_STOREFRONT) {
    problems.push(
      `витрина файла StoreKit — ${store.storefront ?? "не задана"}, а цены в нём написаны в песо: ожидается "_storefront": "${EXPECTED_STOREFRONT}"`,
    );
  }

  const groups = new Set();
  for (const [plan, productID] of Object.entries(PRODUCT_OF_PLAN)) {
    const expected = site[plan];
    if (expected === undefined) {
      problems.push(`в живом коде ${PLANS_FILE} не найдена сумма плана «${plan}» (amountMxnCents)`);
      continue;
    }
    const actual = store.products[productID];
    if (!actual) {
      problems.push(`в ${STOREKIT_FILE} нет продукта ${productID} (план «${plan}»)`);
      continue;
    }
    if (actual.cents !== expected) {
      problems.push(
        `план «${plan}»: на сайте ${expected / 100} MXN, в StoreKit ${actual.cents / 100} — расхождение`,
      );
    }
    const wantKind = plan === "lifetime" ? "NonConsumable" : "RecurringSubscription";
    if (actual.kind !== wantKind) {
      problems.push(`план «${plan}»: в StoreKit тип ${actual.kind}, ожидается ${wantKind}`);
    }
    if (plan !== "lifetime") groups.add(actual.group);
  }
  if (groups.size > 1) {
    problems.push(`месячный и годовой стоят в РАЗНЫХ группах подписок (${[...groups].join(", ")}) — обязаны быть в одной`);
  }
  return problems;
}

function main() {
  const plansSource = readFileSync(PLANS_FILE, "utf8");
  const storekitJson = readFileSync(STOREKIT_FILE, "utf8");

  if (process.argv.includes("--plant")) {
    let ok = judge(plansSource, storekitJson).length === 0;
    console.log(`  ${ok ? "молчит" : "ЛОЖНО КРАСНЫЙ"} — здоровые файлы (отрицательный контроль)`);

    const plants = [
      [
        "цена месячного сдвинута в StoreKit на один песо",
        plansSource,
        storekitJson.replace('"displayPrice": "150.00"', '"displayPrice": "151.00"'),
      ],
      [
        "Premium в StoreKit вернулся к старым 49,99",
        plansSource,
        storekitJson.replace('"displayPrice": "2299.00"', '"displayPrice": "49.99"'),
      ],
      [
        "витрина файла переставлена на США (те же числа — другая валюта)",
        plansSource,
        storekitJson.replace('"_storefront": "MEX"', '"_storefront": "USA"'),
      ],
      [
        "годовой переставлен во ВТОРУЮ группу подписок",
        plansSource,
        withYearlyInItsOwnGroup(storekitJson),
      ],
      [
        "Premium объявлен подпиской вместо разовой покупки",
        plansSource,
        storekitJson.replace('"type": "NonConsumable"', '"type": "RecurringSubscription"'),
      ],
      [
        "сумма годового в plans.ts осталась ТОЛЬКО в комментарии (слепота к комментариям)",
        plansSource.replace(/(\n\s*)amountMxnCents: 89_900,/, "$1// amountMxnCents: 89_900,"),
        storekitJson,
      ],
    ];

    let caught = 0;
    for (const [name, plans, storekit] of plants) {
      const found = judge(plans, storekit);
      const hit = found.length > 0;
      if (hit) caught++;
      console.log(`  ${hit ? "поймано" : "ПРОПУЩЕНО"} — ${name}${hit ? ` (${found[0]})` : ""}`);
    }
    ok &&= caught === plants.length;
    console.log(
      ok
        ? `check:price-parity --plant — ${caught} из ${plants.length} подсадок, 1 из 1 отрицательный контроль`
        : "check:price-parity --plant — FAILED",
    );
    return ok ? 0 : 1;
  }

  const problems = judge(plansSource, storekitJson);
  if (problems.length) {
    console.error("ЦЕНЫ МАГАЗИНА РАЗОШЛИСЬ С ЦЕНАМИ САЙТА:");
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      `\n  Источник правды по цене — ${PLANS_FILE}. Цены на сайте не правятся: 150 / 899 / 2299 MXN стоят на проде,` +
        " и по ним платят живые подписки. Правится файл StoreKit.",
    );
    return 1;
  }
  console.log(
    "check:price-parity — 3 из 3 планов сошлись с StoreKit (150 / 899 / 2299 MXN, витрина MEX); контроль — --plant.",
  );
  console.log(
    "  ОГОВОРКА: .storekit — файл локального тестирования, а не источник правды магазина. Боевые цены заводит владелец в App Store Connect и Play Console.",
  );
  return 0;
}

// Только когда этот файл — точка входа процесса: импорт его запускать не
// должен (см. src/lib/entry-point.ts).
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) process.exitCode = main();
