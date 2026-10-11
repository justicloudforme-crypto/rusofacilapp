/**
 * ТЕЛО НЕ ТОЙ ФОРМЫ — ОТВЕТ 415/400, А НЕ ИСКЛЮЧЕНИЕ (10.10.2026, заход 7.262).
 *
 * Что было измерено. Sentry `JAVASCRIPT-NEXTJS-S`: `TypeError: Content-Type
 * was not one of "multipart/form-data" or "application/x-www-form-urlencoded"`,
 * unhandled, `POST /api/checkout`, 2 события. Запрос — `application/json`,
 * тело 2 байта, User-Agent `Rusofacil-Owner-Security-Review/1.0`: проверка
 * безопасности одного из прошлых заходов. `request.formData()` бросает на
 * любом другом типе тела, и обработчик отвечал 500 с событием в Sentry.
 *
 * Класс, а не случай: в `src/app` было 18 обработчиков с голым
 * `await request.formData()` (касса, вход, регистрация, сброс пароля,
 * выход, коды доступа, группы, отмена подписки, админка). Все читают форму
 * этой функцией; сторож `npm run check:request-body` не даёт вернуть
 * голый вызов.
 *
 * Правило ответа:
 *   * тип тела не форма (JSON, текст, пусто без заголовка) — **415**;
 *   * тип формы, а тело не разбирается (битая граница multipart) — **400**.
 * Ни то ни другое не ошибка сервера и в Sentry не уходит: это ответ на
 * чужой запрос, а не наша поломка. Настоящая форма браузера читается ровно
 * как раньше — тем же `request.formData()`.
 */
import { NextResponse } from "next/server";

const FORM_TYPES = /^(multipart\/form-data|application\/x-www-form-urlencoded)\s*(;|$)/i;

export type FormRead = { ok: true; form: FormData } | { ok: false; response: NextResponse };

export async function readRequestForm(request: Request): Promise<FormRead> {
  const type = request.headers.get("content-type") ?? "";
  if (!FORM_TYPES.test(type.trim())) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unsupported_media_type" }, { status: 415 }),
    };
  }
  try {
    return { ok: true, form: await request.formData() };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "malformed_body" }, { status: 400 }) };
  }
}
