import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isOwner } from "@/lib/roles";
import { revokeAccessCode } from "@/lib/access-code";
import { defaultLocale, isLocale } from "@/i18n/config";

/**
 * ОТЗЫВ КОДА ДОСТУПА ИЗ ПАНЕЛИ — ОСТАТОК ДОЛГА 89 (заход 7.216).
 *
 * Главное здесь одно: исполнителем в `revokeAccessCode` уходит
 * `actor.id` — идентификатор ВОШЕДШЕГО владельца, взятый из сессии, а не
 * из тела запроса. Колонка `AccessCode.revokedById` несёт настоящий
 * внешний ключ на `User`, и подставить туда что-нибудь чужое из формы
 * значило бы отдать подпись отзыва в руки отправителя запроса.
 *
 * Роль проверяется ДО чтения формы и до любой записи — тем же правилом,
 * что у `/api/admin/subscriptions/revoke`.
 */
export async function POST(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor || !isOwner(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const code = String(formData.get("code") ?? "");

  // Ответ функции здесь не разбирается на три случая намеренно: экран
  // перерисовывается из базы, и состояние строки после отзыва он покажет
  // сам. Разбирать причину отказа в маршруте значило бы завести второе
  // место, где живёт правило «что с этим кодом можно сделать».
  await revokeAccessCode(code, actor.id);

  return NextResponse.redirect(new URL(`/${lang}/admin/access-codes`, request.url), { status: 303 });
}
