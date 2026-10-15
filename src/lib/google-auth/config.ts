/**
 * «ВХОД ЧЕРЕЗ GOOGLE» — ФЛАГ И НАСТРОЙКИ (заход 7.267).
 *
 * Флаг — само наличие настроек. Пока владелец не завёл в Vercel ОБЕ
 * переменные, вход через Google выключен целиком: кнопок нет ни на сайте,
 * ни в приложении, маршруты `/api/auth/google/*` отвечают 404, и сайт
 * ведёт себя ровно как до захода. Половины настройки не бывает: без
 * секрета веб-вход невозможен, а приложение без веба показывало бы кнопку,
 * которой нет в браузере у того же человека.
 *
 *   GOOGLE_CLIENT_ID     — client ID типа «Web application» (не секрет; он
 *                          же `aud` токена и у нативного входа Android:
 *                          Credential Manager выдаёт токен на serverClientId,
 *                          а это и есть веб-клиент);
 *   GOOGLE_CLIENT_SECRET — секрет того же веб-клиента; только в Vercel,
 *                          никогда в репозитории.
 *
 * Чтение — на каждый вызов, не при импорте: переменную, заведённую после
 * Redeploy, видно без правки кода, а тесты задают окружение сами.
 */
export interface GoogleSignInConfig {
  clientId: string;
  clientSecret: string;
}

export function googleSignInConfig(env: NodeJS.ProcessEnv = process.env): GoogleSignInConfig | null {
  const clientId = (env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleSignInEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return googleSignInConfig(env) !== null;
}

/**
 * С какой сборки оболочки есть нативный плагин `RfGoogleSignIn` —
 * 1.0.16 (versionCode 17). В старых сборках кнопки в приложении нет:
 * веб-вход внутри приложения уходит в Chrome (замер 7.267 на эмуляторе),
 * и кука досталась бы браузеру, а не приложению.
 */
export const NATIVE_GOOGLE_MIN_SHELL_VERSION = 17;

/** Где и какую кнопку рисовать. Чистая функция — её держат юнит и сторож. */
export type GoogleButtonMode = "none" | "web" | "native";

export function googleButtonMode(input: {
  enabled: boolean;
  inApp: boolean;
  shellVersion: number | null;
}): GoogleButtonMode {
  if (!input.enabled) return "none";
  if (!input.inApp) return "web";
  // Версия неизвестна — значит старая оболочка без метки версии; в ней
  // плагина нет. Клиент дополнительно спрашивает сам плагин.
  if (input.shellVersion === null || input.shellVersion < NATIVE_GOOGLE_MIN_SHELL_VERSION) return "none";
  return "native";
}
