/**
 * ДЕНЬГИ ВЕРНУЛИСЬ — ЕСТЬ ЧТО ОТОЗВАТЬ (ДОЛГИ 84, 85, 86).
 *
 * ЧТО СТОРОЖИТСЯ. Возврат денег приходит от Stripe с ОДНИМ ключом — тем
 * самым `PaymentIntent`. Чтобы по нему нашлась строка доступа, платёж
 * обязан быть записан в момент, когда деньги пришли. До 18.09.2026 таких
 * записей не было у двух случаев из трёх:
 *
 *   — у ПОВТОРЯЮЩЕГОСЯ счёта (месяц, год) платежа не знала ни одна
 *     колонка: строку доступа пишет событие о подписке, а `Stripe.Charge`
 *     ссылки на счёт не несёт вовсе (47 полей верхнего уровня, `invoice`
 *     среди них нет) — долг 84;
 *   — у ВТОРОГО платежа на ту же строку колонка `stripePaymentIntentId`
 *     затирала первый — долг 85.
 *
 * Оба чинятся одним: журналом `SubscriptionPayment`, где платёж — строка.
 * Долг 86 — третья сторона той же монеты: талон, оплаченный поверх уже
 * живого доступа, стоит вторых денег, и вернуть их нечем, пока непонятно,
 * какой именно платёж лишний.
 *
 * ПОЧЕМУ СТАТИКА. Живого Stripe в прогоне нет и быть не должно. Но все
 * четыре связи, которые здесь легко потерять, — это ВЫЗОВЫ в трёх файлах,
 * и потеря каждой молчалива: доступ выдаётся, вебхук отвечает 200, а
 * возврат через месяц не находит строки. Ровно так долг 84 и прожил.
 * Поведение тех же связей держат юниты (`src/lib/subscription.test.ts`,
 * `src/app/api/webhooks/stripe/route.test.ts`), здесь — что связи есть.
 *
 *   npx tsx scripts/check-refund-trace.ts
 *   npx tsx scripts/check-refund-trace.ts --plant     # контроль
 *   npx tsx scripts/check-refund-trace.ts --from=<каталог с тремя файлами>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isEntryPoint } from "@/lib/entry-point";

const SUBSCRIPTION = "src/lib/subscription.ts";
const WEBHOOK = "src/app/api/webhooks/stripe/route.ts";
const SCHEMA = "prisma/schema.prisma";

export interface Sources {
  subscription: string;
  webhook: string;
  schema: string;
}

/** Тело функции по её заголовку — счётом фигурных скобок, а не до первой
 * закрывающей: в этих файлах внутри функций есть и объекты, и строки с
 * фигурными скобками (та же ловушка, что стоила `ensure-schema-sync.ts`
 * четырёх невидимых полей). */
function body(text: string, header: string): string | null {
  const at = text.indexOf(header);
  if (at === -1) return null;

  // Сперва — КОНЕЦ СПИСКА ПАРАМЕТРОВ, счётом круглых скобок. Иначе первая
  // же фигурная скобка после заголовка оказывается не телом, а типом
  // параметра: `revokeAccessForPayment(reference: { … })` ровно такой, и
  // разбор «до первой {» молча читал бы тип вместо тела.
  let p = text.indexOf("(", at);
  if (p === -1) return null;
  let round = 1;
  p += 1;
  while (p < text.length && round > 0) {
    if (text[p] === "(") round += 1;
    else if (text[p] === ")") round -= 1;
    p += 1;
  }
  if (round !== 0) return null;

  // И только потом — тело. Между `)` и телом стоит ещё и тип результата,
  // а он тоже бывает фигурным: `): Promise<{ revoked: number; … }> {`.
  // Тело отличает перевод строки сразу за скобкой.
  let i = text.indexOf("{\n", p);
  if (i === -1) return null;
  let depth = 1;
  i += 1;
  const start = i;
  while (i < text.length && depth > 0) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") depth -= 1;
    i += 1;
  }
  return depth === 0 ? text.slice(start, i - 1) : null;
}

