import { describe, expect, it } from "vitest";
import { buildStoryQueue, splitStoryParagraphs, tidyPunctuationSpacing } from "@/lib/stories";

/**
 * Заход 7.240, задача 5: пробел перед знаком убирается ОДИН раз — в
 * `splitStoryParagraphs`, откуда абзацы берут страница, копия и скрипты
 * озвучки. Главное свойство — индексы не двигаются: номер предложения
 * (ключ клипа `<абзац>-<предложение>`) и номер токена (ключ вырезки
 * омографа `<абзац>-<предложение>-<токен>`).
 */
const WORD = /([а-яёА-ЯЁ]+(?:-[а-яёА-ЯЁ]+)*)/gu;
const tokens = (s: string) => s.split(WORD).filter((t) => t.length > 0);

describe("tidyPunctuationSpacing", () => {
  it("убирает пробел и неразрывный пробел перед . , ! ? : ;", () => {
    expect(tidyPunctuationSpacing("столом . Да , нет ! Как ? Так : вот ; всё")).toBe("столом. Да, нет! Как? Так: вот; всё");
    expect(tidyPunctuationSpacing("столом .")).toBe("столом.");
  });

  it("контроль: правильный текст не меняется ни на знак", () => {
    const clean = "Дети сидят за одним большим столом. У каждого — лист бумаги!";
    expect(tidyPunctuationSpacing(clean)).toBe(clean);
  });

  it("номера предложений и токенов те же, что у текста без пробелов", () => {
    const dirty = "Дети сидят за одним большим столом . У каждого ребёнка лист бумаги !\nСоня складывает журавлика , а потом лягушку ?";
    const clean = "Дети сидят за одним большим столом. У каждого ребёнка лист бумаги!\nСоня складывает журавлика, а потом лягушку?";
    const a = buildStoryQueue(splitStoryParagraphs(dirty));
    const b = buildStoryQueue(splitStoryParagraphs(clean));
    expect(a.map((s) => [s.paragraphIndex, s.sentenceIndex, s.text])).toEqual(
      b.map((s) => [s.paragraphIndex, s.sentenceIndex, s.text]),
    );
    // И без нормализации номера токенов-слов совпадают: пробел живёт внутри
    // небуквенного токена, так что нормализация не может их сдвинуть.
    const rawTokens = tokens("большим столом .");
    const tidyTokens = tokens("большим столом.");
    expect(rawTokens.length).toBe(tidyTokens.length);
    expect(rawTokens.indexOf("столом")).toBe(tidyTokens.indexOf("столом"));
  });
});
