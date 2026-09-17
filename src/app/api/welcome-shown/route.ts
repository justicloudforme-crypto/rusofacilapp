import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRateLimiter } from "@/lib/rate-limit";
import { getRequestTimeZone } from "@/lib/timezone-server";
import { dateKeyIn } from "@/lib/timezone";

/**
 * «ЭТОМУ АККАУНТУ СЕГОДНЯ УЖЕ СКАЗАЛИ ЗДРАВСТВУЙТЕ» — ДОЛГ 234.
 *
 * Зовётся один раз в сутки, из `WelcomeOverlay`, ровно в тот миг, когда
 * приветствие показано. До 17.09.2026 такой записи не было вовсе: отметка
 * лежала только в куке, то есть на одном устройстве, и переустановка
 * приложения или второй телефон здоровались заново в тот же местный день.
 *
 * ДЕНЬ СЧИТАЕТ СЕРВЕР, И ТОЛЬКО СЕРВЕР. Тело запроса не читается вовсе:
 * если бы день приезжал из браузера, любой мог бы записать себе чужой
 * день — и, что важнее, появилось бы ВТОРОЕ определение суток, ровно то,
 * которым был болен долг 223. Зона берётся тем же `getRequestTimeZone`,
 * которым её берёт кабинет, ключ — тем же `dateKeyIn`.
 *
 * ПАДАТЬ ЭТОТ МАРШРУТ НЕ ИМЕЕТ ПРАВА. Колонка `welcomeShownDateKey`
 * добавляется на прод `prisma/ensure-schema-sync.ts` в начале сборки; если
 * по какой бы то ни было причине её там не окажется, запись бросит — и
 * тогда всё, что происходит, это возврат к поведению 7.204: замок
 * остаётся кукой, приветствие приходит НЕ ЧАЩЕ, чем приходило до этого
 * захода. Поэтому ошибка гасится и отвечает `stored: false`, а не 500:
 * приветствие — косметика, и ронять из-за неё кабинет нечем.
 */
const welcomeLimiter = getRateLimiter("welcome-shown", 60_000, 10);

export async function POST() {
  const user = await getCurrentUser();
  // Гостю кабинет не отдаётся вовсе, значит и приветствия он не видит.
  // Писать некуда — это не ошибка, а отсутствие аккаунта.
  if (!user) return NextResponse.json({ ok: true, stored: false });

  if (await welcomeLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const timeZone = await getRequestTimeZone(user.timezone);
  const todayKey = dateKeyIn(new Date(), timeZone);

  // Запись пропускается, когда отметка уже стоит на сегодня: браузер
  // зовёт этот маршрут не чаще раза в сутки, но лишняя запись в квоту
  // Turso всё равно стоит денег, а значение не меняется.
  if (user.welcomeShownDateKey === todayKey) {
    return NextResponse.json({ ok: true, stored: true, dateKey: todayKey });
  }

  try {
    await db.user.update({ where: { id: user.id }, data: { welcomeShownDateKey: todayKey } });
  } catch (error) {
    console.error("welcome-shown: не удалось записать отметку дня", error);
    return NextResponse.json({ ok: true, stored: false });
  }

  return NextResponse.json({ ok: true, stored: true, dateKey: todayKey });
}
