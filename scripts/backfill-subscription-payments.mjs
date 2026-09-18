/**
 * ПЕРЕНОС УЖЕ СОВЕРШЁННЫХ ПЛАТЕЖЕЙ В ЖУРНАЛ — СЦЕНАРИЙ, А НЕ ЗАПУСК
 * (заход 7.214, задача 2).
 *
 * ====================================================================
 * ЗАЧЕМ ЭТО СУЩЕСТВУЕТ
 * ====================================================================
 *
 * Заход 7.213 завёл таблицу `SubscriptionPayment` (один платёж — одна
 * строка) и научил `revokeAccessForPayment` спрашивать её. Но пишется она
 * начиная с НОВЫХ платежей, а у живых подписок деньги уже прошли ДО
 * выката.
 *
 * ЗАМЕР НА ПРОДЕ 18.09.2026 (только SELECT): строк `Subscription` — 6,
 * из них подписок Stripe — 2, строк в `SubscriptionPayment` — 0, строк с
 * заполненным `Subscription.stripePaymentIntentId` — 0. То есть если
 * владелец сегодня вернёт деньги по любому из уже прошедших платежей
 * этих двух подписок, `revokeForRefundedCharge` получит `PaymentIntent`,
 * не найдёт по нему ни строки доступа, ни строки журнала и отзовёт
 * **0 из 2**. Доступ останется открытым, а в Sentry ляжет
 * `RefundLeftAccessOpen` — то есть молча это не пройдёт, но и само не
 * починится.
 *
 * ====================================================================
 * ПОЧЕМУ ЭТОТ ФАЙЛ НИЧЕГО НЕ ПИШЕТ
 * ====================================================================
 *
 * Перенос требует ДВУХ вещей, которых у захода 7.214 не было:
 *
 *   1. КЛЮЧ STRIPE. Номер платежа (`PaymentIntent`) по прошедшему счёту
 *      знает только Stripe: в нашей базе его нет ни в одной колонке.
 *      Ключ в заход не вкладывался намеренно.
 *   2. ЗАПИСЬ В БОЕВУЮ БАЗУ. Заходу 7.214 любая команда записи против
 *      прода была запрещена условием.
 *
 * Поэтому здесь — сухой прогон: поимённый список строк, которые будут
 * записаны, и точные значения всех полей. Запись включается только
 * двумя флагами сразу и только в заходе, которому она разрешена.
 *
 * ====================================================================
 * ЧТО ВЛАДЕЛЬЦУ РЕШАТЬ
 * ====================================================================
 *
 * Переносить не обязательно, и вот честная цена обоих путей числом:
 *
 *   · НЕ ПЕРЕНОСИТЬ. Подписка `monthly` пишет строку журнала САМА при
 *     первом же продлении (ветка `invoice.payment_succeeded`). Из двух
 *     живых подписок одна продлевается 30.09.2026 — она станет
 *     отслеживаемой сама, без единой правки. Вторая отменена
 *     (`canceledAt` 19.08.2026) и продлеваться не будет никогда, то есть
 *     её платежи останутся неотслеживаемыми навсегда.
 *   · ПЕРЕНЕСТИ. Обе становятся отслеживаемыми сразу, но это запись в
 *     боевую базу по данным из чужой панели.
 *
 *   node scripts/backfill-subscription-payments.mjs              # сухой прогон
 *   node scripts/backfill-subscription-payments.mjs --apply --yes-write-to-prod
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply") && argv.includes("--yes-write-to-prod");

function env() {
  const file = argv.find((a) => a.startsWith("--env="))?.slice(6) ?? ".env.turso";
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/** Строки, которым перенос нужен: подписка Stripe без единой строки журнала. */
export function needBackfill(subscriptions, journalRows) {
  const haveJournal = new Set(journalRows.map((r) => r.subscriptionId));
  return subscriptions.filter((s) => s.stripeSubscriptionId && !haveJournal.has(s.id));
}

/** Что именно будет записано на одну строку — без Stripe известно всё,
 *  кроме номера платежа. Ровно это и показывает сухой прогон. */
export function plannedRow(subscription, paymentIntentId) {
  return {
    userId: subscription.userId,
    subscriptionId: subscription.id,
    stripePaymentIntentId: paymentIntentId ?? "<нужен ключ Stripe: последний счёт этой подписки>",
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    plan: subscription.plan,
    source: "backfill",
  };
}

async function main() {
  const e = env();
  const db = createClient({ url: e.TURSO_DATABASE_URL, authToken: e.TURSO_AUTH_TOKEN });

  const subs = (
    await db.execute(
      "SELECT id, userId, plan, status, stripeSubscriptionId, stripeCustomerId, stripePaymentIntentId, canceledAt, currentPeriodEnd FROM Subscription",
    )
  ).rows;
  const journal = (await db.execute("SELECT id, subscriptionId FROM SubscriptionPayment")).rows;

  console.log(`Строк Subscription: ${subs.length}`);
  console.log(`Из них подписок Stripe: ${subs.filter((s) => s.stripeSubscriptionId).length}`);
  console.log(`Строк SubscriptionPayment: ${journal.length}`);

  const need = needBackfill(subs, journal);
  console.log(`\nНУЖДАЮТСЯ В ПЕРЕНОСЕ: ${need.length} из ${subs.filter((s) => s.stripeSubscriptionId).length}`);
  for (const s of need) {
    console.log(`\n  подписка ${s.id} (${s.plan}, Stripe ${s.stripeSubscriptionId})`);
    console.log(`    отменена: ${s.canceledAt ?? "нет"}; срок до ${s.currentPeriodEnd}`);
    console.log(`    БУДЕТ ЗАПИСАНА строка: ${JSON.stringify(plannedRow(s, null), null, 0)}`);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.log(
      "\nSTRIPE_SECRET_KEY не задан — номера платежей взять негде, и это НЕ ошибка скрипта:\n" +
        "  сухой прогон показывает всё, кроме них. Дальше нужен ключ Stripe.",
    );
  }

  if (!APPLY) {
    console.log("\nСУХОЙ ПРОГОН — в базу не записано ни строки. Запись: --apply --yes-write-to-prod");
    return 0;
  }
  console.log("\nОТКАЗ: запись включена флагами, но номеров платежей нет — писать нечего.");
  return 1;
}

const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
