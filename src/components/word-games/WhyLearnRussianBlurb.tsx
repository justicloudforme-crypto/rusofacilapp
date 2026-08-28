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
export default function WhyLearnRussianBlurb() {
  return (
    <p className="mt-4 leading-7 text-foreground/70">
      El ruso es la lengua materna de más de 150 millones de personas y la
      segunda más usada en internet, con literatura, cine y música que rara
      vez llegan traducidos. También abre puertas concretas: estudios,
      trabajo remoto y viajes por un territorio que cruza dos continentes.
      El alfabeto cirílico, que parece la primera barrera, en realidad se
      aprende en pocas horas — y reconocer sus letras, como en este juego,
      es el primer paso real hacia leer ruso de verdad.
    </p>
  );
}
