import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * Test-only: чтение и удаление строк журнала спроса по ТОЧНОЙ строке
 * запроса. 404 везде, кроме сервера, который поднял `playwright.config.ts`
 * (`E2E_TEST_SEED=1`), — тот же приём и та же причина, что у
 * `/api/test/grant-subscription`.
 *
 * Зачем маршрут вообще нужен, хотя таблицу можно прочитать файлом.
 * Прочитать файлом и было первой редакцией `e2e/search-demand-log.spec.ts`
 * — и это оказалось долгом 58 (PROGRESS.md 7.134). База в форме CI живёт в
 * журнальном режиме `delete` (`prisma db push` не включает WAL), а в нём
 * ЛЮБОЕ второе соединение исключает пишущего: читатель держит SHARED и не
 * даёт серверу поднять свою запись до EXCLUSIVE, писатель держит RESERVED и
 * не даёт её начать. libSQL под Prisma при этом не ждёт вовсе — его
 * `busy_timeout` фактически нулевой, отказ приходит за 30 мс, — а на
 * столкновении «писатель против писателя» он ещё и НЕ откатывает начатую
 * транзакцию: `dev.db-journal` остаётся, файл остаётся заблокированным
 * навсегда, и все следующие записи уходят в невидимую снаружи транзакцию,
 * отвечая при этом `stored: true`. Измерено: 2 из 2 на подсадке внешней
 * блокировки, 30 из 30 параллельных записей ЧЕРЕЗ сервер — без единой
 * потери и без журнала.
 *
 * Отсюда правило стенда: базу e2e трогает ровно один процесс — сервер.
 * Всё, что тесту нужно от таблицы, он спрашивает здесь.
 *
 * Префикс `zz-` обязателен, и это не украшение: маршрут умеет удалять
 * строки, а метки спеки (`marker()`) и так все начинаются с `zz-demand-`.
 * Гейт `E2E_TEST_SEED` — первая защита, префикс — вторая, чтобы даже на
 * стенде нельзя было снести журнал целиком одним запросом.
 */
function guard(request: NextRequest): { marker: string } | NextResponse {
  if (process.env.E2E_TEST_SEED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const marker = new URL(request.url).searchParams.get("query") ?? "";
  if (!marker.startsWith("zz-")) {
    return NextResponse.json({ error: "marker_must_start_with_zz" }, { status: 400 });
  }
  return { marker };
}

export async function GET(request: NextRequest) {
  const checked = guard(request);
  if (checked instanceof NextResponse) return checked;

  const rows = await db.searchQuery.findMany({
    where: { query: checked.marker },
    select: { query: true, resultCount: true, lang: true, followed: true },
  });
  return NextResponse.json({ rows });
}

export async function DELETE(request: NextRequest) {
  const checked = guard(request);
  if (checked instanceof NextResponse) return checked;

  const { count } = await db.searchQuery.deleteMany({ where: { query: checked.marker } });
  return NextResponse.json({ deleted: count });
}
