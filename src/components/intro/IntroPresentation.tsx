"use client";

import { useState } from "react";
import Link from "next/link";
import type { IntroSlide } from "@/lib/intro/content";
import IntroIllustration from "./IntroIllustration";
import BrandMark from "@/components/lesson/BrandMark";

export interface IntroPresentationDict {
  downloadPdfButton: string;
  prevSlide: string;
  nextSlide: string;
  slideCounter: string;
  chooseLevelHeading: string;
  chooseLevelSubtitle: string;
  startLevelLabel: string;
}

export interface IntroPresentationLevel {
  slug: string;
  title: string;
  subtitle: string;
}

export default function IntroPresentation({
  slides,
  lang,
  levels,
  dict,
}: {
  slides: IntroSlide[];
  lang: string;
  levels: IntroPresentationLevel[];
  dict: IntroPresentationDict;
}) {
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const isLastSlide = index === slides.length - 1;
  const counterLabel = dict.slideCounter
    .replace("{current}", String(index + 1))
    .replace("{total}", String(slides.length));

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(slides.length - 1, i + 1));

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        {/* Side arrows overlap the card edges, carousel-style, so a slide
            can be flipped without reaching for the buttons below. Same
            pattern as the lesson deck (SlidesTab.tsx), for a consistent
            "presentation" feel across the site. */}
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          aria-label={dict.prevSlide}
          className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background text-foreground shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-0 dark:border-white/15"
        >
          ←
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={index === slides.length - 1}
          aria-label={dict.nextSlide}
          className="absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background text-foreground shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-0 dark:border-white/15"
        >
          →
        </button>

        <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-background shadow-sm dark:border-white/10">
          <div className="h-1.5 bg-gradient-to-r from-brand via-brand-light to-brand-accent-light" />

          <div className="p-6 sm:p-10">
            <div className="flex items-start justify-between gap-4">
              <div className="h-28 w-40 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-brand/[0.06] to-brand-accent-light/[0.08]">
                <IntroIllustration icon={slide.icon} className="h-full w-full" />
              </div>
              <BrandMark size="sm" />
            </div>

            <span className="mt-6 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand dark:bg-brand-light/15 dark:text-brand-light">
              {counterLabel}
            </span>

            <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{slide.title}</h3>

            <div className="mt-5 flex flex-col gap-3">
              {slide.body.map((paragraph) => (
                <p key={paragraph} className="leading-7 text-foreground/80">
                  {paragraph}
                </p>
              ))}
            </div>

            {slide.highlights && slide.highlights.length > 0 && (
              <div className="mt-6 rounded-xl border border-brand/15 bg-brand/[0.04] p-4 dark:border-brand-light/20 dark:bg-brand-light/[0.06]">
                <ul className="flex flex-col gap-2.5">
                  {slide.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-foreground/85">
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-gradient-to-br from-brand-accent to-brand-accent-light" />
                      {item}
                    </li>
                  ))}
                </ul>
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
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-brand dark:bg-brand-light" : "w-1.5 bg-foreground/15 hover:bg-foreground/30"
            }`}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <a
          href={`/api/intro/pdf`}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
        >
          {dict.downloadPdfButton}
        </a>
      </div>

      {/* The one moment this presentation asks for a decision: after the
          last slide, offer all four levels at once instead of just
          defaulting to A1 — someone testing back into the course (or just
          confident from the intro) shouldn't have to hunt for the level
          picker elsewhere on the page. */}
      {isLastSlide && (
        <div className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand/[0.05] to-brand-accent-light/[0.06] p-6 dark:border-brand-light/20">
          <h4 className="text-lg font-semibold tracking-tight">{dict.chooseLevelHeading}</h4>
          <p className="mt-1 text-sm text-foreground/70">{dict.chooseLevelSubtitle}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {levels.map((level) => (
              <Link
                key={level.slug}
                href={`/${lang}/courses/${level.slug}/1`}
                className="group flex flex-col rounded-xl border border-black/10 bg-background p-4 transition-colors hover:border-brand dark:border-white/10 dark:hover:border-brand-light"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-brand dark:text-brand-light">
                  {level.title}
                </span>
                <span className="mt-1 text-sm font-medium leading-tight">{level.subtitle}</span>
                <span className="mt-3 text-xs font-medium text-foreground/50 group-hover:text-foreground/80">
                  {dict.startLevelLabel} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
