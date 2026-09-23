// ПОКУПКА ВНУТРИ ПРИЛОЖЕНИЯ — ПРАВИЛА, КОТОРЫЕ НЕЛЬЗЯ НАРУШИТЬ МОЛЧА.
//
// Заход 7.224, новое решение владельца по долгу 79: внутри оболочки платный
// путь есть, и он РОВНО ОДИН — покупка магазина. Веб-кассы (Stripe, OXXO,
// «Карта/Наличные») внутри приложения нет ни в каком виде; на сайте в
// браузере всё остаётся как было.
//
// ЧТО СТОРОЖИТ ЭТОТ ФАЙЛ И ЧЕГО НЕ СТОРОЖИТ. Живую ОТДАЧУ по http судит
// `npm run check:native-payments` — он теперь спрашивает сервер ещё и в
// двух обличьях оболочки версии 4. Здесь судятся ИСХОДНИКИ: восемь правил,
// каждое из которых, будучи нарушенным, даёт дефект, который на отдаче не
// виден вовсе или виден не сразу.
//
// У КАЖДОГО ПРАВИЛА ЕСТЬ ПОДСАДКА (`--plant`). Правило без подсадки — это
// не правило, а зелёная строка в отчёте: ровно так семь проверок подряд в
// этом проекте были слепы (ПРАВИЛА ЗАМЕРА 4.1).
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const FILES = {
  config: "src/lib/revenuecat-config.ts",
  client: "src/lib/revenuecat-client.ts",
  panel: "src/components/native/NativePurchasePanel.tsx",
  identity: "src/components/native/NativeStoreIdentity.tsx",
  copy: "src/lib/native-access-copy.ts",
  layout: "src/app/[lang]/layout.tsx",
  pricing: "src/app/[lang]/pricing/page.tsx",
  profile: "src/app/[lang]/profile/page.tsx",
  paywall: "src/contexts/PaywallContext.tsx",
  shell: "src/lib/native-shell.ts",
  webhook: "src/app/api/webhooks/revenuecat/route.ts",
  capacitor: "capacitor.config.ts",
  gradle: "android/app/build.gradle",
  cancel: "src/app/api/subscription/cancel/route.ts",
};

/** Все файлы правила — один снимок. Подсадка правит СНИМОК, а не диск. */
function readAll() {
  const files = {};
  for (const [key, path] of Object.entries(FILES)) {
    if (!existsSync(path)) throw new Error(`нет файла ${path} — сторож и код разошлись`);
    files[key] = readFileSync(path, "utf8");
  }
  return files;
}

/** Числа версии из трёх независимых мест. */
function versions(files) {
  const fromConfig = /NATIVE_PURCHASE_MIN_SHELL_VERSION\s*=\s*(\d+)/.exec(files.config)?.[1];
  const fromCapacitor = /NATIVE_SHELL_VERSION\s*=\s*(\d+)/.exec(files.capacitor)?.[1];
  const fromGradle = /versionCode\s+(\d+)/.exec(files.gradle)?.[1];
  return { fromConfig, fromCapacitor, fromGradle };
}

/** Девять событий, ради которых вебхук вообще существует. */
const REQUIRED_EVENTS = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
  "CANCELLATION",
  "UNCANCELLATION",
  "BILLING_ISSUE",
  "EXPIRATION",
  "TRANSFER",
];

/** Денежные знаки и те самые числа, которыми названы цены (песо Play и
 *  песо сайта). Ни одно из них не имеет права стоять в нашем тексте. */
const MONEY_MARKS = ["MXN", "$", "€", "peso", "песо"];
const PRICE_NUMBERS = ["149", "150", "899", "2299", "2 299", "1 799"];

/** Код без комментариев: правила судят то, что исполняется. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/[^\n]*/g, " ");
}

/** Имена платёжных систем: долг 196 запрещает их в интерфейсе оболочки. */
const PAYMENT_BRANDS = [
  "Google Play",
  "Play Store",
  "Stripe",
  "OXXO",
  "PayPal",
  "Mercado Pago",
  "Visa",
  "Mastercard",
];

