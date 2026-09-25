"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uiStrings } from "@/lib/ui-strings";
import { formatWeight } from "@/lib/downloads";
import {
  askPersistence,
  clipUrlsOnPage,
  downloadPage,
  isComplete,
  measureClips,
  readDownloads,
  type ClipWeights,
  type DownloadOutcome,
} from "@/lib/downloads-client";

/**
 * КНОПКА «DESCARGAR» — ЗАХОД 7.231 (ОФЛАЙН-3).
 *
 * Разбор «чем скачанное отличается от просто просмотренного» — в
 * `src/lib/downloads.ts`; исполнение — в `downloads-client.ts`. Здесь
 * только то, что видит человек, и три решения об этом виде.
 *
 * 1. ДВА НАЖАТИЯ, А НЕ ОДНО, И ЭТО НЕ ЛИШНИЙ ШАГ. Вес обязан быть виден
 *    ДО скачивания и обязан быть настоящим — то есть посчитанным из
 *    ответов источника (у урока `a1-1` таких ответов 65). Спрашивать эти
 *    65 ответов у КАЖДОГО, кто просто открыл урок, значило бы платить
 *    трафиком всех за кнопку, которую нажимают единицы. Поэтому первое
 *    нажатие считает вес и показывает его («Descargar 1,7 MB»), второе —
 *    качает. Само скачивание при этом ОДНО нажатие: подтверждение и есть
 *    то нажатие, о котором просил владелец.
 *
 * 2. ПОЛОСА «12 / 65» — ПРАВДА, А НЕ ОЦЕНКА. Число растёт по факту
 *    положенного в кеш, а не по таймеру.
 *
 * 3. ЧАСТИЧНОЕ НЕ ВЫДАЁТСЯ ЗА ГОТОВОЕ. Все исходы, кроме `downloaded` и
 *    `already`, говорят словами, что именно случилось, и «Descargado ✓»
 *    при них не появляется. Откат делает `downloadPage`.
 */
type Phase =
  | { kind: "idle" }
  | { kind: "measuring" }
  | { kind: "ready"; weight: ClipWeights; bytes: number }
  | { kind: "running"; done: number; total: number }
  | { kind: "done" }
  | { kind: "error"; text: string };

export default function DownloadButton({ lang }: { lang: "es" | "ru" }) {
  const t = uiStrings(lang).download;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  /**
   * ЕСТЬ ЛИ НА ЭТОМ УСТРОЙСТВЕ ХРАНИЛИЩЕ КЕШЕЙ. Начинается `true` и у
   * сервера, и у клиента, чтобы разметка первого рендера совпала знак в
   * знак; правится сразу после монтирования. Проверять прямо в теле
   * рендера (`typeof caches === "undefined"` → `return null`) нельзя:
   * сервер нарисовал бы кнопку, а браузер без Cache Storage (приватное
   * окно, запрет на сайт) убрал бы её В ХОДЕ гидрации — это расхождение,
   * а не бережность. Тот же приём и по той же причине, что у `noClip` в
   * `SpeakButton.tsx`.
   */
  const [supported, setSupported] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof caches !== "undefined");
  }, []);

  // УЖЕ СКАЧАНО — УЗНАЁТСЯ ИЗ КЕША, А НЕ ИЗ ПАМЯТИ СТРАНИЦЫ. Человек мог
  // скачать этот урок вчера и другим заходом; кнопка обязана знать это
  // при первом же показе, иначе «повторное нажатие не качает заново»
  // держалось бы только внутри одной вкладки.
  useEffect(() => {
    if (typeof caches === "undefined") return;
    let cancelled = false;
    void (async () => {
      const rows = await readDownloads(caches, window.location.href);
      const mine = rows.find((row) => row.url === window.location.href);
      if (!mine || cancelled) return;
      if (await isComplete(caches, mine)) {
        if (!cancelled && mounted.current) setPhase({ kind: "done" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const errorText = useCallback(
    (outcome: DownloadOutcome): string => {
      if (outcome === "network-failed") return t.errorNetwork;
      if (outcome === "no-space") return t.errorSpace;
      if (outcome === "too-big") return t.errorTooBig;
      if (outcome === "closed") return t.errorClosed;
      return t.errorUnknown;
    },
    [t],
  );

  const measure = useCallback(async () => {
    if (typeof caches === "undefined") return;
    if (!navigator.onLine) {
      setPhase({ kind: "error", text: t.errorOffline });
      return;
    }
    setPhase({ kind: "measuring" });
    const clipUrls = clipUrlsOnPage(document);
    const weight = await measureClips(clipUrls, (url, init) => fetch(url, init));
    const pageBytes = new TextEncoder().encode(`<!doctype html>\n${document.documentElement.outerHTML}`).length;
    const bytes = pageBytes + weight.clips.reduce((sum, clip) => sum + clip.bytes, 0);
    if (!mounted.current) return;
    setPhase({ kind: "ready", weight, bytes });
  }, [t]);

  const run = useCallback(
    async (weight: ClipWeights) => {
      setPhase({ kind: "running", done: 0, total: weight.clips.length + 1 });
      // Просьба «не выбрасывай наше хранилище» уходит ровно здесь: при
      // первом настоящем скачивании, а не заранее.
      await askPersistence();
      const outcome = await downloadPage({
        caches,
        fetch: (url, init) => fetch(url, init),
        url: window.location.href,
        pathname: window.location.pathname,
        html: `<!doctype html>\n${document.documentElement.outerHTML}`,
        title: document.title,
        lang,
        clipUrls: weight.clips.map((clip) => clip.url),
        weights: weight,
        now: Date.now(),
        onProgress: (done, total) => {
          if (mounted.current) setPhase({ kind: "running", done, total });
        },
      });
      if (!mounted.current) return;
      if (outcome === "downloaded" || outcome === "already") setPhase({ kind: "done" });
      else setPhase({ kind: "error", text: errorText(outcome) });
    },
    [errorText, lang],
  );

  if (!supported) return null;

  const label = (() => {
    if (phase.kind === "measuring") return t.measuring;
    if (phase.kind === "done") return t.done;
    if (phase.kind === "running") return t.progress.replace("{done}", String(phase.done)).replace("{total}", String(phase.total));
    if (phase.kind === "ready") return t.confirm.replace("{weight}", formatWeight(phase.bytes, lang));
    return t.button;
  })();

  const busy = phase.kind === "measuring" || phase.kind === "running";

  return (
    <div className="flex flex-col gap-1" data-rf-download>
      <button
        type="button"
        data-rf-download-button
        // 44px минимум — правило проекта для всего нажимаемого.
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-[var(--color-fg)] disabled:opacity-60 dark:border-white/30"
        disabled={busy || phase.kind === "done"}
        aria-busy={busy}
        onClick={() => {
          if (phase.kind === "ready") void run(phase.weight);
          else if (phase.kind === "idle" || phase.kind === "error") void measure();
        }}
      >
        <span aria-hidden="true">{phase.kind === "done" ? "✓" : "↓"}</span>
        <span data-rf-download-label>{label}</span>
      </button>
      {phase.kind === "ready" ? (
        <p className="text-xs opacity-70" data-rf-download-note>
          {t.weightNote.replace("{clips}", String(phase.weight.clips.length))}
          {phase.weight.unknown > 0 ? ` · ${t.unknownWeight.replace("{clips}", String(phase.weight.unknown))}` : ""}
        </p>
      ) : null}
      {phase.kind === "error" ? (
        <p className="text-xs text-[var(--color-danger,#b91c1c)]" data-rf-download-error role="status">
          {phase.text}
        </p>
      ) : null}
    </div>
  );
}
