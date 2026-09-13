import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { lookupWordBank, BANK_LOOKUP_LIMIT } from "@/lib/word-bank";
import { bankKey } from "@/lib/translation-normalize";
import { TRANSLATION_CACHE_CONTROL } from "@/lib/translation-cache";

/**
 * Словарь «слово → перевод» для ОДНОГО ВИДИМОГО АБЗАЦА — шаг 3 долга 169
 * (заход 7.188).
 *
 * ГЛАВНОЕ СВОЙСТВО АДРЕСА: ОН НЕ ХОДИТ НАРУЖУ НИКОГДА. Ни одной ветки в
 * MyMemory здесь нет и быть не может — в этом весь смысл. Предзагрузка
 * по построению спрашивает пачку слов сразу, и если бы пачка умела
 * уходить в чужой сервис, один прокрученный рассказ расстрелял бы
 * суточную квоту (≈916 тапов на весь сайт) за полминуты. Слово, которого
 * в банке нет, в ответе просто отсутствует — и спросится по тапу, по
 * одному, как и до 7.188.
 *
 * ПОЧЕМУ ТОЛЬКО ВИДИМЫЙ АБЗАЦ, а не рассказ целиком: в рассказе 174
 * слова в среднем, и «загрузить всё сразу» — это запрос, который читает
 * банк ради слов, до которых ученик может не долистать вовсе. Абзац —
 * 40–60 слов, и они у него перед глазами.
 *
 * ПОЧЕМУ GET, а не POST: ответ обязан лечь в кэш — и на грани Vercel, и
 * в браузере. POST не кэшируется ничем.
 *
 * Публичный и без авторизации — по той же причине, что и `/api/word-audio`:
 * перевод слова не открывает ничего, чего страница рассказа уже не
 * показала.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("words") ?? "";
  const words = raw
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, BANK_LOOKUP_LIMIT);

  if (words.length === 0) {
    return NextResponse.json({ error: "invalid_words" }, { status: 400 });
  }

  const found = await lookupWordBank(words);
  const translations: Record<string, string> = {};
  for (const word of words) {
    const key = bankKey(word);
    const hit = key ? found.get(key) : null;
    if (key && hit) translations[key] = hit.translation;
  }

  return NextResponse.json(
    { translations, asked: words.length, found: Object.keys(translations).length },
    { headers: { "Cache-Control": TRANSLATION_CACHE_CONTROL } },
  );
}