/** Текст блока `purchase` из обоих словарей оболочки — без кода вокруг. */
function purchaseCopyStrings(copySource) {
  const out = [];
  let at = 0;
  for (;;) {
    const start = copySource.indexOf("\n    purchase: {", at);
    if (start === -1) break;
    const end = copySource.indexOf("\n    },", start);
    if (end === -1) break;
    const block = copySource.slice(start, end);
    for (const m of block.matchAll(/"((?:[^"\\]|\\.)*)"/g)) out.push(m[1]);
    at = end;
  }
  return out;
}

function judge(files) {
  const problems = [];

  // ПРАВИЛО 1. Публичный ключ SDK записан РОВНО В ОДНОМ месте.
  // Россыпь ключа по коду — это не «дубль»: обновлять его пришлось бы в
  // нескольких местах, и промах был бы виден только на живом телефоне.
  const withKey = Object.entries(files).filter(([, text]) => text.includes("goog_"));
  if (withKey.length !== 1 || withKey[0][0] !== "config") {
    problems.push(
      `публичный ключ магазина найден в ${withKey.length} файлах (${withKey
        .map(([k]) => FILES[k])
        .join(", ")}) — он обязан жить только в ${FILES.config}`,
    );
  }

  // ПРАВИЛО 2. Три числа версии обязаны совпадать. Разойдись они — и
  // оболочка, умеющая покупать, не получит экран покупки (или получит его
  // оболочка, которая не умеет: долг 179 ровно в этом и состоял).
  const v = versions(files);
  if (!v.fromConfig || !v.fromCapacitor || !v.fromGradle) {
    problems.push(`версия оболочки не прочиталась: ${JSON.stringify(v)}`);
  } else if (new Set([v.fromConfig, v.fromCapacitor, v.fromGradle]).size !== 1) {
    problems.push(
      `версии разошлись: NATIVE_PURCHASE_MIN_SHELL_VERSION=${v.fromConfig}, ` +
        `NATIVE_SHELL_VERSION=${v.fromCapacitor}, versionCode=${v.fromGradle}`,
    );
  }

  // ПРАВИЛО 3. Экран покупки не знает ни веб-кассы, ни цены.
  //
  // Судится КОД, а не комментарии: разбор того, почему веб-кассы здесь
  // нет, обязан называть её по имени — иначе читать его было бы нечем.
  const panelCode = stripComments(files.panel);
  const forbiddenInPanel = ["/api/checkout", "/pricing", "OXXO", "MXN", "stripe"];
  for (const mark of forbiddenInPanel) {
    if (panelCode.includes(mark)) {
      problems.push(`${FILES.panel}: содержит «${mark}» — внутри приложения веб-кассы нет (долг 79)`);
    }
  }
  if (!files.panel.includes("priceString")) {
    problems.push(
      `${FILES.panel}: цена берётся не строкой магазина (priceString не найден) — ` +
        "записанная нами цифра однажды разойдётся с магазином",
    );
  }

  // ПРАВИЛО 4. В текстах покупки нет ни цены, ни имени платёжной системы.
  const strings = purchaseCopyStrings(files.copy);
  if (strings.length < 20) {
    problems.push(`${FILES.copy}: блок purchase не найден или пуст (${strings.length} строк)`);
  }
  for (const value of strings) {
    // ЦЕНА, А НЕ ЛЮБАЯ ЦИФРА. «120 уроков» и «уровень C1» — это счёт
    // материала, и запрещать их значило бы запрещать правду. Запрещены
    // денежный знак и ТЕ САМЫЕ числа, которыми названы цены: в Play месяц
    // стоит 149 песо, на сайте 150, и записанная здесь цифра однажды
    // соврала бы одному из двух.
    for (const mark of MONEY_MARKS) {
      if (value.includes(mark)) {
        problems.push(`${FILES.copy}: в тексте покупки есть денежный знак «${mark}» — «${value.slice(0, 60)}»`);
      }
    }
    for (const price of PRICE_NUMBERS) {
      if (new RegExp(`(^|\\D)${price}(\\D|$)`).test(value)) {
        problems.push(`${FILES.copy}: в тексте покупки записана цена ${price} — «${value.slice(0, 60)}»`);
      }
    }
    for (const brand of PAYMENT_BRANDS) {
      if (value.includes(brand)) {
        problems.push(`${FILES.copy}: текст покупки называет платёжную систему «${brand}» (долг 196)`);
      }
    }
  }

  // ПРАВИЛО 5. Покупку выполняет ОДИН экран. Второй такой же — это второе
  // место, где она может разойтись с первым (так жил долг 191).
  const buyers = Object.entries(files).filter(
    ([key, text]) => key !== "client" && key !== "config" && text.includes("purchasePackage("),
  );
  if (buyers.length !== 1 || buyers[0][0] !== "panel") {
    problems.push(
      `покупку выполняют ${buyers.length} мест (${buyers.map(([k]) => FILES[k]).join(", ")}) — ` +
        `должен ровно один: ${FILES.panel}`,
    );
  }

  // ПРАВИЛО 6. Вебхук обязан разбирать все девять событий поимённо.
  for (const type of REQUIRED_EVENTS) {
    if (!files.webhook.includes(`case "${type}"`)) {
      problems.push(`${FILES.webhook}: событие ${type} не разбирается вовсе`);
    }
  }

  // ПРАВИЛО 7. Экран покупки включается ТОЛЬКО по версии оболочки.
  // Каждый файл, который его рисует, обязан в том же файле спросить
  // `canBuyInsideShell()` — или получить решение свойством из макета,
  // который его спросил.
  const renderers = Object.entries(files).filter(
    ([key, text]) => key !== "panel" && text.includes("NativePurchasePanel"),
  );
  for (const [key, text] of renderers) {
    const asksSelf = text.includes("canBuyInsideShell");
    const takesProp = text.includes("nativePurchase");
    if (!asksSelf && !takesProp) {
      problems.push(
        `${FILES[key]}: рисует экран покупки, не спросив про версию оболочки — ` +
          "оболочка 3 получила бы кнопку, которая ничего не делает (долг 179)",
      );
    }
  }
  if (!files.shell.includes("NATIVE_PURCHASE_MIN_SHELL_VERSION")) {
    problems.push(`${FILES.shell}: решение о покупке принято не по версии оболочки`);
  }

  // ПРАВИЛО 8. Привязка покупателя к учётной записи есть в обе стороны.
  if (!files.identity.includes("loginRevenueCat") || !files.identity.includes("logoutRevenueCat")) {
    problems.push(
      `${FILES.identity}: привязка покупателя односторонняя — на общем телефоне следующий ` +
        "вошедший унаследовал бы чужую покупку",
    );
  }
  if (!files.layout.includes("NativeStoreIdentity")) {
    problems.push(`${FILES.layout}: привязка покупателя не смонтирована — события поедут на анонима`);
  }

  // ПРАВИЛО 9. Нашей кнопкой отмены магазинную подписку не отменить.
  // Пометить строку отменённой и оставить списания — худший исход из всех.
  if (!files.cancel.includes('provider !== "revenuecat"')) {
    problems.push(
      `${FILES.cancel}: отмена не исключает строки магазина — человек нажал бы «отменить», ` +
        "увидел подтверждение и продолжил платить",
    );
  }


  /* ================================================================ *
   * ПРАВИЛА 10-13 — ЗАХОД 7.225. ЭКРАН ПОКУПКИ НЕ ИМЕЕТ ПРАВА ВИСЕТЬ.
   *
   * Все четыре написаны по одному настоящему дефекту, снятому владельцем
   * с телефона 23.09.2026: «Загружаем варианты…» навсегда, ошибки нет, в
   * RevenueCat ноль клиентов. Причина — `return mod.Purchases` из
   * `async`-функции: объект плагина THENABLE, и промис не завершался
   * НИКОГДА. Ни один прибор этого не ловил, потому что в браузере до той
   * строки исполнение не доходит вовсе.
   * ================================================================ */
  const clientCode = stripComments(files.client);

  // ПРАВИЛО 10. Объект плагина НЕ возвращается из `async`-функции голым.
  //
  // `Purchases` — Proxy, чья ловушка `get` отдаёт функцию на ЛЮБОЕ имя,
  // включая `then`. Значит он thenable, и `Promise.resolve(Purchases)`
  // обязан позвать `Purchases.then(resolve, reject)`; обёртка Capacitor
  // аргументы игнорирует и не зовёт ни то, ни другое. Промис висит вечно.
  if (/return\s+mod\.Purchases\s*;/.test(clientCode) || /return\s+\(await import\([^)]*\)\)\.Purchases/.test(clientCode)) {
    problems.push(
      `${FILES.client}: объект плагина возвращается из async-функции голым — ` +
        "он THENABLE, и такой промис не завершится никогда (дефект 23.09.2026)",
    );
  }
  if (!clientCode.includes("{ api: mod.Purchases }")) {
    problems.push(
      `${FILES.client}: объект плагина больше не заворачивается в { api } — ` +
        "обёртка и есть защита от thenable",
    );
  }

  // ПРАВИЛО 11. У КАЖДОГО обращения к мосту есть СРОК.
  //
  // `native-bridge.js` в `cap.toNative` глотает отказ и возвращает `null`,
  // а созданный `cap.nativePromise` промис остаётся висеть. Отменить вызов
  // нечем — значит единственная защита — срок. Исключение ровно одно и
  // названо: сама покупка, где человек говорит с системным листом.
  const bare = [...clientCode.matchAll(/await\s+api\.(\w+)\(/g)].map((m) => m[1]);
  const allowedBare = ["purchasePackage"];
  for (const method of bare) {
    if (!allowedBare.includes(method)) {
      problems.push(
        `${FILES.client}: api.${method}() вызывается без срока — ` +
          "мост Capacitor умеет проглотить вызов молча, и экран зависнет навсегда",
      );
    }
  }
  const deadline = /STORE_DEADLINE_MS\s*=\s*([\d_]+)/.exec(files.client)?.[1];
  const deadlineMs = deadline ? Number(deadline.replaceAll("_", "")) : NaN;
  if (!Number.isFinite(deadlineMs) || deadlineMs < 5_000 || deadlineMs > 20_000) {
    problems.push(
      `${FILES.client}: срок ожидания магазина ${deadline ?? "не найден"} — ` +
        "он обязан быть между 5 000 и 20 000 мс: меньше рвёт живой магазин, больше неотличимо от зависания",
    );
  }

  // ПРАВИЛО 12. У КАЖДОГО исхода отказа свой текст, код и «Повторить».
  //
  // До 7.225 отказ был один и немой. Четыре причины лечатся РАЗНЫМ, и
  // человек с телефоном обязан суметь назвать свою, не читая логов.
  const OUTCOME_KEYS = [
    "failPlugin",
    "failConnect",
    "failProducts",
    "offline",
    "codeLabel",
    // ДВА ИСХОДА ВОССТАНОВЛЕНИЯ — заход 7.226, см. правило 13 ниже.
    "restoredNothing",
    "restoredExpired",
  ];
  for (const key of OUTCOME_KEYS) {
    // Дважды — по одному разу на локаль (es и ru).
    const seen = files.copy.split(`${key}:`).length - 1;
    if (seen < 2) {
      problems.push(`${FILES.copy}: текст исхода «${key}» есть не во всех локалях (${seen} из 2)`);
    }
    if (key !== "codeLabel" && !files.panel.includes(`copy.${key}`)) {
      problems.push(`${FILES.panel}: исход «${key}» нигде не показывается человеку`);
    }
  }
  for (const reason of ["plugin-missing", "no-products", "offline"]) {
    if (!files.panel.includes(`"${reason}"`)) {
      problems.push(`${FILES.panel}: исход «${reason}» не различается — все отказы снова сольются в один`);
    }
  }
  // ПРАВИЛО 13. «ВОССТАНОВИТЬ ПОКУПКИ» НЕ ИМЕЕТ ПРАВА ГОВОРИТЬ
  // ЗАПЛАТИВШЕМУ, ЧТО ПОКУПОК НЕ БЫЛО — заход 7.226.
  //
  // Владелец нажал её 23.09.2026 на POCO после того, как его тестовая
  // подписка истекла, и прочитал «Прежних покупок у этой учётной записи
  // не нашлось». Покупка была: строка `cmuehmp6f000004l2e6p0ts0r`,
  // шесть событий вебхука, деньги магазин взял. Текст был неправдой.
  //
  // Различать эти два случая есть чем: `allPurchasedProductIdentifiers`
  // у `CustomerInfo` перечисляет ВСЕ когда-либо купленные товары
  // независимо от срока, а `entitlements.active` — только действующие
  // права. Правило требует, чтобы панель спрашивала ОБА поля: сравнение
  // одного только `entitlements.active` и есть прежний дефект.
  if (!files.panel.includes("allPurchasedProductIdentifiers")) {
    problems.push(
      `${FILES.panel}: восстановление покупок не различает «покупок не было» и «были, но истекли» — ` +
        "заплатившему снова скажут, что он не платил",
    );
  }
  if (!files.panel.includes('kind: "restoredExpired"') && !files.panel.includes('"restoredExpired"')) {
    problems.push(`${FILES.panel}: исход «покупки были, но истекли» не заведён вовсе`);
  }

  if (!files.panel.includes("native-purchase-retry") || !files.panel.includes("stage.code")) {
    problems.push(
      `${FILES.panel}: у отказа нет кнопки «Повторить» или кода ошибки — ` +
        "человеку нечего нажать и нечего прислать фотографией",
    );
  }

  // ПРАВИЛО 13. Каждый отказ доезжает до Sentry, и без личных данных.
  if (!files.panel.includes("Sentry.captureMessage")) {
    problems.push(`${FILES.panel}: отказ магазина никуда не сообщается — про него снова никто не узнает`);
  } else {
    const report = files.panel.slice(files.panel.indexOf("Sentry.captureMessage"));
    const tags = report.slice(0, report.indexOf("});") + 3);
    for (const needed of ["reason", "step", "code"]) {
      if (!tags.includes(needed)) {
        problems.push(`${FILES.panel}: событие отказа не называет «${needed}» — по нему нельзя понять, где оборвалось`);
      }
    }
    for (const personal of ["email", "userId", "user.id"]) {
      if (tags.includes(personal)) {
        problems.push(`${FILES.panel}: событие отказа несёт личные данные («${personal}»)`);
      }
    }
  }

  return problems;
}

