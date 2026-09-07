"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { SearchDemandSession } from "@/lib/search/demand-session";
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
 *
 * Enter — с 07.09.2026 (PROGRESS.md 7.133, часть 1). До этого дня на поле
 * не висело НИ ОДНОГО обработчика `keydown` (замерено на живом проде
 * инструментированным `addEventListener`: 0 из 64 конфигураций), формы
 * вокруг поля не было тоже — то есть Enter не ломался, он не был написан
 * вовсе, и человек, набравший слово и нажавший Enter, получал молчание.
 * Теперь Enter уводит на первый результат выдачи; подробности и границы —
 * у `onSearchKeyDown` ниже.
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
  const pathname = usePathname();
  const router = useRouter();

  // Enter, нажатый до того, как пришла выдача на ЭТУ строку. Хранится как
  // намерение, а не как действие: человек уже сказал «веди», отвечать
  // молчанием только потому, что задержка ввода ещё не истекла, — это тот
  // же отказ, с которого начался заход.
  const [enterPending, setEnterPending] = useState(false);
  // Пропустить задержку ввода один раз: Enter — это конец набора, ждать
  // после него нечего.
  const [flushNow, setFlushNow] = useState(false);

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
    }, flushNow ? 0 : SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmed, lang, flushNow]);

  function onQueryChange(value: string) {
    setQuery(value);
    // Новая буква отменяет и намерение уйти, и разовую отмену задержки:
    // человек продолжает набирать, а не подтверждает набранное.
    setEnterPending(false);
    setFlushNow(false);
    if (value.trim()) {
      setLoading(true);
    } else {
      setLoading(false);
      setResponse(null);
    }
  }

  // Одна запись спроса на один ЗАХОД, а не на нажатие клавиши: строка на
  // каждое нажатие превратила бы сессию в упорядоченную цепочку «р», «ра»,
  // «рас» — а такая цепочка опознаёт посетителя надёжнее любого поля,
  // которого в таблице намеренно нет (см. src/lib/search/demand.ts).
  //
  // ЧТО ЗДЕСЬ ИЗМЕНИЛОСЬ 06.09.2026 (долг 52). До этого дня запись жила
  // ровно в `close()`, то есть существовала только для тех выходов, у
  // которых `close()` вызывается: Escape, крестик, тап по затемнению и
  // переход по строке выдачи. Выходы, которых `close()` не видит, давали
  // НОЛЬ записей: уход на другой адрес с открытым окном и закрытие
  // вкладки. Перекос односторонний — «искал, не нашёл и ушёл» кончается
  // уходом со страницы чаще, чем аккуратным Escape, — поэтому журнал
  // недосчитывал именно те заходы, ради которых заводился.
  //
  // Теперь решение «пора писать» вынесено в `SearchDemandSession` и
  // сделано однократным, а поводов его принять — четыре семейства, и
  // каждый из них отправляет запись сам:
  //
  //   1. `close()` — Escape, крестик, затемнение (Modal.tsx);
  //   2. `follow()` — переход по строке выдачи;
  //   3. `pagehide` / `visibilitychange` — закрытие вкладки, уход на
  //      другой адрес, сворачивание приложения на телефоне;
  //   4. смена `pathname` — уход БЕЗ перезагрузки документа: аппаратная
  //      «назад» на Android (NativeBackButtonHandler → history.back()),
  //      «назад» браузера, любой router.push. Шапка живёт в раме и не
  //      размонтируется, pagehide при этом не наступает вовсе.
  //
  // Двух строк на один заход это не даёт: `flush()` отдаёт запись ровно
  // один раз за открытие окна, и Escape, за которым следом закрыли
  // вкладку, — это по-прежнему одна строка.
  // `useState` с ленивым инициализатором, а не `useRef`: экземпляр нужен
  // один на всё время жизни компонента, а читать `ref.current` во время
  // рендера правило проекта запрещает (и правильно — это чтение
  // изменяемого состояния в момент, когда React считает рендер чистым).
  const [demand] = useState(() => new SearchDemandSession());

  /** Отправить запись, если этот заход её ещё не отправил. Идемпотентна
   * намеренно: её зовут четыре разных выхода, и какой из них наступит
   * первым — неизвестно. */
  const send = useCallback(() => {
    const record = demand.flush();
    if (record) logSearchDemand(record);
  }, [demand]);

  const openWindow = useCallback(() => {
    demand.open(lang);
    setOpen(true);
  }, [demand, lang]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openWindow();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openWindow]);

  // Что человек видел в момент ухода — последнее значение, а не то, что
  // было на момент подписки обработчика.
  useEffect(() => {
    demand.update({ query, resultCount: response?.total ?? 0 });
  }, [demand, query, response]);

  // Выходы, которых `close()` не видит. Подписка только на время
  // открытого окна: закрытие вкладки без открытого поиска — не заход.
  useEffect(() => {
    if (!open) return;
    function onPageHide() {
      send();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") send();
    }
    // `pagehide`, а не `beforeunload`: второй не наступает на iOS вовсе и
    // отменяет bfcache там, где наступает. `visibilitychange` — вторая
    // половина того же: на телефоне вкладку чаще сворачивают, чем
    // закрывают, и до `pagehide` дело может не дойти никогда.
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [open, send]);

  // Уход на другой адрес без перезагрузки документа. На первом рендере
  // отправлять нечего — `flush()` у неоткрытого захода отдаёт `null`, —
  // поэтому отдельного «пропустить первый раз» здесь не нужно.
  //
  // Окно при этом НЕ закрывается: оно живёт в шапке, шапка переживает
  // клиентский переход, и закрывать его тут значило бы менять поведение
  // продукта заодно с журналом. Вместо этого начинается новый заход —
  // человек остался в поиске, но уже на другой странице, и всё, что он
  // наберёт дальше, снова будет записано.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    send();
    if (openRef.current) demand.open(lang);
  }, [pathname, send, demand, lang]);

  const close = useCallback(() => {
    send();
    setOpen(false);
    setQuery("");
    setResponse(null);
    setEnterPending(false);
    setFlushNow(false);
  }, [send]);

  const follow = useCallback(() => {
    // Порядок обязателен: признак ставится ДО отправки, потому что
    // переход и есть выход — второго повода записать не будет.
    demand.markFollowed();
    close();
  }, [demand, close]);

  /**
   * Адрес ПЕРВОЙ напечатанной строки выдачи — той самой, на которую
   * человек нажал бы мышью. Разделы уже отсортированы (`SECTION_ORDER` в
   * match.ts), поэтому первая строка первого непустого раздела и есть
   * первый результат; свёрнутый раздел занимает ровно одну строку и ведёт
   * на свою подборку.
   *
   * `null` означает «идти некуда» — и это законный ответ, а не ошибка:
   * пустая выдача не должна никуда уводить.
   */
  const firstHrefOf = useCallback(
    (data: SearchResponse): string | null => {
      for (const section of data.sections) {
        if (section.collapsed) return section.collapsedHref ?? `/${lang}/word-games`;
        if (section.hits.length > 0) return section.hits[0].href;
      }
      return null;
    },
    [lang],
  );

  // Отвечает ли выдача на ТУ строку, что сейчас в поле. Без этой сверки
  // Enter, нажатый сразу после правки строки, уводил бы по прежней выдаче
  // — то есть не туда, что видно на экране.
  const answersCurrent = response !== null && response.query === trimmed;

  const goToFirst = useCallback(
    (data: SearchResponse) => {
      const href = firstHrefOf(data);
      if (!href) return;
      // Тот же путь, что у нажатия мышью: сначала отметить переход и
      // закрыть окно, потом уйти. Порядок важен по той же причине, что и в
      // `follow` — переход и есть выход.
      follow();
      router.push(href);
    },
    [firstHrefOf, follow, router],
  );

  /**
   * Enter в поле поиска.
   *
   * Чего он НЕ делает, и это половина правки. Поле не завёрнуто в `<form>`
   * (проверено на живом проде: `input.closest("form")` — `null` во всех 64
   * замеренных конфигурациях), поэтому неявной отправки формы здесь нет и
   * страница не перезагружается. `preventDefault` стоит не от сегодняшнего
   * поведения, а от завтрашнего: обёртка полем в форму — обычная правка
   * вёрстки, и она молча вернула бы перезагрузку.
   *
   * Пустая строка не уводит никуда намеренно: на пустой строке выдачи нет,
   * есть список разделов — то есть меню. Enter, уносящий на главную сразу
   * после открытия окна, был бы неожиданностью, а не удобством.
   *
   * Пустая выдача тоже не уводит никуда: окно остаётся открытым, строка —
   * на месте, «ничего не найдено» — на экране.
   */
  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!trimmed) return;
    if (answersCurrent && response) {
      goToFirst(response);
      return;
    }
    // Выдача ещё не пришла. Не ждать её сложа руки: запрос отправляется
    // немедленно, а переход состоится, как только она придёт.
    setEnterPending(true);
    setFlushNow(true);
  }

  // Отложенный Enter: выдача пришла — уходим. Одноразово, поэтому признак
  // снимается здесь же.
  useEffect(() => {
    if (!enterPending || !answersCurrent || !response) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnterPending(false);
    goToFirst(response);
  }, [enterPending, answersCurrent, response, goToFirst]);

  const t = dict.search;
  const sectionLabel = (section: SearchSection) => t.sections[section];
  const showDestinations = trimmed.length === 0;
  const nothingFound = !showDestinations && !loading && response !== null && response.total === 0;

  return (
    <>
      {/* 44x44 с 06.09.2026 (7.132, долг 55 закрыт). До этого дня было
          36x36, и это не забывалось: 7.131 подняла кнопку 36 -> 44 и уронила
          `CI / Playwright E2E` на e2e/navbar-signed-in.spec.ts (`/ru/profile`,
          PR #203) — потому что ряд шапки в полосе 640–767 УЖЕ жил за своей
          контентной коробкой, и +8 px забирали 8 из 8.52 px запаса до
          вьюпорта.

          Что изменилось: не кнопка, а бюджет ряда. Navbar.tsx отдал полосе
          до `md` 40 px гэпов (16 у ряда + 24 у списка ссылок), и правый край
          кластера при вьюпорте 640 у вошедшего на `/ru` встал ровно на
          границу коробки. Замер на базе в форме CI, оба движка:

            main, кнопка 36 — кластер 631.48 при коробке 616: за коробкой 15.48
            main, кнопка 44 — 639.48: за коробкой 23.48 (7.131)
            эта ветка, 44   — 616.00: за коробкой 0, запас до вьюпорта 24.00

          Запас снят подсадкой чужой растеризации, тем же способом, что в
          7.131: ряд остаётся в коробке до +16 px лишней ширины подписи и
          выходит из неё на +17; вьюпорт он переступает только на +41.
          Вилка CI из 7.131 — +3…+10 px. Стережёт это теперь
          e2e/navbar-row-fits-its-box.spec.ts, и стережёт РАМУ, а не число
          запаса. */}
      <button
        type="button"
        onClick={openWindow}
        aria-label={dict.nav.search}
        title={dict.nav.searchShortcutHint}
        // 44×44, а не 36×36 (долг 55). Вернуть это можно было только после
        // того, как ряд шапки перестал выезжать за свою контентную коробку —
        // см. комментарий о бюджете ширины в Navbar.tsx и PROGRESS.md 7.132.
        className="tap flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-black/[.04] hover:text-foreground active:bg-black/[.04] active:text-foreground dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
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
          onKeyDown={onSearchKeyDown}
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
