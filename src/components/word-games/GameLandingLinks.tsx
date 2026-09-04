import Link from "next/link";

/** The four Spanish game pages, as one table.
 *
 * Before 04.09.2026 each of them linked "down" (the hub named the three
 * game pages; the three named the hub only through the shared block
 * below, which did not carry it) and none of them linked sideways.
 * Measured on production the same day: /es/crucigramas-ruso-principiantes
 * had ONE inbound link in the whole site and /es/sopa-de-letras-alfabeto-cirilico
 * had two — a crossword entry existed but hung off a single edge. Listing
 * the siblings here gives each of the four three more, and it is the same
 * list on every page, so a fifth game page cannot be added to one and
 * forgotten on the others.
 */
const GAME_PAGES = [
  {
    key: "hub",
    href: "/es/juegos-para-aprender-ruso",
    label: "Todos los juegos para aprender ruso",
    note: "sopas de letras, crucigramas y el alfabeto, en un solo sitio",
  },
  {
    key: "sopa",
    href: "/es/sopa-de-letras-ruso",
    label: "Sopa de letras en ruso, por temas",
    note: "una para empezar y seis temáticas",
  },
  {
    key: "crucigrama",
    href: "/es/crucigramas-ruso-principiantes",
    label: "Crucigrama de ruso para principiantes",
    note: "pistas en español, respuestas en cirílico",
  },
  {
    key: "alfabeto",
    href: "/es/sopa-de-letras-alfabeto-cirilico",
    label: "Sopa de letras del alfabeto cirílico",
    note: "casi todas las letras rusas, al menos una vez",
  },
] as const;

export type GameLandingKey = (typeof GAME_PAGES)[number]["key"];

/** Shared footer link block for the Spanish game pages — the sibling game
 * pages first, then the glossary, the one always-free lesson (A1/1, see
 * isFreeTrialLesson) and the full word-games catalog, per an explicit
 * owner requirement that every landing page point a curious-but-not-yet-
 * decided visitor somewhere further into the product.
 *
 * `current` is the page rendering the block; it is dropped from the
 * sibling list so no page links to itself. */
export default function GameLandingLinks({ current }: { current: GameLandingKey }) {
  const siblings = GAME_PAGES.filter((page) => page.key !== current);
  return (
    <section className="mt-10 flex flex-col gap-2 border-t border-black/10 pt-6 dark:border-white/30">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/50">Seguir jugando</h2>
      <ul className="flex flex-col gap-2">
        {siblings.map((page) => (
          <li key={page.key}>
            <Link
              href={page.href}
              className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
            >
              {page.label}
            </Link>
            <span className="text-sm text-foreground/60"> · {page.note}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/es/glossary"
        className="tap mt-2 font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
      >
        Consulta más términos de gramática rusa en el glosario →
      </Link>
      <Link
        href="/es/courses/a1/1"
        className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
      >
        Prueba la primera lección de ruso, gratis y sin límite de tiempo →
      </Link>
      <Link
        href="/es/word-games"
        className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
      >
        Ver todos los juegos de palabras en ruso →
      </Link>
    </section>
  );
}