/** Подсадки: каждая обязана уронить сторож. */
const PLANTS = [
  {
    name: "ключ магазина скопирован во второй файл",
    apply: (f) => ({ ...f, panel: `${f.panel}\n// goog_YlQIdtFbcQHnAPVjhJnMggEQIQF\n` }),
  },
  {
    name: "versionCode ушёл вперёд оболочки",
    apply: (f) => ({ ...f, gradle: f.gradle.replace(/versionCode\s+\d+/, "versionCode 9") }),
  },
  {
    name: "на экране покупки появилась веб-касса",
    apply: (f) => ({ ...f, panel: f.panel.replace("<div data-testid=\"native-purchase\"", '<form action="/api/checkout"></form><div data-testid="native-purchase"') }),
  },
  {
    name: "цена зашита в текст вместо строки магазина",
    apply: (f) => ({ ...f, copy: f.copy.replace('retry: "Повторить",', 'retry: "Повторить за 149 MXN",') }),
  },
  {
    name: "текст покупки назвал платёжную систему",
    apply: (f) => ({ ...f, copy: f.copy.replace('retry: "Reintentar",', 'retry: "Reintentar con Google Play",') }),
  },
  {
    name: "второй экран покупки",
    apply: (f) => ({ ...f, profile: `${f.profile}\n// await purchasePackage(pkg)\n` }),
  },
  {
    name: "вебхук перестал разбирать перенос покупки",
    apply: (f) => ({ ...f, webhook: f.webhook.replace('case "TRANSFER"', 'case "TRANSFER_DISABLED"') }),
  },
  {
    name: "экран покупки рисуется без вопроса о версии",
    apply: (f) => ({
      ...f,
      pricing: f.pricing.replaceAll("canBuyInsideShell", "isNativeShellRequest").replaceAll("nativePurchase", "nativeNotice"),
    }),
  },
  {
    name: "выход из учётной записи перестал сбрасывать покупателя",
    apply: (f) => ({ ...f, identity: f.identity.replaceAll("logoutRevenueCat", "noopRevenueCat") }),
  },
  {
    name: "объект плагина снова возвращается голым (дефект 23.09.2026)",
    apply: (f) => ({ ...f, client: f.client.replace("return { api: mod.Purchases };", "return mod.Purchases;") }),
  },
  {
    name: "со списка товаров снят срок",
    apply: (f) => ({
      ...f,
      client: f.client.replace('await within(api.getOfferings(), "offerings")', "await api.getOfferings()"),
    }),
  },
  {
    name: "срок вырос до минуты — для человека это то же зависание",
    apply: (f) => ({ ...f, client: f.client.replace("STORE_DEADLINE_MS = 15_000", "STORE_DEADLINE_MS = 60_000") }),
  },
  {
    name: "исход «товаров нет» перестал отличаться от «не достучались»",
    apply: (f) => ({ ...f, panel: f.panel.replaceAll('"no-products"', '"store-unreachable"') }),
  },
  {
    name: "у отказа пропала кнопка «Повторить»",
    apply: (f) => ({ ...f, panel: f.panel.replace('data-testid="native-purchase-retry"', 'data-testid="native-purchase-x"') }),
  },
  {
    name: "отказ перестал доезжать до Sentry",
    apply: (f) => ({ ...f, panel: f.panel.replace("Sentry.captureMessage", "noopCapture") }),
  },
  {
    name: "событие отказа понесло личные данные",
    apply: (f) => ({ ...f, panel: f.panel.replace("tags: { area: \"native-purchase\", reason, step,", "tags: { area: \"native-purchase\", email: \"x\", reason, step,") }),
  },
  {
    name: "восстановление покупок снова врёт заплатившему (дефект 23.09.2026)",
    apply: (f) => ({ ...f, panel: f.panel.replace(/allPurchasedProductIdentifiers/g, "нетТакогоПоля") }),
  },
  {
    name: "исход «покупки были, но истекли» вырезан из текстов",
    apply: (f) => ({ ...f, copy: f.copy.replace(/restoredExpired:/g, "неНужныйКлюч:") }),
  },
  {
    name: "наша отмена снова трогает строки магазина",
    apply: (f) => ({ ...f, cancel: f.cancel.replace('provider !== "revenuecat"', 'provider !== "нет-такого"') }),
  },
];

