"use client";

import { useState, type ReactNode } from "react";
import type { Slide } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import BrandMark from "./BrandMark";
import SpeakButton from "./SpeakButton";
import GlossaryText from "@/components/glossary/GlossaryText";
import { pickClip } from "@/lib/lessons/audioKeys";

type SlidesDict = Dictionary["lesson"]["slides"];

export default function SlidesTab({
  slides,
  illustrations,
  level,
  lessonSlug,
  canDownloadPdf,
  audioMap,
  dict,
}: {
  slides: Slide[];
  // Pre-rendered server-side per slide id — see LessonView/[lesson]/page.tsx.
  illustrations: Record<string, ReactNode>;
  level: string;
  lessonSlug: string;
  /**
   * Отдаст ли `/api/lessons/<level>/<lesson>/pdf` этому посетителю файл.
   *
   * Не то же самое, что `isLocked` у `LessonView`: первый урок каждого
   * уровня открыт всем, а PDF — нет. Маршрут просит АКТИВНУЮ подписку
   * (или сотрудника) и всем остальным отвечает `403 {"error":"Forbidden"}`.
   * До 07.09.2026 кнопка печаталась всё равно, и на четырёх открытых
   * уроках (`a1/1`, `a2/1`, `b1/1`, `b2/1`) в обеих локалях анонимный
   * посетитель, нажав её, получал json с ошибкой вместо файла — 4 из 5
   * не-200 целей всего обхода прода. Правило: ссылка либо ведёт туда,
   * где 200, либо не печатается.
   */
  canDownloadPdf: boolean;
  /**
   * Оплаченная озвучка урока (`/api/lesson-audio`). У примеров на слайдах
   * СВОЕГО позиционного ключа нет — генератор их не озвучивал ни разу, —
   * поэтому здесь работает запасной ключ по тексту (`pickClip`): 492
   * примера из 679 дословно совпадают со словарным словом или
   * грамматическим примером ТОГО ЖЕ урока, и клип для них уже оплачен и
   * лежит в Blob. До 7.163 все 679 кнопок уходили в браузерный синтез —
   * системный женский голос, запрещённый правилом владельца.
   */
  audioMap?: Record<string, string>;
  dict: SlidesDict;
}) {
  const [index, setIndex] = useState(0);

  /**
   * ВСЕ СЛАЙДЫ ЛЕЖАТ В РАЗМЕТКЕ, ВИДЕН ОДИН — ЗАХОД 7.235.
   *
   * До правки в документе был только текущий слайд. Скачанная копия
   * снимается с документа (`copyMarkupOf`), и без сети владелец
   * 26.09.2026 листал «Diapositiva 1 de 8» — и дальше первого не уходил:
   * остальных семи в копии просто не было, как не было и их клипов в
   * весе скачивания. Теперь у каждого слайда своя обёртка
   * (`data-rf-slide`) со своими стрелками и точками, а невидимые несут
   * `hidden`. В копии кнопки листания становятся переключателями без
   * скриптов (`offlineDeckOf` в `downloads-client.ts`).
   */
  const at = (i: number) => Math.max(0, Math.min(slides.length - 1, i));

  return (
    <div className="flex flex-col gap-6" data-rf-deck>
      {slides.map((slide, i) => {
        const counterLabel = dict.slideCounter
          .replace("{current}", String(i + 1))
          .replace("{total}", String(slides.length));
        return (
          <div key={slide.id} className="flex flex-col gap-6" data-rf-slide={i} hidden={i !== index}>
            <div className="relative">
              {/* Side arrows overlap the card edges, carousel-style, so a slide
                  can be flipped without reaching for the buttons below. */}
              <button
                type="button"
                onClick={() => setIndex(at(i - 1))}
                disabled={i === 0}
                aria-label={dict.prevSlide}
                data-rf-slide-go={at(i - 1)}
                className="tap absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background text-foreground shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-0 dark:border-white/15"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => setIndex(at(i + 1))}
                disabled={i === slides.length - 1}
                aria-label={dict.nextSlide}
                data-rf-slide-go={at(i + 1)}
                className="tap absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background text-foreground shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-0 dark:border-white/15"
              >
                →
              </button>

              <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-background shadow-sm dark:border-white/30">
                <div className="h-1.5 bg-gradient-to-r from-primary via-primary-400 to-premium-400" />

                <div className="p-6 sm:p-10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="h-28 w-40 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/[0.06] to-premium-400/[0.08]">
                      {illustrations[slide.id]}
                    </div>
                    <BrandMark size="sm" />
                  </div>

                  <span className="mt-6 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-text dark:bg-primary-400/15 dark:text-primary-400">
                    {counterLabel}
                  </span>

                  <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{slide.title}</h2>

                  <div className="mt-5 flex flex-col gap-3">
                    {slide.body.map((paragraph) => (
                      <GlossaryText key={paragraph} text={paragraph} className="leading-7 text-foreground/80" />
                    ))}
                  </div>

                  {slide.highlights && slide.highlights.length > 0 && (
                    <div className="mt-6 rounded-xl border border-primary/15 bg-primary/[0.04] p-4 dark:border-primary-400/20 dark:bg-primary-400/[0.06]">
                      <ul className="flex flex-col gap-2.5">
                        {slide.highlights.map((item) => (
                          <li key={item} className="flex items-start gap-3 text-sm leading-6 text-foreground/85">
                            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-gradient-to-br from-folk-red to-premium-400" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {slide.audioExamples && slide.audioExamples.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      {slide.audioExamples.map((example) => (
                        <div
                          key={example.text}
                          className="flex items-center gap-3 rounded-2xl border border-folk-red/20 bg-premium-400/[0.06] px-4 py-3"
                        >
                          <SpeakButton
                            text={example.text}
                            label={dict.listenLabel}
                            size="md"
                            audioUrl={pickClip(audioMap, null, example.text)}
                          />
                          <div className="flex flex-col leading-tight">
                            <span className="text-lg font-semibold">{example.text}</span>
                            {example.caption && <span className="text-xs text-foreground/60">{example.caption}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              {slides.map((s, j) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={s.title}
                  onClick={() => setIndex(j)}
                  data-rf-slide-go={j}
                  className={`tap h-1.5 rounded-full transition-all ${
                    j === i ? "w-6 bg-primary dark:bg-primary-400" : "w-1.5 bg-foreground/15 hover:bg-foreground/30 active:bg-foreground/30"
                  }`}
                />
              ))}
            </div>
          </div>
        );
      })}

      {canDownloadPdf && (
        <a
          href={`/api/lessons/${level}/${lessonSlug}/pdf`}
          className="tap inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
        >
          {dict.downloadPdfButton}
        </a>
      )}
    </div>
  );
}
