import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { lookupWordBankOne } from "@/lib/word-bank";
import { pickMyMemoryTranslation, type MyMemoryPayload } from "@/lib/mymemory-refusal";
import { TRANSLATION_CACHE_CONTROL, TRANSLATION_ERROR_CACHE_CONTROL } from "@/lib/translation-cache";

/**
 * Перевод ОДНОГО слова для карточки тапа в рассказе.
 *
 * ПОРЯДОК ИСТОЧНИКОВ — СВОЙ БАНК, ПОТОМ ЧУЖОЙ СЕРВИС (долг 169, заход
 * 7.188), и он не произволен:
 *
 *  1. `lookupWordBank` — наши карточки, глоссарий, однословные идиомы.
 *     Бесплатно, 0 запросов наружу, и перевод ВЕРНЕЕ чужого: он написан
 *     рукой для этого самого ученика. Снимает 32,1 % тапов (замер 7.188).
 *  2. MyMemory — чужая бесплатная память переводов, без ключа. Суточный
 *     потолок ≈916 тапов НА ВЕСЬ САЙТ и общий на всех учеников, потому
 *     что считается по IP исходящей функции Vercel. Каждый тап, который
 *     сюда НЕ дошёл, — это тап, который не отъел чужую квоту.
 *
 * ОТКАЗ ЧУЖОГО СЕРВИСА ПРИХОДИТ С HTTP 200 (долг 168). Разбор этого
 * случая вынесен в `mymemory-refusal.ts` целиком — здесь остаётся одно
 * правило: если переводом в ответе не является ничто, наружу идёт
 * ОШИБКА, а не строка сервиса. Карточка на ошибку уже умеет отвечать
 * честной фразой на языке ученика (`translationError` в `es.json`/`ru.json`),
 * и ни одной английской строки ученик не увидит.
 *
 * КЭШ. Перевод слова не меняется никогда, пока не поменяется банк или
 * чужая память, — а до 7.188 оба наших адреса отдавали
 * `max-age=0, must-revalidate` и `x-vercel-cache: MISS`, то есть один и
 * тот же тап стоил чужой квоты столько раз, сколько по слову нажали.
 * Теперь честный `Cache-Control` стоит на УСПЕХЕ; на отказе — `no-store`,
 * потому что запирать «не удалось» на сутки значило бы продлить чужую
 * аварию своими руками.
 */
const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const MAX_WORD_LENGTH = 64;
const REQUEST_TIMEOUT_MS = 5000;

export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get("word")?.trim() ?? "";
  if (!word || word.length > MAX_WORD_LENGTH) {
    return NextResponse.json({ error: "invalid_word" }, { status: 400 });
  }

  // ШАГ 1 — СВОЙ БАНК. Раньше чужого сервиса и без единого запроса наружу.
  const own = await lookupWordBankOne(word);
  if (own) {
    return NextResponse.json(
      { word, translation: own.translation, source: own.source },
      { headers: { "Cache-Control": TRANSLATION_CACHE_CONTROL } },
    );
  }

  // ШАГ 2 — чужой сервис, только для того, чего в банке нет.
  const upstreamUrl = new URL(MYMEMORY_ENDPOINT);
  upstreamUrl.searchParams.set("q", word);
  upstreamUrl.searchParams.set("langpair", "ru|es");

  try {
    const res = await fetch(upstreamUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) {
      return NextResponse.json(
        { error: "upstream_error" },
        { status: 502, headers: { "Cache-Control": TRANSLATION_ERROR_CACHE_CONTROL } },
      );
    }

    const data: MyMemoryPayload = await res.json();
    const translation = pickMyMemoryTranslation(data);
    if (!translation) {
      // Сюда попадают ОБА случая, и различать их для ученика незачем:
      // «сервис отказал» (квота, 429, предупреждение вместо перевода) и
      // «перевода нет». В обоих карточка скажет то же самое на его языке.
      return NextResponse.json(
        { error: "not_translated" },
        { status: 502, headers: { "Cache-Control": TRANSLATION_ERROR_CACHE_CONTROL } },
      );
    }

    return NextResponse.json(
      { word, translation, source: "mymemory" },
      { headers: { "Cache-Control": TRANSLATION_CACHE_CONTROL } },
    );
  } catch {
    return NextResponse.json(
      { error: "upstream_error" },
      { status: 502, headers: { "Cache-Control": TRANSLATION_ERROR_CACHE_CONTROL } },
    );
  }
}
