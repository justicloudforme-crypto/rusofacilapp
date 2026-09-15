import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { destroySession } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/i18n/config";
import { SIGNED_OUT_PARAM } from "@/lib/signed-out";

export async function POST(request: NextRequest) {
  await destroySession();

  const formData = await request.formData();
  const langRaw = String(formData.get("lang") ?? "");
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;

  // Признак «только что вышли» — для уборщика личных копий на странице
  // (`SignedOutCachePurge`, заход 7.198, часть 1). Выход менял ответ
  // сервера и не трогал ни одной копии страниц вошедшего человека,
  // которые service worker уже сложил себе в кеш: офлайн они всплывали
  // с его именем в шапке и его данными в профиле.
  //
  // Признак в адресе, а не в куке: кука пережила бы выход ровно тем же
  // способом, каким его переживала сессия (запись в webview идёт пачками
  // и на закрытии теряется — см. `MainActivity.onPause`), то есть
  // лечился бы дефект средством, которое болеет тем же самым. Страница
  // стирает признак из адреса первым же действием.
  const target = new URL(`/${lang}`, request.url);
  target.searchParams.set(SIGNED_OUT_PARAM, "1");
  return NextResponse.redirect(target, { status: 303 });
}
