import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_COOKIE, shouldUseSecureSessionCookie, signUserId, verifySessionToken } from "./session-token";
import * as Sentry from "@sentry/nextjs";

/**
 * Real email+password authentication (see /api/auth/login and
 * /api/auth/register, password hashing in src/lib/password.ts). The session
 * cookie is HMAC-signed so it can't be forged (src/lib/session-token.ts) and
 * carries the `sessionVersion` it was issued with — bumping a user's
 * sessionVersion (change-password, reset-password, "sign out other
 * devices") invalidates every token signed with an older version, with no
 * server-side session table to store or clean up.
 * Accounts created before this existed have `passwordHash: null` — signing
 * up again with that same email "claims" the account and sets its first
 * password, rather than being locked out (see /api/auth/register).
 */
export async function createSession(userId: string, sessionVersion: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, signUserId(userId, sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    // True on every real deployment. See shouldUseSecureSessionCookie for
    // the single exception (the e2e server) and why it exists.
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * ТОТ ЖЕ ЧЕЛОВЕК, НО ДЛЯ ОБОЛОЧКИ СТРАНИЦЫ — 20.09.2026, заход 7.220.
 *
 * Что измерено. Sentry `JAVASCRIPT-NEXTJS-14`: `Invalid
 * prisma.user.findUnique() invocation` … `BLOCKED: Operation was blocked`,
 * **unhandled**, транзакция `Layout Server Component (/[lang])`, 6 событий.
 * `BLOCKED` — отказ самой Turso принимать чтения (авария квоты 11.09.2026,
 * строка 135 PROGRESS.md), не наш код и не состояние строки.
 *
 * Чего это стоило. Раскладка `/[lang]` рисует ШАПКУ, а шапка стоит на
 * КАЖДОЙ странице сайта. Отказ одного чтения `User` поэтому стоил не
 * одного экрана, а всего сайта — для вошедшего человека. Само чтение при
 * этом решает ровно одно: показать шапку с аватаром или шапку с кнопкой
 * «войти».
 *
 * Что делает эта функция. Ровно то же, что `getCurrentUser`, но отказ базы
 * отдаёт как `null`, то есть как «гость». Это ОТКАЗ В СТОРОНУ МЕНЬШЕГО:
 * гостю видно меньше, чем вошедшему, и ни одна дверь этим не открывается.
 *
 * ГДЕ ЕЁ НЕЛЬЗЯ ЗВАТЬ, И ЭТО ГЛАВНОЕ. Везде, где ответ решает ДОСТУП или
 * ДЕНЬГИ, зовётся `getCurrentUser`, и её отказ остаётся громким. Причина
 * названа числом в `src/lib/db-read-resilience.test.ts`
 * (`MUST_FAIL_LOUDLY`): `getEntitlementTier()` строится поверх
 * `getCurrentUser()`, и проглоченный отказ превратил бы подписчика в
 * `free` — то есть показал бы уже оплатившему человеку пейвол, а
 * следующим его действием была бы вторая оплата. Пустая страница дешевле
 * второго списания.
 *
 * Две функции, а не признак у одной, намеренно: признак пришлось бы
 * передавать через три слоя, и первый же новый вызов получил бы
 * умолчание, которого никто не выбирал.
 */
export async function getCurrentUserForChrome() {
  try {
    return await getCurrentUser();
  } catch (error) {
    console.error(
      "[auth] не удалось прочитать строку вошедшего человека — шапка рисуется видом для гостя",
      error
    );
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const parsed = verifySessionToken(token);
  if (!parsed) return null;

  const user = await db.user.findUnique({ where: { id: parsed.userId } });
  // A version mismatch means this token was issued before the user's most
  // recent password change / "sign out other devices" — treat it exactly
  // like no session at all, rather than a distinct error, since from the
  // caller's perspective it is one.
  if (!user || user.sessionVersion !== parsed.sessionVersion) return null;

  // Every server-side Sentry event from this request now carries who it
  // happened to. Only the id — never the email — see SentryUser.tsx for the
  // reasoning and for the browser half of this. Sentry gives each request
  // its own isolation scope, so this does not leak between concurrent
  // requests on the same instance; it is a no-op when the SDK is disabled,
  // which it is everywhere except a Vercel deploy.
  Sentry.setUser({ id: user.id });

  return user;
}
