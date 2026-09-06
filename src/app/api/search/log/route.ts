import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";
import { parseSearchDemandBody } from "@/lib/search/demand";

/**
 * Запись одного завершённого захода в поиск (PROGRESS.md 7.128, долг 50).
 *
 * Публичный и без авторизации — по той же причине, что и `/api/glossary`:
 * поиском пользуется аноним, и запись, которая работает только у вошедших,
 * измеряла бы не спрос, а долю вошедших.
 *
 * Адрес посетителя здесь ЕСТЬ — ровно один раз и только как ключ счётчика
 * частоты. Он живёт в Redis под ключом с TTL в минуту и в базу не попадает
 * ни в каком виде: `parseSearchDemandBody` возвращает четыре поля, и
 * записывается ровно то, что она вернула. Это разница между «мы знаем, кто
 * сейчас долбит маршрут» и «мы храним, кто что искал»; таблица про второе
 * не знает ничего.
 *
 * 60 записей в минуту с адреса: одна на заход в поиск, то есть даже очень
 * деятельный человек за минуту столько окон не закроет, а подделыватель
 * упрётся.
 */
const searchLogLimiter = getRateLimiter("searchLog", 60_000, 60);

export async function POST(request: NextRequest) {
  if (await searchLogLimiter.check(requestIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseSearchDemandBody(body, new Date());
  if (!parsed.valid) {
    // Пустая строка — не ошибка вызывающего, а нормальный случай: окно
    // открыли и закрыли, ничего не набрав. Отвечаем «принято, не
    // записано», чтобы клиенту незачем было повторять.
    if (parsed.error === "empty_query") return NextResponse.json({ ok: true, stored: false });
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Отказ записи не должен быть виден человеку, который просто закрыл окно
  // поиска: журнал спроса — побочная польза, а не часть работы поиска.
  try {
    await db.searchQuery.create({ data: parsed.value });
  } catch (error) {
    console.error("[search-log] не удалось записать запрос спроса", error);
    return NextResponse.json({ ok: true, stored: false });
  }

  return NextResponse.json({ ok: true, stored: true });
}
