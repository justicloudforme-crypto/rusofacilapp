"use client";

import { useState, type ReactNode } from "react";
import type { Slide } from "@/lib/lessons/types";
import type { Dictionary } from "@/i18n/dictionaries";
import BrandMark from "./BrandMark";
import SpeakButton from "./SpeakButton";
import GlossaryText from "@/components/glossary/GlossaryText";

type SlidesDict = Dictionary["lesson"]["slides"];

export default function SlidesTab({
  slides,
  illustrations,
  level,
  lessonSlug,
  dict,
}: {
  slides: Slide[];
  // Pre-rendered server-side per slide id — see LessonView/[lesson]/page.tsx.
  illustrations: Record<string, ReactNode>;
  level: string;
  lessonSlug: string;
  dict: SlidesDict;
}) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const counterLabel = dict.slideCounter
    .replace("{current}", String(index + 1))
    .replace("{total}", String(slides.length));

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(slides.length - 1, i + 1));

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        {/* Side arrows overlap the card edges, carousel-style, so a slide
            can be flipped without reaching for the buttons below. */}
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          aria-label={dict.prevSlide}
          className="tap absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background text-foreground shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-0 dark:border-white/15"
        >
          ←
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={index === slides.length - 1}
          aria-label={dict.nextSlide}
          className="tap absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background text-foreground shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-0 dark:border-white/15"
        >
          →
        </button>

        <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-background shadow-sm dark:border-white/10">
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
                    <SpeakButton text={example.text} label={dict.listenLabel} size="md" />
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
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={s.title}
            onClick={() => setIndex(i)}
            className={`tap h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-primary dark:bg-primary-400" : "w-1.5 bg-foreground/15 hover:bg-foreground/30 active:bg-foreground/30"
            }`}
          />
        ))}
      </div>

      <a
        href={`/api/lessons/${level}/${lessonSlug}/pdf`}
        className="tap inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
      >
        {dict.downloadPdfButton}
      </a>
    </div>
  );
}
