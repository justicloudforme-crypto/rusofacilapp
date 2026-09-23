import { NextResponse } from "next/server";
import { getEntitlementTier } from "@/lib/entitlement";

// Polled by the client-side paywall (see PaywallContext) right after a
// native RevenueCat purchase/restore resolves, to detect once the
// webhook-driven DB write has actually landed before triggering a
// content-refreshing router.refresh() — same webhook-propagation-delay
// concern e2e/helpers/auth.ts already works around for the test suite.
// Ответ зависит от учётной записи запроса и МЕНЯЕТСЯ ровно в тот момент,
// когда вебхук дописал строку доступа. Экран покупки спрашивает этот
// маршрут по кругу после оплаты, и закешированный ответ означал бы
// «доступ не пришёл» у человека, у которого он уже пришёл.
export const dynamic = "force-dynamic";

export async function GET() {
  const tier = await getEntitlementTier();
  return NextResponse.json({ tier });
}
