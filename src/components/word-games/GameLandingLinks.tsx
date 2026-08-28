import Link from "next/link";

/** Shared footer link block for the three game-landing pages — glossary,
 * the one always-free lesson (A1/1, see isFreeTrialLesson), and the full
 * word-games catalog, per an explicit owner requirement that every
 * landing page point a curious-but-not-yet-decided visitor somewhere
 * further into the product. */
export default function GameLandingLinks() {
  return (
    <section className="mt-10 flex flex-col gap-2 border-t border-black/10 pt-6 dark:border-white/30">
      <Link
        href="/es/glossary"
        className="tap font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
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
