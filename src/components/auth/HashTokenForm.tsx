"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Форма, чей одноразовый токен приезжает во ФРАГМЕНТЕ адреса, а не в
 * строке запроса. Долг 164 (заход 7.187).
 *
 * ЧТО БЫЛО. Ссылка из письма выглядела как
 * `…/reset-password?token=<действующий токен>`. Браузерный SDK Sentry
 * включён на проде и прикладывает ПОЛНЫЙ адрес страницы к каждому
 * событию — то есть любая ошибка на этой странице увозила действующий
 * токен сброса пароля в чужое хранилище. Тем же способом уезжал токен
 * подтверждения УДАЛЕНИЯ учётной записи.
 *
 * ПОЧЕМУ ИМЕННО ФРАГМЕНТ. Токен обязан как-то доехать из письма в
 * браузер, и фрагмент — единственный кусок адреса, который браузер НЕ
 * ОТПРАВЛЯЕТ НА СЕРВЕР вовсе: его нет ни в журнале сервера, ни в
 * `Referer`, ни в серверных событиях Sentry. Цена — страница обязана
 * стать клиентской: серверный компонент фрагмента не видит по
 * построению. Поэтому форма живёт здесь, а страница остаётся тонкой.
 *
 * ДВЕ ПОЛОВИНЫ, И ВТОРАЯ НЕ МЕНЕЕ ВАЖНА:
 *
 *  1. Токен вынут из фрагмента и положен в СКРЫТОЕ ПОЛЕ — дальше он
 *     уходит телом POST-запроса, которого в адресах нет вовсе.
 *  2. Фрагмент СТИРАЕТСЯ из адреса тут же, `history.replaceState`. Это
 *     не украшение: `location.href`, который Sentry прикладывает к
 *     событию, включает и фрагмент тоже, так что «просто перенести в
 *     `#`» болезнь бы не вылечило, а переодело. Вторая стена —
 *     `scrubTokenFromUrl` в sentry.client.config.ts, на случай ошибки в
 *     те миллисекунды, пока эффект ещё не отработал.
 *
 * `token === undefined` — «ещё не читали»: на сервере и в первом кадре
 * клиента одинаково, поэтому разметка первого рендера совпадает знак в
 * знак и гидрация не спорит.
 */
export default function HashTokenForm({
  action,
  lang,
  missingLabel,
  className,
  children,
}: {
  action: string;
  lang: string;
  /** Что показать, если токена в адресе нет: ссылка устарела или открыта руками. */
  missingLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const found = new URLSearchParams(raw).get("token") ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(found || null);
    if (found) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  if (token === undefined) return null;
  if (token === null) return <p className="mt-6 text-sm text-foreground/60">{missingLabel}</p>;

  return (
    <form action={action} method="POST" className={className}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="token" value={token} />
      {children}
    </form>
  );
}
