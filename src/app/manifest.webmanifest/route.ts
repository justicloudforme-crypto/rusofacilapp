import { NextResponse } from "next/server";

import { defaultLocale } from "@/i18n/config";
import { pwaManifest } from "@/lib/pwa-manifest";

/**
 * КОРНЕВОЙ МАНИФЕСТ — СТАРЫЙ АДРЕС, ОТДАЮЩИЙ ИСПАНСКИЙ (ДОЛГ 83).
 *
 * ПОЧЕМУ НЕ СОГЛАШЕНИЕ `app/manifest.ts`, КОТОРОЕ ЗДЕСЬ БЫЛО. Соглашение
 * Next не только отдаёт файл, но и САМО вставляет `<link rel="manifest"
 * href="/manifest.webmanifest">` в каждую страницу — и вставка эта
 * побеждает `metadata.manifest` из раскладки. Замерено 19.09.2026 на
 * собранном приложении: при `manifest: "/${lang}/manifest.webmanifest"` в
 * `[lang]/layout.tsx` в разметке всё равно стоял корневой адрес, и
 * локальный манифест не читал никто. Обычный маршрут отдаёт тот же файл
 * по тому же адресу и ничего в страницы не вставляет.
 *
 * Зачем он вообще нужен, если у каждой локали свой. Ради уже
 * установленных копий: у них в системе записан ИМЕННО этот адрес, и
 * четырёхсотый ответ на нём — это сломанное приложение на чужом телефоне.
 * Локали у корня нет по построению, поэтому отдаётся испанский: на нём
 * написан продукт.
 */
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(pwaManifest(defaultLocale), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
