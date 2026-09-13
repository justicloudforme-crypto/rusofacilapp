"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Проигрывает ОПЛАЧЕННУЮ запись `text` — файл из общего кэша `AudioAsset`
 * (`audioUrl`), обычным элементом <audio>.
 *
 * Запасного пути на браузерный синтез здесь БОЛЬШЕ НЕТ (заход 7.168).
 * Правило владельца: звучит только оплаченная записанная озвучка, голоса,
 * сгенерированного на лету, не должно быть нигде. Раньше кнопка без
 * `audioUrl` звала системный голос ОС (на macOS/iOS — Milena), и именно
 * его годами принимали за брак нашей озвучки (7.160, долг 114).
 *
 * Кнопка без записи НЕ прячется и НЕ исчезает из разметки: серверный HTML
 * обязан остаться прежним до знака — 330 замороженных URL до 26.09.2026
 * измеряются именно по нему, и `song-katyusha` — одна из них. Поэтому
 * рендер на сервере тот же, что и был, а «записи нет» проявляется только
 * после гидрации: кнопка приглушается и помечается `aria-disabled`,
 * нажатие ничего не проигрывает и ничем не подменяет звук.
 */
export default function SpeakButton({
  label,
  size = "sm",
  audioUrl,
  onPlay,
  onStop,
}: {
  /** Текст, который читает клип. Кнопке он больше не нужен — синтеза нет,
   *  — но остаётся в контракте: его передают все 18 поверхностей, и он же
   *  служит ключом поиска клипа на стороне сервера. */
  text: string;
  label: string;
  /** "lg" is a full pill with the label text visible (not just the aria
   * label) — reserved for a card's one "primary" pronunciation button
   * (e.g. the main word on a flashcard), since a 44px+ tap target with a
   * legible caption doesn't scale down to every inline glyph-sized use. */
  size?: "sm" | "md" | "lg";
  /** Оплаченная запись для `text` из общего кэша `AudioAsset`. Без неё
   *  кнопка остаётся на месте, но молчит: подменять запись нечем. */
  audioUrl?: string;
  /** ДОЛГ 158. Кнопка обязана уметь сказать наружу, что она зазвучала и
   *  что замолчала, — иначе поверхность, у которой звучит что-то ещё
   *  (рассказ), не может замолчать на время слова и вернуться после.
   *  Оба необязательны: семнадцать из восемнадцати поверхностей со
   *  звуком их не передают, и для них поведение не меняется ни на знак. */
  onPlay?: () => void;
  onStop?: () => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  // Начинается `false` и на сервере, и на клиенте, чтобы разметка первого
  // рендера совпала знак в знак (иначе поехал бы серверный HTML замороженных
  // страниц); правится сразу после монтирования — тот же приём, что был у
  // снятого `supported`.
  const [noClip, setNoClip] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Через ref, а не напрямую: слушатели вешаются один раз на созданный
  // элемент, а `onPlay`/`onStop` приходят новыми функциями на каждом
  // рендере родителя. Захвати их замыкание — и после первого же рендера
  // звонок уходил бы в устаревшую пару.
  const onPlayRef = useRef(onPlay);
  const onStopRef = useRef(onStop);
  // Без массива зависимостей нарочно: эффект обязан отработать на каждом
  // рендере, а пишет он только в ref — ни браузера, ни состояния не
  // трогает, поэтому ничего не перестраивает. Тот же приём, что у
  // `mediaActionsRef` в StoryText.tsx, и по той же причине.
  useEffect(() => {
    onPlayRef.current = onPlay;
    onStopRef.current = onStop;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNoClip(!audioUrl);
  }, [audioUrl]);

  // A real, confirmed bug: this component instance is reused across
  // different cards (e.g. flipping through a flashcard deck) without
  // unmounting, so `audioUrl` changes on every card — but the cached
  // `audioRef.current` from speak()'s `if (!audioRef.current)` check
  // below was never invalidated, so every card after the first kept
  // replaying whichever file was cached from the very first press.
  // Resetting the ref whenever `audioUrl` changes forces speak() to build
  // a fresh Audio element for the new file. Also stops/rewinds a clip
  // still playing from the previous card so it doesn't keep going after
  // the user has already moved on.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    audioRef.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpeaking(false);
  }, [audioUrl]);

  // Previously this always restarted from the top on every tap — there was
  // no way to actually pause a clip already playing, only to make it play
  // again from 0. Now a tap toggles: start it, pause it mid-way, or resume
  // exactly where it left off — a still-paused (not ended) clip resumes
  // instead of restarting.
  function speak() {
    // Записи нет — звук ничем не подменяется. Ни синтеза, ни системного
    // голоса: тишина честнее чужого произношения (7.160, 7.168).
    if (!audioUrl) return;
    {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        // Слушатели вешаются на СОБЫТИЯ элемента, а не на ветки
        // `speak()`, нарочно: клип может кончиться сам, может быть
        // остановлен второй нажатой кнопкой, а может и не зазвучать
        // вовсе (`onerror`) — наружу обязаны уехать все три исхода, иначе
        // рассказ, замолчавший ради слова, не вернётся (долг 158).
        audioRef.current.onplay = () => {
          setSpeaking(true);
          onPlayRef.current?.();
        };
        audioRef.current.onpause = () => {
          setSpeaking(false);
          onStopRef.current?.();
        };
        audioRef.current.onended = () => {
          setSpeaking(false);
          onStopRef.current?.();
        };
        audioRef.current.onerror = () => {
          setSpeaking(false);
          onStopRef.current?.();
        };
      }
      const audio = audioRef.current;
      if (!audio.paused) {
        audio.pause();
        return;
      }
      // A clip that already reached the end (currentTime === duration)
      // should restart, not "resume" from a position with nothing left to
      // play — every other paused-mid-way case resumes in place.
      if (audio.ended || audio.currentTime >= (audio.duration || Infinity)) {
        audio.currentTime = 0;
      }
      // .play() rejects on a broken/missing audioUrl or an AbortError from
      // a rapid double-tap (pause() racing this call) — `void` alone
      // doesn't catch a promise rejection, same bug class as
      // SerwistRegister.tsx. Matches the .catch(() => setPlaying(false))
      // pattern StoryText.tsx already uses for the same API.
      audio.play().catch(() => setSpeaking(false));
    }
  }

  if (size === "lg") {
    return (
      <button
        type="button"
        onClick={speak}
        aria-label={label}
        aria-disabled={noClip || undefined}
        className={`inline-flex min-h-11 flex-shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-50 ${
          speaking ? "bg-primary-400 text-white" : "bg-primary text-white hover:bg-primary-400"
        }${noClip ? " cursor-default opacity-40" : ""}`}
      >
        <span aria-hidden="true" className="text-base">
          🔊
        </span>
        {label}
      </button>
    );
  }

  const dimensions = size === "md" ? "h-8 w-8 text-base" : "h-6 w-6 text-xs";

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={label}
      title={label}
      aria-disabled={noClip || undefined}
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full border border-black/10 text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50 dark:border-white/15 ${dimensions} ${
        speaking ? "bg-foreground/10 text-foreground" : ""
      }${noClip ? " cursor-default opacity-40" : ""}`}
    >
      🔊
    </button>
  );
}
