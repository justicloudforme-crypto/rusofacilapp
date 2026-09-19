// ПЕРЕПИСЬ СТРОК ПОДПИСКИ. ПРАВИТЬ ИМИ БОЛЬШЕ НЕЧЕГО — ДОЛГ 32 ЗАКРЫТ
// 18.09.2026 (заход 7.214).
//
// Строка долга дословно: «`raise-subscription-tier.mjs` поднимает `plan`
// на месте и требует самой свежей строки — обе посылки после 7.59
// неверны → сверка со Stripe по 7.58 всё-таки находит задетую строку
// (сейчас таких 0) → не запускать как есть: переписать под новую модель
// или удалить».
//
// ПЕРЕМЕРЕНО 18.09.2026, обе посылки действительно неверны:
//
//   1. «ПОДНИМАЕТ `plan` НА МЕСТЕ». Под нынешней моделью это неверная
//      ФОРМА РЕМОНТА, а не деталь. `extendOrGrantSubscription`
//      (`src/lib/subscription.ts`) ищет строку для продления только ТОГО
//      ЖЕ СОРТА (`isPremiumPlan(row.plan) === premiumGrant`), то есть
//      покупка Premium поверх месячной заводит СВОЮ строку. Поднять
//      `plan` у месячной строки сегодня значило бы схлопнуть две выдачи
//      в одну и потерять месячную.
//   2. «ТРЕБУЕТ САМОЙ СВЕЖЕЙ СТРОКИ». Доступ решает `tierOfAccount`, а он
//      читает ВСЕ строки человека (`getSubscriptionsForUser`), а не одну
//      свежую. «Быть самой свежей» перестало быть свойством безопасности
//      ещё в 7.59 — сторож, который этого требует, охраняет не то.
//
// ЗАМЕР НА ПРОДЕ 18.09.2026 (только SELECT, этим же `--list`): строк
// `Subscription` 6, строк с планом `lifetime` 0, людей с ДВУМЯ строками
// 0. То есть случая, ради которого скрипт писался, на проде не случилось
// ни разу.
//
// ЧТО ОСТАЛОСЬ. Только `--list` — перепись строк, чтение и ничего кроме.
// Запись отключена НЕ флагом, который можно снять, а отсутствием кода:
// если такая строка когда-нибудь найдётся, чинится она обычной
// админской выдачей (она заведёт отдельную строку Premium — ровно то,
// что сделала бы сегодняшняя покупка), а не правкой `plan` на месте.
//
// ================== ИСТОРИЯ, РАДИ КОТОРОЙ ФАЙЛ ЖИВ ==================
//
// Raise a Subscription row that a Premium payment failed to raise.
//
// Prepared, NOT run. Production held zero affected rows when this was
// written (PROGRESS.md 7.58) — the script exists because the answer to
// "who was affected" needs a Stripe cross-check the owner has to do by
// hand, and if that check turns up a row, the repair must already be
// written down rather than improvised against a live database.
//
// The defect it repairs (PROGRESS.md 7.55): between 24.08.2026 and
// 30.08.2026 a Premium purchase on top of an already-active subscription
// extended the period and left `plan` alone, so the buyer's row still
// said "monthly"/"annual"/"referral"/"manual" and getEntitlementTier kept
// answering "standard". The code is fixed; already-written rows are not.
//
// The safety rules are the same ones the glossary seed run (PROGRESS.md
// 7.27) and the blob delete script use, because they worked:
//
//   1. **--dry-run is the default.** Without --apply nothing is written,
//      and the run prints the exact before/after for every row in scope.
//   2. **--only=<subscriptionId>[,...] is mandatory.** There is no "all",
//      no "--all-affected", and no user-id form: the id of the exact row
//      to change has to be typed out, so a mistyped flag writes nothing
//      instead of everything.
//   3. **There is no --force.** Every guard passes on its own or the run
//      stops. A guard that can be waived is a guard that will be waived.
//   4. **The tier only ever goes up.** The new plan is a constant in this
//      file (PREMIUM_PLAN_ID), there is no --plan flag, and a row that is
//      already Premium is refused rather than rewritten — this script
//      cannot express a demotion.
//   5. **It refuses a row that is not the row it expected.** --expect-plan
//      must match what is actually stored, the row must still be active,
//      and it must be the newest row of that user (the only one
//      getLatestSubscription reads). Any mismatch stops the whole run
//      before a single write, because an unexpected shape means the
//      assumption is wrong, not that the row needs guessing at.
//
//   node scripts/raise-subscription-tier.mjs --list
//   node scripts/raise-subscription-tier.mjs --only=<id> --expect-plan=monthly
//   node scripts/raise-subscription-tier.mjs --only=<id> --expect-plan=monthly --apply
//
// Connection: PROD_TURSO_DATABASE_URL + PROD_TURSO_AUTH_TOKEN, or the
// TURSO_* pair, or DATABASE_URL for a local file. Nothing is read from a
// checked-in file and no token is ever written to one.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
// Ни форматтера даты, ни константы плана здесь больше нет: писать нечем,
// и держать их значило бы держать полуготовую правку под рукой (долг 32).
const INACTIVE_STATUSES = new Set(["canceled", "past_due", "incomplete_expired"]);

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);

