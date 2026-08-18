// Guards every "redirect here after login/register" flow against an open
// redirect: `redirectTo` is client-supplied (a query param echoed into a
// hidden form field), and naively doing `new URL(redirectTo, request.url)`
// sends a user who just typed their real password straight to an
// attacker's domain for anything that resolves off-origin — a plain
// absolute URL (`https://evil.com`), a protocol-relative one (`//evil.com`),
// or a backslash/control-character trick (`/\evil.com`) that some URL
// parsers normalize into `//evil.com`. Resolving first and then comparing
// the ORIGIN of the result (not pattern-matching the raw string) catches
// all of those the same way, since every trick above only matters if it
// survives resolution — this checks what it actually resolved to.
export function safeRedirectPath(rawPath: string, requestUrl: string, fallback: string): string {
  const requestOrigin = new URL(requestUrl).origin;
  try {
    const resolved = new URL(rawPath, requestUrl);
    if (resolved.origin === requestOrigin) {
      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
  } catch {
    // Malformed input — fall through to the fallback below.
  }
  return fallback;
}