export function audit(src: Sources): string[] {
  const bad: string[] = [];

  // 1. Журнал платежей вообще существует.
  if (!/model\s+SubscriptionPayment\s*\{/.test(src.schema)) {
    bad.push(`${SCHEMA}: модели SubscriptionPayment нет — записывать платежи некуда (долги 84 и 85)`);
  }
  if (!/stripePaymentIntentId\s+String\s+@unique/.test(src.schema)) {
    bad.push(`${SCHEMA}: stripePaymentIntentId не уникален — повторная доставка события удвоит платёж`);
  }

  // 2. Выдача за деньги обязана записать платёж.
  const grant = body(src.subscription, "export async function extendOrGrantSubscription");
  if (!grant) {
    bad.push(`${SUBSCRIPTION}: не нашёл extendOrGrantSubscription — проверять нечего`);
  } else if (!/recordSubscriptionPayment\s*\(/.test(grant)) {
    bad.push(
      `${SUBSCRIPTION}: extendOrGrantSubscription не зовёт recordSubscriptionPayment — ` +
        `второй платёж на ту же строку снова станет неотзываемым (долг 85)`
    );
  }

  // 3. Возврат обязан спрашивать журнал.
  const revoke = body(src.subscription, "export async function revokeAccessForPayment");
  if (!revoke) {
    bad.push(`${SUBSCRIPTION}: не нашёл revokeAccessForPayment — проверять нечего`);
  } else {
    if (!/subscriptionPayment\.findUnique/.test(revoke)) {
      bad.push(
        `${SUBSCRIPTION}: revokeAccessForPayment не смотрит в журнал платежей — ` +
          `возврат подписки снова не найдёт строки (долг 84)`
      );
    }
    // Свойство узости: искать по человеку по-прежнему нельзя.
    if (/\buserId\b/.test(revoke) && !/userIds/.test(revoke.replace(/userIds/g, ""))) {
      // userIds (мн. ч.) — это выход функции, он законен; одиночный userId в
      // условии поиска означал бы «отозвать всё, что есть у человека».
    }
    if (/where:\s*\{\s*userId/.test(revoke)) {
      bad.push(`${SUBSCRIPTION}: revokeAccessForPayment ищет ПО ЧЕЛОВЕКУ — возврат заденет чужие основания доступа`);
    }
  }

  // 4. Повторяющийся счёт слушается.
  if (!/case\s+"invoice\.payment_succeeded"/.test(src.webhook)) {
    bad.push(
      `${WEBHOOK}: события invoice.payment_succeeded нет — платёж по месячному и годовому счёту ` +
        `снова не записывается никуда (долг 84)`
    );
  }
  if (!/recordSubscriptionPayment\s*\(/.test(src.webhook)) {
    bad.push(`${WEBHOOK}: обработчик не пишет платёж в журнал (долг 84)`);
  }

  // 5. Долг 86 — обе половины.
  // Именно ВЫЗОВ, а не объявление: объявление функции содержит то же имя
  // и ту же скобку, и проверка на имя «проходила» бы на коде, где гашение
  // написано и никем не зовётся.
  if (!/await\s+expireOutstandingVouchers\s*\(/.test(src.webhook)) {
    bad.push(
      `${WEBHOOK}: оплата картой не гасит непогашенный талон на тот же план — ` +
        `второй платёж за то же самое снова возможен (долг 86)`
    );
  }
  const asyncPaid = src.webhook.indexOf('case "checkout.session.async_payment_succeeded"');
  if (asyncPaid === -1) {
    bad.push(`${WEBHOOK}: не нашёл ветку checkout.session.async_payment_succeeded`);
  } else {
    const tail = src.webhook.slice(asyncPaid, asyncPaid + 4000);
    const report = tail.indexOf("reportDuplicatePaidGrant");
    const grantCall = tail.indexOf("extendOrGrantSubscription");
    if (report === -1) {
      bad.push(`${WEBHOOK}: оплаченный талон поверх живого доступа не докладывается — вторые деньги невидимы (долг 86)`);
    } else if (grantCall !== -1 && report > grantCall) {
      bad.push(
        `${WEBHOOK}: о двойной оплате докладывается ПОСЛЕ выдачи — к этому моменту «доступ уже был» ` +
          `истинно из-за самой выдачи, и доклад не сработает никогда (долг 86)`
      );
    }
  }

  return bad;
}

function read(dir: string): Sources {
  return {
    subscription: readFileSync(join(dir, SUBSCRIPTION), "utf8"),
    webhook: readFileSync(join(dir, WEBHOOK), "utf8"),
    schema: readFileSync(join(dir, SCHEMA), "utf8"),
  };
}

function plant(src: Sources): void {
  let ok = true;
  const say = (name: string, found: number, expectCaught: boolean) => {
    const verdict = expectCaught ? (found > 0 ? "ПОЙМАНО" : "ПРОПУЩЕНО") : found === 0 ? "ЧИСТО" : "ЛОЖНАЯ ТРЕВОГА";
    console.log(`  подсадка «${name}» → находок ${found}: ${verdict}`);
    if (expectCaught ? found === 0 : found !== 0) ok = false;
  };

  say("настоящий код", audit(src).length, false);
  say(
    "выдача перестала писать платёж (долг 85 назад)",
    audit({ ...src, subscription: src.subscription.replace(/await recordSubscriptionPayment\(\{/, "await noop({") }).length,
    true
  );
  say(
    "возврат перестал смотреть журнал (долг 84 назад)",
    audit({ ...src, subscription: src.subscription.replace(/subscriptionPayment\.findUnique/, "subscription.findFirst") }).length,
    true
  );
  say(
    "возврат стал искать по человеку",
    audit({
      ...src,
      subscription: src.subscription.replace(
        /const targets = await db\.subscription\.findMany\(\{\n\s*where: \{ OR: or \}/,
        "const targets = await db.subscription.findMany({\n    where: { userId: reference.paymentIntentId }"
      ),
    }).length,
    true
  );
  say(
    "обработчик перестал слушать счёт подписки",
    audit({ ...src, webhook: src.webhook.replace(/case "invoice\.payment_succeeded"/, 'case "invoice.nothing"') }).length,
    true
  );
  say(
    "карта перестала гасить талон (долг 86 назад)",
    audit({ ...src, webhook: src.webhook.replace(/await expireOutstandingVouchers\(stripe/, "await noop(stripe") }).length,
    true
  );
  say(
    "доклад о двойной оплате переехал ПОСЛЕ выдачи",
    audit({
      ...src,
      webhook: src.webhook.replace(
        /await reportDuplicatePaidGrant\(\{[\s\S]*?\}\);\n(\s*)await extendOrGrantSubscription\(/,
        "await extendOrGrantSubscription(REPORT_MOVED_BELOW, reportDuplicatePaidGrant("
      ),
    }).length,
    true
  );
  say(
    "модель журнала исчезла из схемы",
    audit({ ...src, schema: src.schema.replace(/model\s+SubscriptionPayment\s*\{/, "model SubscriptionPaymentRemoved {") }).length,
    true
  );
  say(
    "ключ платежа перестал быть уникальным",
    audit({ ...src, schema: src.schema.replace(/stripePaymentIntentId\s+String\s+@unique/, "stripePaymentIntentId String") }).length,
    true
  );

  console.log(ok ? "[check:refund-trace] контроль пройден: проверка умеет краснеть на каждой связи" : "[check:refund-trace] КОНТРОЛЬ ПРОВАЛЕН");
  if (!ok) process.exitCode = 1;
}

function main(argv: string[]): void {
  const fromArg = argv.find((a) => a.startsWith("--from="));
  const dir = fromArg ? fromArg.slice("--from=".length) : process.cwd();
  const src = read(dir);

  if (argv.includes("--plant")) return plant(src);

  const bad = audit(src);
  console.log(`[check:refund-trace] связей платежа со строкой доступа проверено 9, потеряно ${bad.length}${fromArg ? ` (дерево: ${dir})` : ""}`);
  for (const line of bad) console.log(`  ${line}`);
  if (bad.length) process.exitCode = 1;
  else console.log("  каждая выдача за деньги записана, возврат находит её и по подписке, и по второму платежу (контроль — --plant)");
}

if (isEntryPoint(import.meta.url)) main(process.argv.slice(2));
