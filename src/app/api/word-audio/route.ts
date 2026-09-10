import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { wordClipUrl } from "@/lib/story-word-audio";

/**
 * «Есть ли оплаченный клип у этого слова» — для тапа по слову внутри
 * рассказа (долг 123, заход 7.166).
 *
 * Отдельным адресом, а не полем в `/api/dictionary/translate`, по двум
 * причинам. Первая: перевод ходит во ВНЕШНИЙ бесплатный сервис
 * (MyMemory), и его отказ не имеет права утащить за собой озвучку —
 * отказы должны быть независимы. Вторая: заморозка. Клип обязан
 * находиться НЕ через серверный HTML страницы рассказа, иначе подключение
 * озвучки сдвинуло бы разметку 65 замороженных рассказов до 26.09; ответ
 * этого адреса в HTML не попадает вовсе.
 *
 * Публичный и без авторизации — как `/api/lesson-audio` и по той же
 * причине: адрес клипа не открывает ничего, чего страница уже не
 * показала, а сами .mp3 в Blob и так публичны. Слово, у которого клипа
 * нет, отвечает 200 и `audioUrl: null`, а не ошибкой: «клипа нет» —
 * штатное состояние, а не сбой.
 */
export async function GET(request: NextRequest) {
  const word = request.nextUrl.searchParams.get("word")?.trim() ?? "";
  if (!word || word.length > 64) {
    return NextResponse.json({ error: "invalid_word" }, { status: 400 });
  }
  const audioUrl = await wordClipUrl(word);
  return NextResponse.json({ word, audioUrl });
}
