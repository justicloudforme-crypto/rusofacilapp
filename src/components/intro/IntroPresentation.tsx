"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics/react";
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

  /**
   * Three events, and nothing else: the deck was opened, somebody reached
   * its last slide, somebody downloaded the PDF. That is the whole
   * question this presentation could not answer before — is it read, and
   * is it read to the end.
   *
   * NOTHING PERSONAL IS SENT. The only property is `lang`, which is
   * already the first segment of the URL Vercel Analytics records anyway;
   * no user id, no email, no progress, no tier. `track` is a no-op until
   * Web Analytics is enabled for the project (see the comment beside
   * <Analytics /> in src/app/[lang]/layout.tsx), so shipping this ahead of
   * that toggle costs nothing and breaks nothing.
   *
   * Each fires at most once per mount — the "reached the end" event in
   * particular must not fire again every time somebody steps back one
   * slide and forward again.
   */
  const opened = useRef(false);
  const completed = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    track("intro_opened", { lang });
  }, [lang]);

  useEffect(() => {
    if (!isLastSlide || completed.current) return;
    completed.current = true;
    track("intro_completed", { lang });
  }, [isLastSlide, lang]);
  const counterLabel = dict.slideCounter
    .replace("{current}", String(index + 1))
    .replace("{total}", String(slides.length));

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(slides.length - 1, i + 1));

  return (
    <div className="flex flex-col gap-6" data-testid="intro-presentation">
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
          data-testid="intro-prev"
          className="tap absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-background text-foreground shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-0 dark:border-white/15"
        >
          ←
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={index === slides.length - 1}
          aria-label={dict.nextSlide}
          data-testid="intro-next"
          className="tap absolute right-0 top-1/2 z-10 translate-x-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-background text-foreground shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-0 dark:border-white/15"
        >
          →
        </button>

        <div
          data-testid="intro-slide-card"
          className="relative overflow-hidden rounded-2xl border border-black/10 bg-background shadow-sm dark:border-white/30"
        >
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary-400 to-premium-400" />

          <div className="p-6 sm:p-10">
            {/* Both children are flex-shrink-0 by design — the brand plate
                must not squash its wordmark, and the illustration has a fixed
                aspect. At 320px they do not fit on one line side by side
                (measured 06.09.2026: the plate's right edge landed at 335 and
                the card's `overflow-hidden` cut 40px of it off, unreachable),
                so the row is allowed to WRAP instead of overflow: the plate
                drops under the illustration and keeps its right alignment
                through `ml-auto`. Below `sm` the illustration is also one step
                smaller, which is what keeps 360px and up on a single line. */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="h-24 w-32 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/[0.06] to-premium-400/[0.08] sm:h-28 sm:w-40">
                <IntroIllustration icon={slide.icon} className="h-full w-full" />
              </div>
              <div className="ml-auto">
                <BrandMark size="sm" />
              </div>
            </div>

            <span className="mt-6 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-text dark:bg-primary-400/15 dark:text-primary-400">
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

            {/* Ссылки слайда — тоже элементы деки, и у них была высота 20px
                (кегль 14 без своей высоты строки): текстовая ссылка внутри
                абзаца этим правилом не накрыта, а отдельно стоящая под
                текстом — накрыта, палец целится именно в неё. Поэтому
                `min-h-11` и `inline-flex`, а не увеличение кегля: надпись
                выглядит как была, попадание — 44 px. */}
            {slide.links && slide.links.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-x-5">
                {slide.links.map((link) =>
                  link.external ? (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tap inline-flex min-h-11 items-center text-sm font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
                    >
                      {link.label} →
                    </a>
                  ) : (
                    <Link
                      key={link.href}
                      href={`/${lang}${link.href}`}
                      className="tap inline-flex min-h-11 items-center text-sm font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
                    >
                      {link.label} →
                    </Link>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The dot is 6×6 on purpose — a pager should read as a hint, not as
          a toolbar — but 6×6 is not a touch target. So the DOT stays the
          visual and the BUTTON around it is 44×44, which is the project's
          minimum. Ten of those need 440px and a phone has 320–393, so the
          strip is allowed to wrap: `max-w-[224px]` breaks it into 5 + 5 below
          `sm`, and one row of ten returns at `sm` and up where it fits. */}
      <div className="mx-auto flex max-w-[224px] flex-wrap items-center justify-center sm:max-w-none">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={s.title}
            data-testid="intro-dot"
            onClick={() => setIndex(i)}
            className="tap flex h-11 w-11 items-center justify-center"
          >
            <span
              aria-hidden
              className={`block h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-6 bg-primary dark:bg-primary-400"
                  : "w-1.5 bg-foreground/15 hover:bg-foreground/30 active:bg-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <a
          href={`/api/intro/pdf`}
          onClick={() => track("intro_pdf_downloaded", { lang })}
          data-testid="intro-pdf"
          className="tap inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
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
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.05] to-premium-400/[0.06] p-6 dark:border-primary-400/20">
          <h4 className="text-lg font-semibold tracking-tight">{dict.chooseLevelHeading}</h4>
          <p className="mt-1 text-sm text-foreground/70">{dict.chooseLevelSubtitle}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {levels.map((level) => (
              <Link
                key={level.slug}
                href={`/${lang}/courses/${level.slug}/1`}
                className="tap group flex flex-col rounded-xl border border-black/10 bg-background p-4 transition-colors hover:border-primary active:border-primary dark:border-white/30 dark:hover:border-primary-400 dark:active:border-primary-400"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-primary-text dark:text-primary-400">
                  {level.title}
                </span>
                <span className="mt-1 text-sm font-medium leading-tight">{level.subtitle}</span>
                <span className="mt-3 text-xs font-medium text-foreground/50 group-hover:text-foreground/80 group-active:text-foreground/80">
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
