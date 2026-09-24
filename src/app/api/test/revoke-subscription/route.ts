import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateSubscriptionCache } from "@/lib/subscription";

/**
 * Обратная сторона `/api/test/grant-subscription` — заход 7.229.
 *
 * ЗАЧЕМ ОНА ПОНАДОБИЛАСЬ. Офлайн-2 держит обещание «подписка кончилась —
 * сохранённый урок исчезает с телефона при первом же заходе с сетью».
 * Проверить такое обещание можно только НА ПЕРЕХОДЕ: сначала доступ
 * есть и копия появляется, потом доступа нет и копия исчезает. Выдача
 * без отзыва даёт половину замера, а половина замера — это не замер
 * (раздел 4 PROGRESS.md).
 *
 * 404 без `E2E_TEST_SEED` — ровно как у выдачи: признак ставит только
 * тот сервер, который поднимает `playwright.config.ts` для прогона, и ни
 * одно настоящее развёртывание его не ставит. Проверки `NODE_ENV` тут
 * недостаточно: `next start` всегда объявляет `production`, чем бы
 * сборка ни была.
 *
 * СТРОКИ УДАЛЯЮТСЯ, А НЕ ПОМЕЧАЮТСЯ ИСТЁКШИМИ, и это осознанно: в базе
 * прогона живут только учётные записи прогона (их заводит
 * `e2e/helpers/auth.ts` и выбрасывает вместе с контекстом браузера),
 * поэтому «истёкшая строка» здесь не проверяла бы ничего сверх «строк
 * нет», а стоила бы разговора о часовых поясах.
 */
export async function POST() {
  if (process.env.E2E_TEST_SEED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { count } = await db.subscription.deleteMany({ where: { userId: user.id } });
  await invalidateSubscriptionCache(user.id);
  return NextResponse.json({ revoked: count });
}
