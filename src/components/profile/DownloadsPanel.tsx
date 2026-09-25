"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { uiStrings } from "@/lib/ui-strings";
import {
  DOWNLOADS_MAX_BYTES,
  formatWeight,
  langMark,
  langOfPath,
  totalBytes,
  withoutDuplicates,
  type DownloadedRow,
} from "@/lib/downloads";
import { isComplete, readDownloads, removeAllDownloads, removeDownload } from "@/lib/downloads-client";

/**
 * ЭКРАН «DESCARGADO» В КАБИНЕТЕ — ЗАХОД 7.231 (ОФЛАЙН-3).
 *
 * Как и панель записей голоса рядом, это обязан быть клиентский
 * компонент, и по той же причине: данных, которые он показывает, НЕ
 * СУЩЕСТВУЕТ НИ НА ОДНОМ СЕРВЕРЕ. Скачанное лежит в `Cache Storage`
 * ровно того браузера, в котором нажали кнопку, — тот, кто скачал урок на
 * телефоне, на ноутбуке увидит здесь ноль, и это правда, которую стоит
 * сказать вслух.
 *
 * ЦЕЛОСТНОСТЬ СПРАШИВАЕТСЯ, А НЕ ПОДРАЗУМЕВАЕТСЯ. У каждой строки
 * проверяется, лежат ли ВСЕ её записи (`isComplete`): страница и каждый
 * клип. Строка, под которой что-то пропало, помечается «Incompleto» — то
 * же правило, что починило строку 310 в этом же заходе: список не имеет
 * права обещать больше, чем лежит.
 */
export default function DownloadsPanel({ lang }: { lang: "es" | "ru" }) {
  const t = uiStrings(lang).download;
  const [rows, setRows] = useState<DownloadedRow[] | null>(null);
  const [whole, setWhole] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (typeof caches === "undefined") {
      setRows([]);
      return;
    }
    // ДУБЛЕЙ ОДНОГО АДРЕСА НЕ БЫВАЕТ (строка 316) — и это утверждение, а
    // не надежда на то, что запись всегда клала строку по одной.
    const found = withoutDuplicates(await readDownloads(caches, window.location.href));
    const complete: Record<string, boolean> = {};
    for (const row of found) complete[row.url] = await isComplete(caches, row);
    setRows(found);
    setWhole(complete);
  }, []);

  // Отдельной задачей, а не прямо в эффекте: у `load` есть ветка, которая
  // ставит состояние синхронно (браузер без Cache Storage — приватное окно,
  // запрет на сайт), и синхронный `setState` внутри эффекта запускает
  // каскад повторных отрисовок. Правило проекта это ловит, и ловит верно.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (rows === null) return null;

  const total = totalBytes(rows);

  return (
    <div className="rounded-2xl border border-black/10 p-5 dark:border-white/15" data-rf-downloads-panel>
      <h2 className="font-serif text-lg font-semibold">{t.screenTitle}</h2>
      <p className="mt-1 text-sm text-foreground/60" data-rf-downloads-total>
        {t.screenTotal.replace("{weight}", formatWeight(total, lang))} / {formatWeight(DOWNLOADS_MAX_BYTES, lang)}
      </p>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/60" data-rf-downloads-empty>
          {t.screenEmpty}
        </p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-2" data-rf-downloads-list>
            {rows.map((row) => (
              <li
                key={row.url}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2 dark:border-white/10"
              >
                <span className="flex min-w-0 flex-col">
                  <Link href={row.path} className="truncate font-medium">
                    {/*
                      АДРЕС НА ЭКРАН НЕ ВЫВОДИТСЯ НИКОГДА — строка 312.
                      Владелец 25.09.2026 получил в списке `/es/stories`
                      вместо «Cuentos en ruso con audio y traducción»:
                      адрес ничего не говорит тому, кто не читает
                      по-английски. Название у строки без него берётся из
                      самой копии (`readDownloads` → `withTitles`), а
                      если копии не осталось — честное общее слово.
                    */}
                    {row.title || t.screenUntitled}
                  </Link>
                  <span className="text-xs text-foreground/60">
                    {/*
                      ПОМЕТКА ЯЗЫКА — строка 316. Владелец 26.09.2026
                      получил в списке две строки «Снегурочка · Cuento ·
                      Descargado · 1,4 MB»: испанскую и русскую версии
                      одной страницы, различить которые нечем — название
                      рассказа у них одно на двоих. Два знака, ES и RU,
                      не переводятся намеренно: они читаются одинаково в
                      обеих локалях и не спорят с языком оболочки. Язык
                      берётся из АДРЕСА, а не из описи: адрес есть у
                      строки всегда, даже у восстановленной из кеша.
                    */}
                    {langMark(langOfPath(row.path) || row.lang)} · {formatWeight(row.bytes, lang)}
                    {whole[row.url] === false ? ` · ${t.screenIncomplete}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  data-rf-downloads-remove={row.path}
                  className="tap min-h-11 rounded-full border border-black/10 px-3 py-1 text-sm dark:border-white/15"
                  onClick={async () => {
                    await removeDownload(caches, row.url);
                    await load();
                  }}
                >
                  {t.remove}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            data-rf-downloads-remove-all
            className="tap mt-4 min-h-11 rounded-full border border-red-500/30 px-4 py-2 text-sm text-red-600 dark:text-red-400"
            onClick={async () => {
              // Подтверждение обязательно: кнопка уносит мегабайты, которые
              // человек скачивал по одному, и вернуть их можно только
              // сетью, которой рядом может не быть.
              if (!window.confirm(t.removeAllConfirm)) return;
              await removeAllDownloads(caches);
              await load();
            }}
          >
            {t.removeAll}
          </button>
        </>
      )}
    </div>
  );
}
