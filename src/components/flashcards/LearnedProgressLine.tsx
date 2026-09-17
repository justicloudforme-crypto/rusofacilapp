"use client";

import { learnedProgressText, type LearnedProgressDict } from "@/lib/flashcards/learned-progress";
import type { Locale } from "@/i18n/config";

/**
 * «LLEVAS 0 DE 230 PALABRAS DISPONIBLES…» — НА ВИДНОМ МЕСТЕ СЕТКИ ТЕМ
 * (долг 249, заход 7.207).
 *
 * ЧТО ИЗМЕРЕНО, И ЭТО НЕ ТО, ЧТО ЗАПИСАНО В ЖАЛОБЕ. Строка не «потерялась
 * и была вытеснена блоком Continuar»: она НИКОГДА и не стояла на сетке
 * тем. С коммита `f6d2675` и по сей день `learnedProgressText` зовётся из
 * четырёх мест, и все четыре — внутри `GameResultPanel`, то есть окна
 * итога РАУНДА. Владелец 7.204 видел её именно там, после доигранного
 * раунда «Emparejar»; на сетке тем её и не было.
 *
 * Но требование владельца — видеть её на самом экране, а не только после
 * раунда, — от этого не перестаёт быть верным: число «сколько мне вообще
 * открыто» человеку нужно ДО того, как он начнёт, а не после. Поэтому
 * строка появляется и здесь, одним общим кусочком на три режима, и
 * `learnedProgressText` по-прежнему одна на весь сайт — второго
 * предложения об одном и том же не заводится.
 *
 * ЧИСЛО НЕ ПЕЧАТАЕТСЯ ДО ОТВЕТА СЕРВЕРА (правило 7.204, часть 3).
 * `ready` — тот же признак, которым его спрашивает «Продолжить» рядом:
 * разрез, который сейчас в руках, обязан совпасть с выбранным уровнем.
 * Иначе на переключении уровня здесь на долю секунды стояло бы число
 * ПРЕДЫДУЩЕГО разреза, а это ровно «заглушка вместо нуля» наоборот.
 */
export default function LearnedProgressLine({
  dict,
  locale,
  ready,
  known,
  available,
  locked,
  lockedBySubscription,
}: {
  dict: LearnedProgressDict;
  locale: Locale;
  ready: boolean;
  known: number;
  available: number;
  locked: number;
  lockedBySubscription: number;
}) {
  if (!ready) return null;
  /**
   * ПУСТОЙ СТРОКЕ МЕСТА НА ЭКРАНЕ НЕТ (18.09.2026). `learnedProgressText`
   * отвечает пустой строкой ровно в одном случае: под этим разрезом нет
   * ни одного слова — ни открытого, ни закрытого. Сказать про такой
   * разрез нечего, и «0 из 0» было бы единственным, что тут можно
   * соврать.
   */
  const text = learnedProgressText(locale, dict, { known, available, locked, lockedBySubscription });
  if (!text) return null;
  return (
    <p
      data-learned-progress="grid"
      className="mb-4 text-center text-sm text-foreground/60"
    >
      {text}
    </p>
  );
}
