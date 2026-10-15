import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getRateLimiter, requestIp } from "@/lib/rate-limit";
import { googleSignInConfig } from "@/lib/google-auth/config";
import { isNativeShellRequest } from "@/lib/native-shell";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { shouldUseSecureSessionCookie } from "@/lib/session-token";
import { verifyGoogleIdToken } from "@/lib/google-auth/id-token";
import { GOOGLE_FLOW_TTL_MS, GOOGLE_NATIVE_FLOW_COOKIE, GOOGLE_WEB_FLOW_COOKIE, type GoogleNativeFlow, type GoogleWebFlow, openFlow, pkceChallenge, randomToken, sameSecret, sealFlow } from "@/lib/google-auth/flow-cookie";
import { type GoogleLoginError, loginErrorForToken, signInWithGoogleIdentity } from "@/lib/google-auth/sign-in";

/**
 * ОБРАБОТЧИКИ ВХОДА ЧЕРЕЗ GOOGLE (заход 7.267) — четыре шага в одном
 * модуле, а маршрут один: `src/app/api/auth/google/[step]/route.ts`.
 * Один маршрут, а не четыре: на сборку это не влияет (холодная сборка
 * 7.267 — 6,95–7,00 ГБ, как у `main`), но новых точек входа в сборке
 * меньше, а адреса шагов те же. Сторож — `check:google-signin`.
 */

/**
 * Веб-вход через Google, шаг 1 (заход 7.267): уводит на страницу Google.
 *
 * Флаг выключен (нет настроек в Vercel) — 404, как будто маршрута нет.
 * Внутри приложения — тоже нет: ссылка на accounts.google.com из WebView
 * уходит в Chrome (замер 7.267), и вход достался бы браузеру. В приложении
 * вход нативный — `/api/auth/google/native`.
 */
export async function googleStart(request: NextRequest) {
  const config = googleSignInConfig();
  if (!config || (await isNativeShellRequest())) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const langRaw = url.searchParams.get("lang") ?? "";
  const lang = isLocale(langRaw) ? langRaw : defaultLocale;
  const redirectTo = safeRedirectPath(url.searchParams.get("redirectTo") ?? "", request.url, `/${lang}/profile`);

  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", config.clientId);
  auth.searchParams.set("redirect_uri", `${url.origin}/api/auth/google/callback`);
  auth.searchParams.set("response_type", "code");
  // Только адрес: ни имени, ни фото не просим — данных собирается не больше,
  // чем при регистрации паролем.
  auth.searchParams.set("scope", "openid email");
  auth.searchParams.set("state", state);
  auth.searchParams.set("nonce", nonce);
  auth.searchParams.set("code_challenge", pkceChallenge(verifier));
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set("prompt", "select_account");
  auth.searchParams.set("hl", lang);

  const response = NextResponse.redirect(auth, { status: 303 });
  response.cookies.set(GOOGLE_WEB_FLOW_COOKIE, sealFlow("web", { state, nonce, verifier, lang, redirectTo }), {
    httpOnly: true,
    // Возврат от Google — переход верхнего уровня (GET), «lax» куку несёт.
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/api/auth/google",
    maxAge: GOOGLE_FLOW_TTL_MS / 1000,
  });
  return response;
}

const callbackLimiter = getRateLimiter("googleCallbackByIp", 60_000, 20);

/**
 * Веб-вход через Google, шаг 2 (заход 7.267): Google вернул код.
 * Код меняется на токен здесь, на сервере, с секретом клиента; токен
 * проверяется полностью (`verifyGoogleIdToken`), и только потом ставится
 * НАША обычная сессия — та же кука, что после входа паролем.
 */
