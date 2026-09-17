"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Button from "@/components/ui/Button";

/**
 * КНОПКА ФОРМЫ ВХОДА, КОТОРАЯ ПОКАЗЫВАЕТ, ЧТО ЗАПРОС ПОШЁЛ — ДОЛГ 241.
 *
 * Снято владельцем 17.09.2026 на POCO, внутри оболочки: после нажатия
 * «Iniciar sesión» экран около трёх секунд не меняется ничем — кнопка
 * активна, подписи нет, полосы нет. Человек в этот миг знает ровно
 * столько же, сколько знал бы, если бы нажатие не сработало вовсе, и
 * естественное действие тут — нажать второй раз.
 *
 * ПОЧЕМУ НЕ `useFormStatus`. Он рассказывает про ДЕЙСТВИЕ-ФУНКЦИЮ
 * (Server Action). Три формы входа — обычные HTML-формы с
 * `action="/api/auth/…"` и `method="POST"`, их отправляет браузер, и
 * никакого «ожидания» React про них не знает. Поэтому признак берётся
 * оттуда, где он есть на самом деле, — из события `submit` самой формы.
 *
 * ПОЧЕМУ ЛИСТЕНЕР, А НЕ `onClick`. Форму отправляет и Enter в поле
 * пароля, и это ровно тот путь, которым входит человек с клавиатурой.
 * `onClick` его не видит.
 *
 * ДВОЙНОЕ НАЖАТИЕ ГАСИТСЯ ДВАЖДЫ, И ОБА РУБЕЖА НУЖНЫ:
 *
 *   1. `event.preventDefault()` на втором `submit` — это единственное,
 *      что действительно ОТМЕНЯЕТ вторую отправку. Он же ловит Enter,
 *      нажатый, пока кнопка уже неактивна.
 *   2. `disabled` у кнопки — это то, что человек ВИДИТ. Ставится после
 *      того, как отправка началась: браузер уже собрал поля, и отмены
 *      от этого не происходит.
 *
 * ПОЧЕМУ `flushSync`, И ЧТО ПРО НЕГО ЧЕСТНО ИЗМЕРЕНО. Обычная отправка
 * формы — это НАВИГАЦИЯ, а React доводит отложенный рендер до DOM
 * задачами планировщика, которые уходящей странице браузер может и не
 * отдать. `flushSync` доводит обновление до DOM ПРЯМО в обработчике, до
 * того как навигация началась, и этой гонки не остаётся вовсе.
 *
 * Сказать, что без него признак НЕ появляется, было бы неправдой:
 * проверка в браузере (e2e/login-loading-state.spec.ts) проходит и на
 * обычном `setPending(true)` — на настольном Chromium, на местном
 * сервере, где между нажатием и ответом миллисекунды. Это значит ровно
 * то, что значит: на быстром стенде гонка не проявляется. `flushSync`
 * оставлен затем, что стенд — не телефон владельца на мобильной сети, а
 * цена его здесь ровно ноль: один синхронный рендер одной кнопки.
 *
 * ВОЗВРАТ «НАЗАД». Страницу входа браузер может достать из кеша ровно в
 * том виде, в каком её покинули, — с неактивной кнопкой и подписью
 * «Entrando…». `pageshow` с `persisted` возвращает её в исходное
 * состояние; без этого человек, вернувшийся кнопкой «назад», получил бы
 * форму, которую нечем отправить.
 */
export default function AuthSubmitButton({
  label,
  pendingLabel,
}: {
  /** Обычная подпись — «Iniciar sesión», «Crear cuenta», «Enviar enlace». */
  label: string;
  /** Подпись на время запроса — «Entrando…», «Входим…». */
  pendingLabel: string;
}) {
  // Ссылка стоит на ОБЁРТКЕ, а не на самой кнопке: `Button` — общий
  // компонент проекта, ref он наружу не отдаёт, и заводить ему такую
  // способность ради трёх форм входа значило бы трогать каждую кнопку
  // сайта. `display: contents` у обёртки означает, что в раскладке её
  // нет вовсе — форма по-прежнему видит своим ребёнком кнопку.
  const ref = useRef<HTMLSpanElement>(null);
  const [pending, setPending] = useState(false);
  /** «Слушатель повешен», а не «идёт запрос». Нужен двоим: проверке в
   *  браузере — чтобы нажимать ПОСЛЕ гидратации, а не до неё (до неё
   *  форму отправляет один браузер, и замка нет ни на миг), — и человеку,
   *  разбирающему отказ: атрибута нет вовсе там, где скрипт не ожил. */
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;

    let sent = false;
    const onSubmit = (event: Event) => {
      if (sent) {
        // Второй запрос не уходит вовсе — ни по нажатию, ни по Enter.
        event.preventDefault();
        return;
      }
      // Форма невалидна (пустое поле, неверный адрес) — браузер отправку
      // не начал, и «Entrando…» было бы враньём.
      if (form instanceof HTMLFormElement && !form.checkValidity()) return;
      sent = true;
      flushSync(() => setPending(true));
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      sent = false;
      setPending(false);
    };

    form.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onPageShow);
    setArmed(true);
    return () => {
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return (
    <span ref={ref} className="contents">
      <Button
        type="submit"
        variant="primary"
        haptic={false}
        loading={pending}
        data-auth-submit={armed ? (pending ? "pending" : "ready") : undefined}
      >
        {pending ? pendingLabel : label}
      </Button>
    </span>
  );
}
