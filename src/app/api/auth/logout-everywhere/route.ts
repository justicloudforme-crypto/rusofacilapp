import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, createSession } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/i18n/config";

// "Sign out other devices" — bumps sessionVersion (invalidating every
// previously-issued session token at once, see session-token.ts) and then
// immediately re-issues a fresh cookie for THIS device/browser, so the one
// used to click the button stays signed in.
//
// ДВА ВИДА ОТВЕТА, И ЭТО НЕ УДОБСТВО (заход 7.218). Просящему JSON
// (кнопка кабинета, `LogoutEverywhereButton`) отвечаем 200 и телом —
// страница остаётся на месте, а свежая куки приезжает тем же ответом.
// Всем остальным — прежний 303 на кабинет: форма без JS обязана
// работать, и она работает.
//
// Почему это важнее, чем кажется: признак сеанса ЭТОГО устройства
// живёт только в заголовке `Set-Cookie` вот этого ответа. Навигация,
// оборвавшаяся по дороге (замер владельца 20.09.2026:
// `ERR_NETWORK_CHANGED` на проде), оставляла в базе увеличенную версию
// сеанса, а на устройстве — старую куки. То есть человека выкидывало из
// аккаунта ровно той кнопкой, которая обещает «кроме этого устройства».
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/${lang}/login`, request.url), { status: 303 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  await createSession(updated.id, updated.sessionVersion);

  if ((request.headers.get("Accept") ?? "").includes("application/json")) {
    return NextResponse.json({ ok: true, sessionVersion: updated.sessionVersion });
  }

  return NextResponse.redirect(
    new URL(`/${lang}/profile?tab=security&loggedOutEverywhere=1`, request.url),
    { status: 303 }
  );
}