export async function googleCallback(request: NextRequest) {
  const config = googleSignInConfig();
  if (!config) return new NextResponse("Not Found", { status: 404 });

  const url = new URL(request.url);
  const flow = openFlow<GoogleWebFlow>("web", request.cookies.get(GOOGLE_WEB_FLOW_COOKIE)?.value);
  const lang = flow && isLocale(flow.lang) ? flow.lang : defaultLocale;

  const finish = (error: GoogleLoginError | null) => {
    const target = error
      ? new URL(`/${lang}/login?error=${error}`, request.url)
      : new URL(safeRedirectPath(flow?.redirectTo ?? "", request.url, `/${lang}/profile`), request.url);
    const response = NextResponse.redirect(target, { status: 303 });
    response.cookies.set(GOOGLE_WEB_FLOW_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return response;
  };

  if (await callbackLimiter.check(requestIp(request))) return finish("google_failed");
  // Человек нажал «Отмена» на странице Google.
  if (url.searchParams.get("error")) return finish("google_cancelled");

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!flow || !code || !state || !sameSecret(state, flow.state)) return finish("google_failed");

  let idToken = "";
  try {
    const exchange = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${url.origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
        code_verifier: flow.verifier,
      }),
      cache: "no-store",
    });
    const body = (await exchange.json().catch(() => null)) as { id_token?: unknown } | null;
    idToken = exchange.ok && typeof body?.id_token === "string" ? body.id_token : "";
  } catch {
    idToken = "";
  }
  if (!idToken) return finish("google_failed");

  const verified = await verifyGoogleIdToken(idToken, { audience: config.clientId, nonce: flow.nonce }).catch(
    () => ({ ok: false as const, error: "malformed" as const })
  );
  if (!verified.ok) return finish(loginErrorForToken(verified.error));

  const signedIn = await signInWithGoogleIdentity(verified.identity, { origin: url.origin });
  return finish(signedIn.ok ? null : signedIn.error);
}

/**
 * Нативный вход через Google, шаг 1 (заход 7.267): одноразовое число для
 * окна Credential Manager. Google кладёт его в токен (`nonce`), сервер на
 * шаге 2 сверяет с тем, что лежит в подписанной куке этого же WebView, —
 * перехваченный где-то токен второй раз не войдёт.
 *
 * Отвечает только оболочке и только при включённом флаге; клиент ID —
 * тот же веб-клиент (`serverClientId` у Credential Manager).
 */
export async function googleNonce() {
  const config = googleSignInConfig();
  if (!config || !(await isNativeShellRequest())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const nonce = randomToken();
  const response = NextResponse.json({ nonce, serverClientId: config.clientId }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(GOOGLE_NATIVE_FLOW_COOKIE, sealFlow("native", { nonce }), {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureSessionCookie(),
    path: "/api/auth/google",
    maxAge: GOOGLE_FLOW_TTL_MS / 1000,
  });
  return response;
}

const nativeLimiter = getRateLimiter("googleNativeByIp", 60_000, 20);

/**
 * Нативный вход через Google, шаг 2 (заход 7.267): приложение прислало
 * ID-токен из Credential Manager. Телефону не верим ни в чём — токен
 * проверяется здесь целиком: подпись Google, `aud` = наш веб-клиент,
 * срок, `nonce` из куки шага 1, подтверждённый адрес. Потом — наша обычная
 * сессия (кука ставится этим же ответом в WebView приложения).
 */
export async function googleNative(request: NextRequest) {
  const config = googleSignInConfig();
  if (!config || !(await isNativeShellRequest())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (await nativeLimiter.check(requestIp(request))) {
    return NextResponse.json({ error: "google_failed" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { idToken?: unknown; lang?: unknown; redirectTo?: unknown } | null;
  const idToken = typeof body?.idToken === "string" ? body.idToken : "";
  const lang = typeof body?.lang === "string" && isLocale(body.lang) ? body.lang : defaultLocale;
  const flow = openFlow<GoogleNativeFlow>("native", request.cookies.get(GOOGLE_NATIVE_FLOW_COOKIE)?.value);

  const reply = (status: number, payload: Record<string, unknown>) => {
    const response = NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
    response.cookies.set(GOOGLE_NATIVE_FLOW_COOKIE, "", { path: "/api/auth/google", maxAge: 0 });
    return response;
  };

  if (!idToken || !flow) return reply(400, { error: "google_failed" });

  const verified = await verifyGoogleIdToken(idToken, { audience: config.clientId, nonce: flow.nonce }).catch(
    () => ({ ok: false as const, error: "malformed" as const })
  );
  if (!verified.ok) return reply(400, { error: loginErrorForToken(verified.error) });

  const signedIn = await signInWithGoogleIdentity(verified.identity, { origin: new URL(request.url).origin });
  if (!signedIn.ok) return reply(400, { error: signedIn.error });

  const redirectTo = safeRedirectPath(typeof body?.redirectTo === "string" ? body.redirectTo : "", request.url, `/${lang}/profile`);
  return reply(200, { ok: true, redirectTo });
}
