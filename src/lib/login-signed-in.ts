import { safeRedirectPath } from "./safe-redirect";

/** Любой адрес вне сайта отсекается: основа только для разбора пути. */
const PARSE_BASE = "https://rusofacilapp.invalid/";

/**
 * Куда страница входа уводит уже вошедшего (заход 7.236, находка 3):
 * туда, куда он шёл (`redirectTo`), если это путь сайта и не сама
 * страница входа или регистрации — иначе вышла бы петля; во всех прочих
 * случаях — в кабинет.
 */
export function signedInLoginTarget(redirectTo: string, lang: string): string {
  const fallback = `/${lang}/profile`;
  const target = safeRedirectPath(redirectTo, PARSE_BASE, fallback);
  const path = target.split(/[?#]/)[0];
  if (/\/(login|register)\/?$/.test(path)) return fallback;
  return target;
}
