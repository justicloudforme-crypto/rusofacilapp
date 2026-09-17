"use client";

import { useEffect, useState } from "react";
import StreakFlame from "@/components/StreakFlame";
import type { Locale } from "@/i18n/config";
import { plural, type PluralForms } from "@/lib/plural";
import {
  WELCOME_SHOWN_COOKIE,
  WELCOME_SHOWN_ENDPOINT,
  WELCOME_SHOWN_MAX_AGE_SECONDS,
  welcomeShownValue,
} from "@/lib/welcome-shown";

// Показывается один раз в СУТКИ УЧЕНИКА, когда он попадает в кабинет
// (туда ведёт и переход после входа, и кнопка в шапке у вошедшего).
// Пользуется теми же числами серии, которые кабинет и так запрашивает
// для своих плиток, — лишних запросов не добавляет.
//
// ДВА ПРАВИЛА, КОТОРЫЕ ЗДЕСЬ НЕЛЬЗЯ НАРУШАТЬ (долг 223, заход 7.204):
//
//   1. «Сегодня» приходит ГОТОВЫМ (`todayKey`), посчитанным на сервере в
//      зоне аккаунта тем же `dateKeyIn`, которым считается день занятия.
//      Своего мнения о дате у этого файла нет вовсе: `new Date()` здесь
//      означал бы Гринвич и второе определение суток.
//   2. Отметка «уже показано» лежит в КУКЕ, а не в localStorage: выход
//      из аккаунта чистит localStorage (7.199), и приветствие
//      показывалось второй раз за тот же день.
//
//   3. ГЛАВНЫЙ ЗАМОК — НА АККАУНТЕ, А НЕ НА УСТРОЙСТВЕ (долг 234, заход
//      7.206). `greetedOnAccount` приходит с сервера: это ответ на
//      вопрос «стоит ли у этого аккаунта отметка за сегодняшний местный
//      день». Стоит — не показываем и куку не трогаем; смена аккаунтов
//      A→B→A в один день даёт ровно одно приветствие каждому, а
//      переустановка и второй телефон не дают второго вовсе. Кука
//      осталась ВТОРЫМ рубежом: она снимает лишнюю запись и закрывает
//      щель, пока запись летит.
//
// Все три правила сторожит `npm run check:welcome-once`.
export default function WelcomeOverlay({
  userId,
  todayKey,
  greetedOnAccount,
  name,
  currentStreak,
  greeting,
  subtextActive,
  subtextNew,
  locale,
  streakDaysUnit,
  continueLabel,
}: {
  userId: string;
  /** «Какой сегодня день» в зоне аккаунта — `dateKeyIn(new Date(),
   *  timeZone)`, посчитанный на сервере (src/lib/welcome-shown.ts). */
  todayKey: string;
  /** Стоит ли у АККАУНТА отметка за этот же местный день
   *  (`User.welcomeShownDateKey`, долг 234). Считает сервер. */
  greetedOnAccount: boolean;
  name: string | null;
  currentStreak: number;
  greeting: string;
  subtextActive: string;
  subtextNew: string;
  locale: Locale;
  streakDaysUnit: PluralForms;
  continueLabel: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Первый рубеж, и он сильнее куки: отметка на аккаунте уже стоит за
    // сегодня — значит этому человеку сегодня здоровались, чем бы он ни
    // открыл кабинет.
    if (greetedOnAccount) return;
    const mark = welcomeShownValue(userId, todayKey);
    try {
      const already = document.cookie
        .split("; ")
        .some((pair) => pair === `${WELCOME_SHOWN_COOKIE}=${encodeURIComponent(mark)}`);
      if (already) return;
      document.cookie = `${WELCOME_SHOWN_COOKIE}=${encodeURIComponent(mark)}; path=/; max-age=${WELCOME_SHOWN_MAX_AGE_SECONDS}; SameSite=Lax`;
      // Отметка на аккаунте. День считает сервер сам — тело здесь пустое
      // намеренно (см. маршрут). Неудача запроса ничего не ломает:
      // остаётся ровно то поведение, что было до долга 234.
      void fetch(WELCOME_SHOWN_ENDPOINT, { method: "POST", keepalive: true }).catch(() => {});
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    } catch {
      // Куки запрещены — лучше промолчать, чем здороваться на каждом
      // открытии кабинета.
    }
  }, [userId, todayKey, greetedOnAccount]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={greeting}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-6 backdrop-blur-sm dark:bg-black/55"
      onClick={() => setVisible(false)}
    >
      <div
        className="celebration-panel flex max-w-xs flex-col items-center gap-3 rounded-3xl border border-primary/15 bg-background px-8 py-8 text-center shadow-[0_1px_2px_rgba(36,28,21,0.06),0_16px_40px_-12px_rgba(36,28,21,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        {currentStreak > 0 && (
          <StreakFlame days={currentStreak} size={52} label={`${currentStreak} ${plural(locale, currentStreak, streakDaysUnit)}`} />
        )}
        <h2 className="font-serif text-xl font-bold text-balance">
          {name?.trim() ? `${greeting.replace(/!$/, "")}, ${name.trim()}!` : greeting}
        </h2>
        <p className="text-sm text-foreground/70">
          {currentStreak > 0 ? subtextActive : subtextNew}
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="tap mt-2 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-400 active:bg-primary-400"
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
