// Shared across the three game-landing pages (/sopa-de-letras-ruso,
// /crucigramas-ruso-principiantes, /sopa-de-letras-alfabeto-cirilico) —
// per an explicit owner requirement: a visitor who arrived to play a
// puzzle, not to study, still needs one honest reason to keep going
// toward an actual lesson. Deliberately neutral Spanish (no
// Mexico-specific or Spain-specific framing) — same rule as the rest of
// the site's Spanish-facing copy, since this content is aimed at anyone
// searching in Spanish, not one country's audience. Hardcoded rather than
// routed through the i18n dictionary — this text is Spanish-only content,
// not translated UI chrome, same precedent as lesson grammar text
// (src/lib/lessons/content.ts's own comment on why that's Spanish-only
// regardless of interface language).
/**
 * `plural` — para el hub /juegos-para-aprender-ruso. El texto se escribió
 * para las tres landings de UN juego, donde «como en este juego» señala la
 * página en la que está el lector. En el hub no hay un juego al que
 * señalar: la página lista tres juegos y seis cuadrículas temáticas, y el
 * singular se queda sin referente. No es una errata de concordancia — la
 * frase es correcta en las tres landings y solo falla aquí —, así que la
 * variante viaja como prop y las otras tres páginas no cambian ni una
 * letra.
 */
export default function WhyLearnRussianBlurb({ plural = false }: { plural?: boolean }) {
  return (
    <p className="mt-4 leading-7 text-foreground/70">
      El ruso es la lengua materna de más de 150 millones de personas y la
      segunda más usada en internet, con literatura, cine y música que rara
      vez llegan traducidos. También abre puertas concretas: estudios,
      trabajo remoto y viajes por un territorio que cruza dos continentes.
      El alfabeto cirílico, que parece la primera barrera, en realidad se
      aprende en pocas horas — y reconocer sus letras, como en{" "}
      {plural ? "estos juegos" : "este juego"}, es el primer paso real hacia
      leer ruso de verdad.
    </p>
  );
}
