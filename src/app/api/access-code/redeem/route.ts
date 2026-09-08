import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { redeemAccessCode } from "@/lib/access-code";
import { getRateLimiter } from "@/lib/rate-limit";
import { defaultLocale, isLocale } from "@/i18n/config";

/**
 * Погашение кода доступа вошедшим пользователем (PROGRESS.md 7.146).
 *
 * Обычная форма и редирект 303 обратно на `/profile`, как у отмены подписки
 * и у ручной выдачи: у страницы профиля нет клиентского состояния, и заводить
 * его ради одного поля значило бы завести второй способ узнать, что доступ
 * появился.
 *
 * Маршрут НЕ решает ничего о доступе сам: он передаёт код в
 * `redeemAccessCode`, а тот выдаёт доступ единственным вызовом
 * `extendOrGrantSubscription` — той же функцией, что обслуживает Stripe.
 *
 * Счётчик частоты обязателен и он здесь не про нагрузку. Код — короткая
 * строка из 26-буквенного алфавита; без ограничения его можно подобрать
 * перебором, и подобранный код — это выданный доступ. Двадцать попыток в
 * минуту на аккаунт: человек, переписывающий код с бумажки и путающий букву,
 * в это укладывается с запасом, перебор — нет.
 */
const redeemLimiter = getRateLimiter("access-code-redeem", 60_000, 20);

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const codeRaw = String(formData.get("code") ?? "");

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/${lang}/login?redirectTo=/${lang}/profile`, request.url),
      { status: 303 }
    );
  }

  const back = (outcome: string) =>
    NextResponse.redirect(
      new URL(`/${lang}/profile?tab=subscription&accessCode=${outcome}`, request.url),
      { status: 303 }
    );

  if (await redeemLimiter.check(user.id)) return back("rate_limited");

  const result = await redeemAccessCode(user, codeRaw);
  return back(result.ok ? "redeemed" : result.reason);
}
