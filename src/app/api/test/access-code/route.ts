import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { normalizeAccessCode } from "@/lib/access-code-format";

/**
 * Test-only: заведение и чтение строки `AccessCode` для браузерных проверок
 * (`e2e/access-code.spec.ts`). 404 везде, кроме сервера, который поднял
 * `playwright.config.ts` (`E2E_TEST_SEED=1`) — тот же приём и та же причина,
 * что у `/api/test/grant-subscription` и `/api/test/search-log`.
 *
 * ЗАЧЕМ ЭТОТ МАРШРУТ ПОЯВИЛСЯ, И ПОЧЕМУ ЭТО НЕ УДОБСТВО.
 *
 * Первая редакция спеки (7.147, долг 90) заводила коды ОТДЕЛЬНЫМ ПРОЦЕССОМ —
 * `scripts/e2e-access-code.ts` под `tsx` через `better-sqlite3`. На полном
 * прогоне в форме CI это роняло не спеку кодов, а весь набор, и механизм
 * этого назван числами ещё в 7.134: база в форме CI живёт в журнальном режиме
 * `delete` (`prisma db push` не включает WAL), а в нём любое второе соединение
 * исключает пишущего. libSQL под Prisma при этом не ждёт вовсе и на
 * столкновении «писатель против писателя» НЕ откатывает начатую транзакцию —
 * файл остаётся заблокированным, и все следующие запросы сервера отвечают
 * `P1008 / SocketTimeout`. Отсюда и подпись отказа в CI: падал не тот тест,
 * который писал, а `POST /api/auth/register` следующего.
 *
 * `PRAGMA busy_timeout` на стороне стенда этого не лечит: ждать умеет ТОЛЬКО
 * стенд, а ломается сторона сервера, которая не ждёт.
 *
 * Отсюда правило, записанное в 7.134 и нарушенное 7.147:
 * **базу e2e трогает ровно один процесс — сервер.** Всё, что спеке нужно от
 * таблицы, она спрашивает здесь.
 *
 * ПОЧЕМУ ЭТО НЕ ВТОРОЙ ПУТЬ К ДОСТУПУ. Маршрут заводит и читает БУМАЖКУ, а не
 * выдаёт доступ: `Subscription` он не пишет вовсе, решения «что этому человеку
 * открыто» не принимает, и погашение идёт по-прежнему единственным путём —
 * `redeemAccessCode` в `src/lib/access-code.ts`. Сторож
 * `npm run check:access-code-path` держит это числом: файл записан у него в
 * списке исключений, и исключение действует только пока в файле есть гейт
 * `E2E_TEST_SEED`.
 *
 * Приставка `E2E` обязательна — вторая защита после гейта, как `zz-` у
 * `/api/test/search-log`: даже на стенде этот маршрут не должен уметь трогать
 * строку настоящей партии.
 */
const REQUIRED_PREFIX = "E2E";
const DAY = 24 * 60 * 60 * 1000;

function guard(request: NextRequest, rawCode: string | null): { code: string } | NextResponse {
  if (process.env.E2E_TEST_SEED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const code = normalizeAccessCode(rawCode ?? "");
  if (!code.startsWith(REQUIRED_PREFIX)) {
    return NextResponse.json({ error: "code_must_start_with_e2e" }, { status: 400 });
  }
  return { code };
}

/** Завести строку. Форма кода та же, что у настоящей партии, — иначе стенд
 * проверял бы не тот вход. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { code?: unknown; days?: unknown; expired?: unknown; revoked?: unknown }
    | null;
  const checked = guard(request, typeof body?.code === "string" ? body.code : null);
  if (checked instanceof NextResponse) return checked;

  const days = Number.isInteger(body?.days) ? (body?.days as number) : 90;
  if (days < 1) return NextResponse.json({ error: "days_must_be_positive" }, { status: 400 });

  const now = Date.now();
  await db.accessCode.create({
    data: {
      code: checked.code,
      tier: "standard",
      durationDays: days,
      // Просроченный — вчерашним сроком годности. Скрипт выпуска такую партию
      // выдать отказывается («мертва в момент выпуска»), и это верно для
      // выпуска; стенду нужна ровно она.
      expiresAt: new Date(body?.expired === true ? now - DAY : now + 30 * DAY),
      batch: "E2E",
      revokedAt: body?.revoked === true ? new Date(now - 60_000) : null,
    },
  });
  return NextResponse.json({ created: checked.code, days });
}

/** Прочитать строку. Спека сверяет по ней, что отказ действительно не
 * израсходовал код, — а не выводит это из фразы на экране. */
export async function GET(request: NextRequest) {
  const checked = guard(request, new URL(request.url).searchParams.get("code"));
  if (checked instanceof NextResponse) return checked;

  const row = await db.accessCode.findUnique({
    where: { code: checked.code },
    select: {
      tier: true,
      durationDays: true,
      expiresAt: true,
      redeemedAt: true,
      redeemedById: true,
      revokedAt: true,
      revokedById: true,
    },
  });
  return NextResponse.json(row === null ? { found: false } : { found: true, ...row });
}
