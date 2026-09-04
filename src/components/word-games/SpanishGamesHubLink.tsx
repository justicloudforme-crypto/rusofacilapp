import Link from "next/link";

/**
 * The link from the bilingual catalogue /[lang]/word-games down to the
 * Spanish entry page /es/juegos-para-aprender-ruso.
 *
 * Rendered only when lang === "es" — the destination returns 404 on /ru
 * (see its own page.tsx and sitemap.ts's esOnlyPaths), so this is Spanish
 * prose in a Spanish-only branch rather than an untranslated interface
 * label. It lives in its own file for exactly that reason: the catalogue
 * page is bilingual and every string in it must come from a dictionary,
 * which src/lib/ui-strings.test.ts enforces.
 *
 * Why here at all. Measured on production 04.09.2026 over 1912 crawled
 * pages: the header renders four links and the footer six, and no game
 * page is in either set — so /es/juegos-para-aprender-ruso had six inbound
 * links, all from the themed landings it should be feeding, and nothing
 * pointed down into the games from the part of the site people land on.
 * The shared chrome is frozen-experiment surface until 25.09.2026, so the
 * edge goes here instead: the catalogue is in the sitemap and carries 85
 * inbound links of its own.
 */
export default function SpanishGamesHubLink() {
  return (
    <p className="mt-10 border-t border-black/10 pt-6 text-sm leading-6 text-foreground/70 dark:border-white/30">
      <Link
        href="/es/juegos-para-aprender-ruso"
        className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
      >
        Juegos para aprender ruso
      </Link>{" "}
      — sopas de letras por temas, crucigramas para principiantes y el tablero del alfabeto
      cirílico, explicados uno por uno.
    </p>
  );
}
