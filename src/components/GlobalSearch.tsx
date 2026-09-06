"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { logSearchDemand } from "@/lib/search/log-client";
import { MAX_QUERY_LENGTH, SEARCH_DEBOUNCE_MS } from "@/lib/search/query";
import type { SearchResponse, SearchSection } from "@/lib/search/types";

interface Destination {
  href: string;
  label: string;
}

/**
 * Поиск по сайту. Cmd/Ctrl+K или 🔍 в шапке.
 *
 * Чем он был до 06.09.2026 и почему это чинилось. Замер 05.09.2026
 * (PROGRESS.md 7.127) прошёл по каждому разделу сайта, взял оттуда один
 * живой объект и ввёл его точное название: **0 из 13 разделов**. Искал
 * компонент по массиву из восьми пунктов меню, собранному прямо здесь, —
 * одной строкой `label.toLowerCase().includes(q)`. Ни ранжирования, ни
 * нормализации, ни объектов: `Три медведя`, `Катюша`, `sustantivo`,
 * `Planes y precios` не находились ни один.
 *
 * Что изменилось. Пустая строка по-прежнему печатает разделы сайта — и
 * по-прежнему без единого запроса: это навигация, и платить за неё сетью
 * незачем. Набранная строка уходит в `/api/search`, который ищет по
 * названиям всего каталога, группирует по разделам и говорит «показано N
 * из M».
 *
 * Адреса у поиска нет: `?q=` в строку браузера не пишется. Это не
 * недоделка — новых URL 0, и запись в `src/lib/site.ts` про намеренное
 * отсутствие `potentialAction: SearchAction` остаётся верной.
 */
