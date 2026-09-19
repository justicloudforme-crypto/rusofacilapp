import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { IntroDocument } from "@/lib/intro/pdf";
import { getIntroStats } from "@/lib/intro/bank";
import { defaultLocale, isLocale } from "@/i18n/config";

/**
 * ДОЛГ 209: PDF РАЗДАЁТСЯ НА ЯЗЫКЕ ЛОКАЛИ, А НЕ ВСЕГДА ПО-ИСПАНСКИ.
 *
 * Язык приезжает признаком `?lang=`, а не сегментом пути: маршрут лежит
 * в `src/app/api/`, вне `[lang]`, и переносить его под локаль значило бы
 * менять адрес, на который уже ссылается живая страница и который может
 * лежать у людей в закладках. Неизвестное или отсутствующее значение
 * читается как `es` — ровно как раньше, то есть старый адрес
 * `/api/intro/pdf` работает без изменений и отдаёт ровно тот же файл,
 * что отдавал.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("lang") ?? "";
  const lang = isLocale(raw) ? raw : defaultLocale;

  // The same numbers the deck on /[lang]/courses shows, from the same
  // reader — so the downloaded PDF can never quote a different content
  // bank than the page it was downloaded from.
  const stats = await getIntroStats();
  const buffer = await renderToBuffer(<IntroDocument stats={stats} lang={lang} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      // Имя файла тоже про локаль: «introduccion» в русской колоде было
      // последней испанской строкой, которую видит человек.
      "Content-Disposition": `attachment; filename="rusofacilapp-${lang === "ru" ? "vvodnaya-prezentaciya" : "introduccion"}.pdf"`,
    },
  });
}
