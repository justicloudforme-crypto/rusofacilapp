/**
 * Куда страница входа уводит уже вошедшего (заход 7.236, находка 3):
 * туда, куда он шёл (`redirectTo`), если это путь ЭТОГО сайта и не сама
 * страница входа или регистрации — иначе вышла бы петля; во всех прочих
 * случаях — в кабинет.
 *
 * Путь проверяется как строка, без разбора URL против какого-либо хоста:
 * своим считается только то, что начинается с одного «/». «//evil» и
 * «/\evil» браузер читает как адрес ЧУЖОГО хоста, поэтому они отсекаются,
 * как и любые управляющие символы.
 */
export function signedInLoginTarget(redirectTo: string, lang: string): string {
  const fallback = `/${lang}/profile`;
  if (!/^\/(?![/\\])/.test(redirectTo)) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(redirectTo)) return fallback;
  const path = redirectTo.split(/[?#]/)[0];
  if (/\/(login|register)\/?$/.test(path)) return fallback;
  return redirectTo;
}
