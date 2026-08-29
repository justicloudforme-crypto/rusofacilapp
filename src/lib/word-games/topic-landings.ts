import type { WordGameType } from "./types";

/**
 * The six `/es/sopa-de-letras-ruso-<tema>` landing pages.
 *
 * Why these exist. `/es/sopa-de-letras-ruso` answers one query — "sopa de
 * letras en ruso" — and nothing narrower. Since 02.09.2026 the 80 free
 * puzzles are built from a single vocabulary category each (see topics.ts),
 * so "sopa de letras de comida en ruso" is now a query the site can answer
 * with a real themed puzzle instead of a generic grid.
 *
 * Why SIX and not all sixteen categories that have themed puzzles. Three
 * criteria, applied in this order:
 *
 *  1. The theme has to be something a Spanish speaker would actually type.
 *     "sopa de letras de comida en ruso" is a search; "sopa de letras de
 *     conceptos abstractos" is not a search, it is a database category.
 *     This rules out conceptos-abstractos, sinonimos-y-antonimos,
 *     palabras-basicas (which is a level, not a topic, and would compete
 *     with the generic landing for the same intent), and the weaker
 *     ciencia / arte-y-ocio / emociones.
 *  2. At least two themed puzzles across at least two different levels, so
 *     the page has somewhere to send a visitor after the embedded one.
 *     This rules out trabajo, sociedad and psicologia (one puzzle each,
 *     all B2) and sinonimos-y-antonimos (two puzzles, both B2).
 *  3. A live /es/vocabulary/<slug> page to hand the full word list to.
 *     All 23 categories have one, so this never bound in practice — it is
 *     asserted in the test rather than assumed.
 *
 * Seven categories have no themed puzzle at all (verbos-de-movimiento,
 * viajes, saludos, tecnologia, politica, deportes, derecho) and so were
 * never candidates. Measured against production on 02.09.2026; the counts
 * are in PROGRESS.md.
 *
 * Why the text is written per theme and not generated. A paragraph with
 * the category name substituted into a shared sentence is exactly the thin
 * page that /es/vocabulary was built to fix — six of those would be six
 * near-duplicates competing with each other. Each intro below explains
 * something specific about how THOSE Russian words behave, and each
 * deliberately takes a DIFFERENT angle from the same category's
 * /es/vocabulary intro, which the reader may well open next: the
 * vocabulary page covers the genitive of quantity for food, this one
 * covers indeclinable loanwords; the vocabulary page covers надеть/одеть
 * for clothes, this one covers plural-only garments. Duplicating them
 * would make the two pages compete instead of complement.
 */
export interface TopicLanding {
  /** URL segment after `/es/sopa-de-letras-ruso-`. Short and query-shaped
   * ("ciudad", not "ciudad-y-transporte") — nobody searches the internal
   * category name. */
  slug: string;
  /** WordGamePuzzle.topic and the /es/vocabulary/<slug> segment. */
  topic: string;
  h1: string;
  /** <= 70 characters including " | RusoFácilapp". */
  metaTitle: string;
  /** 70-155 characters. */
  metaDescription: string;
  /** Short label used inside link text: "de comida", "de la ciudad". */
  linkLabel: string;
  /** 250+ words, entirely specific to this theme. */
  intro: string[];
  /** Machine-readable summary for the Article JSON-LD. */
  articleDescription: string;
}