// `--apply`, `--only` и `--expect-plan` сохранены как ВХОД, чтобы старая
// команда из документов не сделала вид, что сработала: она доходит до
// отказа и печатает причину. Читаются они уже только для этого.
const LIST = flag("list");

function connection() {
  const url = process.env.PROD_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.PROD_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  if (!url) return null;
  return authToken ? { url, authToken } : { url };
}

const isActive = (row) =>
  !INACTIVE_STATUSES.has(row.status) &&
  Date.parse(row.currentPeriodEnd) > Date.now() &&
  (row.status === "active" || row.status === "trialing");

function describe(row, newest) {
  return (
    `  ${row.id}\n` +
    `    user=${row.userId} plan=${row.plan} status=${row.status}\n` +
    `    periodEnd=${row.currentPeriodEnd} created=${row.createdAt} updated=${row.updatedAt}\n` +
    `    active=${isActive(row)} newestRowOfThisUser=${newest}`
  );
}

async function main() {
  const conn = connection();
  if (!conn) {
    console.error("No database URL in the environment (PROD_TURSO_DATABASE_URL / TURSO_DATABASE_URL / DATABASE_URL).");
    return 1;
  }
  const db = createClient(conn);

  const all = (
    await db.execute(
      `SELECT id, userId, plan, status, currentPeriodEnd, createdAt, updatedAt
       FROM Subscription ORDER BY userId, createdAt DESC`
    )
  ).rows.map((r) => ({ ...r }));

  const newestOf = new Map();
  for (const row of all) if (!newestOf.has(row.userId)) newestOf.set(row.userId, row.id);

  console.log(`Subscription rows: ${all.length}`);
  for (const row of all) console.log(describe(row, newestOf.get(row.userId) === row.id));

  if (LIST) return 0;

  // ДОЛГ 32. Единственная дверь к записи — и она заперта кодом, а не
  // флагом. Причина названа числом в шапке файла: обе посылки, на
  // которых стояла правка, после 7.59 неверны, а строк, которые она
  // чинила бы, на проде 0.
  console.error(
    "\nЗАПИСЬ ОТКЛЮЧЕНА (долг 32, закрыт 18.09.2026).\n" +
      "  Правка «поднять plan на месте» под нынешней моделью НЕВЕРНА: покупка Premium поверх\n" +
      "  месячной заводит ОТДЕЛЬНУЮ строку (extendOrGrantSubscription), и подъём plan у месячной\n" +
      "  схлопнул бы две выдачи в одну. Доступ решает tierOfAccount по ВСЕМ строкам человека,\n" +
      "  а не по самой свежей, — второе требование этого скрипта тоже перестало что-либо охранять.\n" +
      "  Если задетая строка всё-таки найдётся: чинить обычной админской выдачей Premium —\n" +
      "  она заведёт отдельную строку, ровно как сегодняшняя покупка. Здесь править нечем.\n" +
      "  Перепись строк по-прежнему доступна: --list.",
  );
  return 1;
}

// Only when this file is the process entry point — see src/lib/entry-point.ts.
const IS_ENTRY_POINT = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (IS_ENTRY_POINT) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
