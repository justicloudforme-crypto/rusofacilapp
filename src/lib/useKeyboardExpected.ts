"use client";

import { useEffect, useState } from "react";

/**
 * ДОЛГ 246 (заход 7.287): «клавиатура вот-вот выедет».
 *
 * Замер на эмуляторе (Android 16, оболочка 1.0.16, `/es/login`, касание
 * поля почты): нижняя панель пряталась по признаку `useKeyboardOpen()`, а
 * он загорается только ПОСЛЕ того, как клавиатура сжала окно (904 → 568
 * CSS-px). В этот кадр панель, прижатая к низу окна, оказывалась на краю
 * клавиатуры (top 816 → 480) и ещё 198 мс съезжала анимацией у всех на
 * виду — то самое «меню прыгает».
 *
 * Лекарство — знать о клавиатуре раньше окна: касание пальцем
 * текстового поля и есть момент, когда Android её поднимает. Признак
 * держится, пока не придёт настоящая клавиатура (дальше её ведёт
 * `useKeyboardOpen`), пока поле не потеряет фокус, или не истечёт
 * `KEYBOARD_EXPECT_MS` — у кого клавиатура аппаратная, панель вернётся.
 *
 * Только касание (`pointerType === "touch"`): мышь и программный фокус
 * экранную клавиатуру не поднимают, и панель из-за них прятаться не должна.
 */
export const KEYBOARD_EXPECT_MS = 1500;

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Поднимет ли фокус в этом элементе экранную клавиатуру. */
export function opensSoftKeyboard(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== "string") return false;
  const el = target as HTMLElement;
  if (el.getAttribute("inputmode") === "none") return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") {
    const ta = el as HTMLTextAreaElement;
    return !ta.readOnly && !ta.disabled;
  }
  if (el.tagName === "INPUT") {
    const input = el as HTMLInputElement;
    return !input.readOnly && !input.disabled && !NON_TEXT_INPUT_TYPES.has(input.type);
  }
  return false;
}

export function useKeyboardExpected(keyboardOpen: boolean): boolean {
  const [expected, setExpected] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastTouchAt = -Infinity;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      setExpected(false);
    };
    const expect = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(clear, KEYBOARD_EXPECT_MS);
      setExpected(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      lastTouchAt = event.timeStamp;
      // Повторное касание поля, которое уже в фокусе (клавиатуру перед
      // этим закрыли кнопкой «назад», фокус остался): `focusin` не придёт,
      // а клавиатура выедет снова.
      if (event.target === document.activeElement && opensSoftKeyboard(event.target)) expect();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.timeStamp - lastTouchAt > 1000) return;
      if (opensSoftKeyboard(event.target)) expect();
    };
    const onFocusOut = () => clear();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, []);

  // Пришла настоящая клавиатура — ожидание исполнено, дальше правит
  // `useKeyboardOpen`; иначе после её закрытия панель так и осталась бы
  // спрятанной до потери фокуса.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (keyboardOpen) setExpected(false);
  }, [keyboardOpen]);

  return expected && !keyboardOpen;
}
