"use client";

import { useState } from "react";

/**
 * «ВЫЙТИ НА ВСЕХ ОСТАЛЬНЫХ УСТРОЙСТВАХ» — ФОНОВЫМ ЗАПРОСОМ, А НЕ
 * НАВИГАЦИЕЙ (заход 7.218).
 *
 * ЧТО БЫЛО И ЧЕМ ЭТО МЕРЯЛОСЬ. Кнопка была обычной формой
 * `method="POST"` на служебный адрес `/api/auth/logout-everywhere`, то
 * есть НАВИГАЦИЕЙ: браузер уходил на адрес, которого человеку видеть не
 * положено, и показывал что придётся. Замер владельца 20.09.2026 на
 * проде: вместо страницы — серый экран Chrome «Соединение прервано,
 * ERR_NETWORK_CHANGED», а после перезагрузки его выкинуло на форму
 * входа — при подписи, которая обещает завершить сеансы «кроме этого».
 *
 * И это не две беды, а одна. Новый признак сеанса ЭТОГО устройства
 * приезжает заголовком `Set-Cookie` ответа на тот самый POST: если
 * ответа нет — а при навигации его может не быть по любой причине, от
 * смены сети до закрытой вкладки, — то в базе версия сеанса уже
 * увеличена, а куки на устройстве осталась старая. Ровно это и означает
 * «выкинуло из аккаунта».
 *
 * Фоновый `fetch` эту связку разрывает: страница никуда не уходит,
 * человек видит подтверждение на месте, а неудача запроса становится
 * СООБЩЕНИЕМ, а не пустым экраном. Ответ приходит на ту же вкладку, и
 * `Set-Cookie` из него браузер применяет так же, как применил бы при
 * навигации.
 *
 * Форма при выключенном JS остаётся рабочей: `onSubmit` отменяет
 * отправку только тогда, когда его есть кому вызвать.
 */
export default function LogoutEverywhereButton({
  lang,
  label,
  pendingLabel,
  doneLabel,
  errorLabel,
}: {
  lang: string;
  label: string;
  pendingLabel: string;
  doneLabel: string;
  errorLabel: string;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const body = new FormData();
      body.set("lang", lang);
      const res = await fetch("/api/auth/logout-everywhere", {
        method: "POST",
        // Ответ нужен ЗДЕСЬ, а не на новой странице: в нём приезжает
        // свежий признак сеанса этого устройства.
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        body,
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form action="/api/auth/logout-everywhere" method="POST" onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="lang" value={lang} />
      <button
        type="submit"
        disabled={status === "sending"}
        className="tap rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
      >
        {status === "sending" ? pendingLabel : label}
      </button>
      {status === "done" && (
        <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
          {doneLabel}
        </p>
      )}
      {status === "error" && (
        <p role="status" className="text-sm text-red-600 dark:text-red-400">
          {errorLabel}
        </p>
      )}
    </form>
  );
}