function main() {
  const plant = process.argv.includes("--plant");
  const files = readAll();

  if (!plant) {
    const problems = judge(files);
    if (problems.length) {
      console.error("\nПОКУПКА ВНУТРИ ПРИЛОЖЕНИЯ — ПРАВИЛА НАРУШЕНЫ:");
      for (const p of problems) console.error(`  ${p}`);
      return 1;
    }
    const v = versions(files);
    console.log(
      `check:native-purchase — 13 правил, 0 нарушений. Версия оболочки ${v.fromConfig} в трёх местах ` +
        `(настройка, capacitor.config.ts, build.gradle); ключ магазина в одном файле; ` +
        `${REQUIRED_EVENTS.length} типов событий разбираются поимённо.`,
    );
    return 0;
  }

  let missed = 0;
  for (const p of PLANTS) {
    const before = judge(files).length;
    const mutated = p.apply(files);
    const changed = Object.keys(files).some((k) => mutated[k] !== files[k]);
    const after = judge(mutated).length;
    if (!changed) {
      console.error(`  ПОДСАДКА НЕ ПРИМЕНИЛАСЬ: ${p.name} — сторож и подсадка разошлись`);
      missed += 1;
      continue;
    }
    if (after <= before) {
      console.error(`  ПРОПУЩЕНО: ${p.name}`);
      missed += 1;
    } else {
      console.log(`  поймано: ${p.name} (${before} → ${after})`);
    }
  }
  if (missed) {
    console.error(`check:native-purchase --plant — ${missed} подсадок из ${PLANTS.length} НЕ поймано`);
    return 1;
  }
  console.log(`check:native-purchase --plant — поймано ${PLANTS.length} из ${PLANTS.length}`);
  return 0;
}

// Ничего не делает при простом импорте — правило `src/lib/entry-point.test.ts`.
// Оно записано кровью: `prisma/ensure-schema-sync.ts` кончался голым
// `main()`, и один импорт из теста направил мигратор на БОЕВУЮ базу.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
