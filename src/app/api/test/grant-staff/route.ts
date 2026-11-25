import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Test-only: делает вошедшую одноразовую учётку e2e «администратором»,
 * чтобы `e2e/owner-stats-opt-out.spec.ts` (заход 7.310) открыл настоящую
 * админку тем же путём, каким её открывает владелец, — через ворота
 * `proxy.ts` и `requireStaffUser`, без подделки сессии.
 *
 * 404 везде, кроме сервера, который поднимает `playwright.config.ts`
 * (`E2E_TEST_SEED=1`), — тот же приём и та же причина, что у
 * `/api/test/grant-subscription`: `next start` всегда ставит
 * NODE_ENV=production, поэтому отличать стенд можно только этим флагом.
 *
 * Роль «owner» не выдаётся намеренно: строке в шапке админки хватает
 * «admin», а владелец на сайте один.
 */
export async function POST() {
  if (process.env.E2E_TEST_SEED !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await db.user.update({ where: { id: user.id }, data: { role: "admin" } });
  return NextResponse.json({ granted: true, role: "admin" });
}