export default function GlobalSearch({
  lang,
  dict,
  isLoggedIn,
}: {
  lang: Locale;
  dict: Dictionary;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const destinations = useMemo<Destination[]>(() => {
    const base: Destination[] = [
      { href: `/${lang}`, label: dict.nav.home },
      { href: `/${lang}/courses`, label: dict.nav.courses },
      { href: `/${lang}/stories`, label: dict.nav.stories },
      { href: `/${lang}/media`, label: dict.nav.media },
      { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary },
      { href: `/${lang}/word-games`, label: dict.nav.wordGames },
      { href: `/${lang}/pricing`, label: dict.nav.pricing },
      { href: `/${lang}/glossary`, label: dict.nav.glossary },
    ];
    if (isLoggedIn) {
      base.push({ href: `/${lang}/profile`, label: dict.nav.profile }, { href: `/${lang}/groups`, label: dict.nav.groups });
    }
    return base;
  }, [lang, dict, isLoggedIn]);

  const trimmed = query.trim();

  // Задержка ввода и отмена устаревшего ответа. Без отмены выдача на
  // «рас» могла бы прийти ПОСЛЕ выдачи на «рассказ» и затереть её —
  // гонка, которую видно только на медленной сети и которую поэтому
  // проще не допустить, чем поймать.
  //
  // Состояние переключается в обработчике ввода, а не внутри эффекта:
  // ввод — это событие, и «набрали букву → показываем ожидание» описывает
  // его честнее, чем эффект, который вычисляет то же самое задним числом.
  useEffect(() => {
    if (!open || !trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}&lang=${lang}`, { signal: controller.signal })
        .then((r) => (r.ok ? (r.json() as Promise<SearchResponse>) : null))
        .then((data) => {
          if (data) setResponse(data);
          setLoading(false);
        })
        .catch(() => {
          // Отменённый запрос — не ошибка; сетевой отказ оставляет
          // прежнюю выдачу вместо пустого экрана.
          if (!controller.signal.aborted) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmed, lang]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim()) {
      setLoading(true);
    } else {
      setLoading(false);
      setResponse(null);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Одна запись спроса на один ЗАХОД, а не на нажатие клавиши: строка на
  // каждое нажатие превратила бы сессию в упорядоченную цепочку «р», «ра»,
  // «рас» — а такая цепочка опознаёт посетителя надёжнее любого поля,
  // которого в таблице намеренно нет (см. src/lib/search/demand.ts).
  const followedRef = useRef(false);

  const close = useCallback(() => {
    logSearchDemand({
      query,
      resultCount: response?.total ?? 0,
      lang,
      followed: followedRef.current,
    });
    followedRef.current = false;
    setOpen(false);
    setQuery("");
    setResponse(null);
  }, [query, response, lang]);

  function follow() {
    followedRef.current = true;
    close();
  }

  const t = dict.search;
  const sectionLabel = (section: SearchSection) => t.sections[section];
  const showDestinations = trimmed.length === 0;
  const nothingFound = !showDestinations && !loading && response !== null && response.total === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={dict.nav.search}
        title={dict.nav.searchShortcutHint}
        className="tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-black/[.04] hover:text-foreground active:bg-black/[.04] active:text-foreground dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m17 17-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <Modal open={open} onClose={close} closeLabel={dict.nav.closeMenu} title={dict.nav.searchTitle} fullScreenOnMobile>
        <Input
          autoFocus
          type="search"
          value={query}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={dict.nav.searchPlaceholder}
          aria-label={dict.nav.searchTitle}
        />

        <div data-testid="global-search-results" className="mt-3">
          {showDestinations && (
            <ul className="flex flex-col gap-0.5">
              {destinations.map((d) => (
                <li key={d.href}>
                  <Link
                    href={d.href}
                    onClick={follow}
                    data-testid="search-result"
                    className="tap flex min-h-11 items-center rounded-lg px-3 text-sm text-foreground/85 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
                  >
                    {d.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!showDestinations && loading && response === null && (
            <p className="px-3 py-4 text-sm text-foreground/50">{t.loading}</p>
          )}

          {nothingFound && <p className="px-3 py-4 text-sm text-foreground/50">{dict.nav.searchEmpty}</p>}

          {!showDestinations && response !== null && response.total > 0 && (
            <div className="flex flex-col gap-4">
              {response.fuzzy && <p className="px-3 text-xs text-foreground/50">{t.fuzzyNote}</p>}

              {response.sections.map((section) => (
                <section key={section.section} data-testid={`search-section-${section.section}`}>
                  <h3 className="px-3 text-xs font-medium uppercase tracking-wide text-foreground/50">
                    {sectionLabel(section.section)}
                  </h3>

                  {section.collapsed ? (
                    // Раздел игр — одной строкой. 3277 пазлов носят
                    // шаблонные названия, и поштучно они вытеснили бы из
                    // выдачи все остальные разделы сразу.
                    <Link
                      href={section.collapsedHref ?? `/${lang}/word-games`}
                      onClick={follow}
                      data-testid="search-result"
                      data-collapsed="true"
                      className="tap mt-1 flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm text-foreground/85 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
                    >
                      <span>{t.gameCollapsed.replace("{count}", String(section.total))}</span>
                      <span className="flex-shrink-0 text-xs text-foreground/50">{t.gameCollapsedCta}</span>
                    </Link>
                  ) : (
                    <>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {section.hits.map((hit) => (
                          <li key={`${hit.section}:${hit.id}`}>
                            <Link
                              href={hit.href}
                              onClick={follow}
                              data-testid="search-result"
                              className="tap flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-sm text-foreground/85 transition-colors hover:bg-foreground/10 active:bg-foreground/10"
                            >
                              <span className="min-w-0">
                                <span className="block truncate">{hit.title}</span>
                                {hit.subtitle && (
                                  <span className="block truncate text-xs text-foreground/50">{hit.subtitle}</span>
                                )}
                              </span>
                              {hit.locked && (
                                <span
                                  data-testid="search-result-locked"
                                  className="flex-shrink-0 rounded-full border border-black/10 px-2 py-0.5 text-[11px] text-foreground/60 dark:border-white/20"
                                >
                                  {hit.lockReason === "premium" ? t.lockedPremium : t.lockedFree}
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      {section.total > section.hits.length && (
                        <p className="px-3 pt-1 text-xs text-foreground/50">
                          {t.shownOf
                            .replace("{shown}", String(section.hits.length))
                            .replace("{total}", String(section.total))}
                        </p>
                      )}
                    </>
                  )}
                </section>
              ))}

              <p className="px-3 text-xs text-foreground/50">
                {t.totalLine.replace("{total}", String(response.total))}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