export const TOPIC_LANDINGS: TopicLanding[] = [
  {
    slug: "comida",
    topic: "comida",
    h1: "Sopa de letras de comida en ruso",
    metaTitle: "Sopa de letras de comida en ruso, gratis | RusoFácilapp",
    metaDescription:
      "Sopa de letras con vocabulario ruso de comida y bebida, gratis y sin registro. Cada palabra con su traducción, y la lista completa del tema.",
    linkLabel: "de comida",
    articleDescription:
      "Sopa de letras temática de comida en ruso, con una explicación de cómo se comportan los sustantivos de alimentos: préstamos invariables, el género que no se adivina y el acento fijo.",
    intro: [
      "Los nombres de alimentos son de las primeras palabras rusas que se aprenden, y también de las que más rápido se olvidan si se estudian en una lista suelta. Buscarlas letra por letra en una cuadrícula obliga a hacer algo distinto de repetirlas: reconocer la forma escrita en cirílico, que es donde de verdad se atasca un principiante hispanohablante.",
      "Hay un grupo de palabras de este campo que se comporta al revés de lo que uno espera. Кофе, «café», termina en -е, y en ruso las palabras terminadas en -е suelen ser neutras; sin embargo кофе es masculino, y además no se declina: se dice пью кофе igual en todas las situaciones, sin cambiarle la terminación. Lo mismo pasa con кафе, «cafetería», y con меню, «menú»: son préstamos extranjeros y el ruso los deja intactos. Para quien viene del español esto es una buena noticia, porque son las únicas palabras del tema que nunca hay que modificar.",
      "El resto sí cambia, y el género no se puede adivinar por el significado. Молоко y мясо son neutros, соль es femenino aunque acabe en consonante, y хлеб es masculino. La terminación manda, no la idea; conviene aprender cada alimento con su artículo mental desde el principio, porque el género decide después la forma del adjetivo que lo acompaña.",
      "Un detalle que separa a quien ha practicado de quien no: el acento. En español el acento se escribe cuando hace falta; en ruso nunca se escribe, pero se mueve. Торт, «tarta», mantiene el acento en la primera sílaba también en plural — то́рты, no тортЫ — y esa es una de las palabras con las que los propios rusos se corrigen entre ellos. En вода, «agua», el acento va al final, pero en la forma воду salta al principio.",
      "En la sopa de letras de abajo las palabras aparecen tal como se escriben, sin acento marcado y sin traducción encima: primero se encuentran, después se leen. Debajo tienes la lista completa del tema, cada palabra con transcripción, traducción y una frase de ejemplo.",
    ],
  },
  {
    slug: "familia",
    topic: "familia",
    h1: "Sopa de letras de la familia en ruso",
    metaTitle: "Sopa de letras de la familia en ruso, gratis | RusoFácilapp",
    metaDescription:
      "Sopa de letras con vocabulario ruso de la familia, gratis y sin registro. Padres, hermanos e hijos en cirílico, con traducción y lista completa.",
    linkLabel: "de la familia",
    articleDescription:
      "Sopa de letras temática de la familia en ruso, con una explicación del sistema de nombres rusos, los diminutivos y los sustantivos de parentesco que cambian de raíz.",
    intro: [
      "Hablar de la propia familia es lo primero que se pide en cualquier clase de ruso, y por eso este vocabulario aparece antes que casi cualquier otro. Son palabras cortas, muy repetidas y fáciles de reconocer una vez que el ojo se acostumbra al cirílico — que es justo lo que entrena una sopa de letras.",
      "Dos sustantivos de este campo hacen algo que no tiene equivalente en español: cambian de raíz al declinarse. Мать, «madre», y дочь, «hija», intercalan un -ер- en cuanto dejan de ser sujeto: мать пришла, «la madre vino», pero я вижу мать y у матери, «de la madre». La forma larga aparece en la mayoría de los casos, así que en la práctica se oye матери mucho más que мать. Merece la pena aprender las dos formas juntas desde el primer día, porque nadie las deduce.",
      "Lo segundo que conviene saber no está en ninguna lista de vocabulario: cómo funciona un nombre ruso completo. Son tres piezas — nombre, patronímico y apellido — y la del medio se forma a partir del nombre del padre: el hijo de Иван es Иванович, la hija es Ивановна. En el trato formal no se usa «señor» más apellido como en español, sino nombre y patronímico juntos: a un profesor se le llama Иван Петрович, nunca господин Петров. Saber esto evita el error más visible de un extranjero educado.",
      "Y en el lado informal está el sistema de diminutivos, que es enorme y no es opcional. Александр es Саша, Дмитрий es Дима, Мария es Маша, y esas formas cortas son las que se usan de verdad entre conocidos. No son infantiles ni cariñosas en exceso: son el registro normal. Lo mismo vale para мама y папа, que un adulto ruso emplea sin que suene a niño pequeño.",
      "La cuadrícula de abajo trae solo palabras de este tema. Debajo está la lista completa, con transcripción, traducción y una frase de ejemplo para cada una.",
    ],
  },
  {
    slug: "ropa",
    topic: "ropa",
    h1: "Sopa de letras de ropa en ruso",
    metaTitle: "Sopa de letras de ropa en ruso, gratis | RusoFácilapp",
    metaDescription:
      "Sopa de letras con vocabulario ruso de ropa y prendas, gratis y sin registro. Cada palabra en cirílico con traducción, y la lista completa del tema.",
    linkLabel: "de ropa",
    articleDescription:
      "Sopa de letras temática de ropa en ruso, con una explicación de las prendas que solo existen en plural y de la diferencia entre llevar puesto y ponerse.",
    intro: [
      "El vocabulario de ropa es de los más rentables para practicar lectura en cirílico: son sustantivos concretos, casi todos de dos o tres sílabas, y aparecen constantemente en descripciones de personas. Encontrarlos escondidos en una cuadrícula entrena el reconocimiento visual de las letras, que es el paso previo a leer una frase entera sin deletrear.",
      "Este campo tiene una particularidad gramatical que sorprende: varias prendas no tienen singular. Брюки, «pantalones», джинсы, «jeans», шорты, «shorts» y очки, «gafas» o «anteojos» según el país, existen únicamente en plural, igual que en español ocurre con «pantalones» o «tijeras». La consecuencia práctica es que el verbo y el adjetivo también van en plural: se dice эти брюки красивые, nunca la forma singular. Cuando hace falta contarlos, el ruso recurre a пара, «par»: две пары брюк.",
      "El segundo punto separa dos ideas que el español resuelve con un solo verbo. Носить significa llevar puesto de forma habitual — она носит очки, «ella usa gafas» — mientras que надеть es la acción puntual de ponerse algo ahora: я надел куртку, «me puse la chaqueta». Elegir mal no impide que te entiendan, pero cambia el sentido: носить куртку describe una costumbre, надеть куртку describe un momento.",
      "Y hay una tercera cosa que conviene tener presente al comprar: la talla. Размер es la palabra, y la pregunta habitual es какой у вас размер, literalmente «qué talla tiene usted». Las tallas rusas no coinciden con las europeas ni con las americanas, así que el número que uno conoce de casa no sirve tal cual.",
      "Debajo tienes la sopa de letras con palabras solo de este tema, y a continuación la lista completa del vocabulario de ropa, cada entrada con transcripción, traducción y una frase de ejemplo.",
    ],
  },
  {
    slug: "ciudad",
    topic: "ciudad-y-transporte",
    h1: "Sopa de letras de la ciudad en ruso",
    metaTitle: "Sopa de letras de la ciudad en ruso, gratis | RusoFácilapp",
    metaDescription:
      "Sopa de letras con vocabulario ruso de ciudad y transporte, gratis y sin registro. Calles, edificios y medios de transporte en cirílico, con traducción.",
    linkLabel: "de la ciudad",
    articleDescription:
      "Sopa de letras temática de ciudad y transporte en ruso, con una explicación de por qué el mismo lugar se dice de dos formas según si te mueves hacia él o estás en él.",
    intro: [
      "Este es el vocabulario que hace utilizable un letrero, un plano del metro o el nombre de una parada. Son palabras que se ven antes que se oyen, así que reconocerlas escritas en cirílico vale más aquí que en casi cualquier otro campo — y eso es exactamente lo que se practica buscándolas en una cuadrícula.",
      "La particularidad que más cuesta no está en las palabras sino en lo que les pasa alrededor. En ruso el mismo lugar se dice de dos maneras distintas según si te mueves hacia él o ya estás allí. «Voy a la tienda» es я иду в магазин, con магазин en acusativo; «estoy en la tienda» es я в магазине, con la misma palabra en prepositional. La preposición no cambia — в en los dos casos — y lo único que distingue movimiento de posición es la terminación del sustantivo. El español marca esa diferencia con la preposición («a» frente a «en») y deja el sustantivo quieto; el ruso hace justo lo contrario.",
      "Los medios de transporte añaden su propia construcción. Para decir en qué vas, el ruso usa на más prepositional: на автобусе, на метро, на поезде. Literalmente es «sobre el autobús», y aunque suene raro traducido, es la forma normal y la que hay que automatizar. Пешком, «a pie», es en cambio un adverbio suelto que no lleva preposición ninguna.",
      "Una nota sobre una palabra que aparece en todos los planos: вокзал es la estación grande de trenes de larga distancia, mientras que станция es una estación de metro o una parada intermedia. No son sinónimos, y confundirlos en una pregunta a un desconocido lleva a la respuesta equivocada.",
      "La cuadrícula de abajo usa solo palabras de este tema. Debajo está la lista completa, cada palabra con transcripción, traducción y una frase de ejemplo en contexto.",
    ],
  },
  {
    slug: "clima",
    topic: "clima-y-naturaleza",
    h1: "Sopa de letras del clima en ruso",
    metaTitle: "Sopa de letras del clima en ruso, gratis | RusoFácilapp",
    metaDescription:
      "Sopa de letras con vocabulario ruso del clima y la naturaleza, gratis y sin registro. Lluvia, nieve y estaciones en cirílico, con traducción.",
    linkLabel: "del clima",
    articleDescription:
      "Sopa de letras temática del clima en ruso, con una explicación de por qué la lluvia y la nieve «caminan», y de cómo se cuentan los grados de temperatura.",
    intro: [
      "El tiempo es el tema con el que empieza cualquier conversación, y en ruso tiene la ventaja de que las frases son cortas. Eso lo convierte en un buen campo para practicar lectura: las palabras son reconocibles y aparecen enteras, sin construcciones largas alrededor.",
      "La expresión más común del tema es también la más desconcertante al traducirla. Para decir «llueve», el ruso dice идёт дождь, literalmente «la lluvia camina», con el mismo verbo que se usa para una persona que va andando. Con la nieve pasa igual: идёт снег. No es una metáfora poética, es la forma normal y la única que se oye; en pasado se dice шёл дождь. Quien traduce mentalmente desde el español busca un verbo equivalente a «llover» y no lo encuentra, porque no existe como tal en el uso corriente.",
      "El segundo punto útil es la temperatura, que en Rusia se menciona muchísimo más que en países templados. Градус, «grado», cambia de forma según el número que lo acompaña: один градус, два градуса, пять градусов. Y como las temperaturas bajo cero son la mitad del año en buena parte del país, la palabra минус se antepone sin más: минус пять, «cinco bajo cero». En una previsión oral esos números llegan rápido y sin pausa, así que conviene tener automatizadas las tres terminaciones.",
      "Vale la pena saber además que погода, «tiempo atmosférico», y время, «tiempo cronológico», son palabras completamente distintas y no intercambiables — el español las junta en una sola y es una confusión frecuente al principio.",
      "Debajo tienes la sopa de letras con palabras solo de este tema, y después la lista completa del vocabulario de clima y naturaleza, con transcripción, traducción y una frase de ejemplo por palabra.",
    ],
  },
  {
    slug: "compras",
    topic: "compras",
    h1: "Sopa de letras de compras en ruso",
    metaTitle: "Sopa de letras de compras en ruso, gratis | RusoFácilapp",
    metaDescription:
      "Sopa de letras con vocabulario ruso de compras, tiendas y precios, gratis y sin registro. Cada palabra en cirílico con su traducción al español.",
    linkLabel: "de compras",
    articleDescription:
      "Sopa de letras temática de compras en ruso, con una explicación de cómo se pregunta por algo en una tienda y de la diferencia entre caro como adjetivo y como valoración.",
    intro: [
      "Comprar es una de las pocas situaciones en las que un principiante se defiende con muy poco vocabulario, siempre que reconozca las palabras cuando las ve escritas en un cartel o en una etiqueta. Por eso este tema funciona especialmente bien como sopa de letras: casi todo lo que aparece en la cuadrícula es algo que después se lee en la calle.",
      "La pregunta más útil de la tienda no es «cuánto cuesta» sino la que va antes: у вас есть…, literalmente «¿junto a ustedes hay…?». El ruso no dispone de un verbo «tener» de uso corriente, así que la existencia se expresa con есть y la persona va precedida de у: у вас есть хлеб, «¿tienen pan?». La respuesta negativa es нет más genitivo — нет хлеба — y esa combinación aparece continuamente.",
      "El segundo punto es una distinción que el español desdibuja. Дорогой y дешёвый son adjetivos y describen un objeto: дорогой телефон, «un teléfono caro». Дорого y дёшево son adverbios impersonales y describen la situación: это дорого, «esto es caro», o simplemente дорого dicho a secas ante un precio. Son formas distintas y no se pueden intercambiar; usar el adjetivo donde toca el adverbio es uno de los errores que más se oyen.",
      "Conviene además tener claras dos palabras que se parecen y no significan lo mismo: магазин es una tienda cualquiera, y рынок es un mercado. Y скидка, «descuento», es de las primeras palabras rentables que uno aprende a reconocer en un escaparate.",
      "En la cuadrícula de abajo solo hay palabras de este tema. A continuación tienes la lista completa del vocabulario de compras, con transcripción, traducción y una frase de ejemplo para cada palabra.",
    ],
  },
];

/** The generic landing embeds this exact puzzle. The themed pages must not
 * embed the same grid, or two indexed pages would show identical content —
 * so the constant lives here and both sides read it. */
export const GENERIC_SOPA_PUZZLE: { type: WordGameType; level: string; sequence: number } = {
  type: "WORD_SEARCH",
  level: "A1",
  sequence: 6,
};

export function getTopicLanding(slug: string): TopicLanding | undefined {
  return TOPIC_LANDINGS.find((l) => l.slug === slug);
}

export function landingPath(landing: TopicLanding): string {
  return `/sopa-de-letras-ruso-${landing.slug}`;
}

/** Every landing path, for sitemap.ts and for the crawlable-surface test. */
export const TOPIC_LANDING_PATHS: string[] = TOPIC_LANDINGS.map(landingPath);
