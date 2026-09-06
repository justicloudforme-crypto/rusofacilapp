import type { IntroIconKey } from "./slideIcons";
import { ALPHABET_PAGE_PATH } from "@/lib/alphabet/cyrillic-alphabet";
import { TELEGRAM_INVITE_URL } from "@/components/TelegramFloatButton";
import type { IntroStats } from "./stats";

/**
 * Contenido de la presentación de Introducción — igual que el contenido de
 * las lecciones (ver src/lib/lessons/content.ts), se escribe siempre en
 * español, sin importar el idioma de la interfaz. Se muestra como una serie
 * de diapositivas en el catálogo de cursos
 * (/[lang]/courses, src/components/intro/IntroPresentation.tsx) y en el PDF
 * descargable (src/lib/intro/pdf.tsx) — un único origen de verdad para
 * ambos. Español neutro para toda Hispanoamérica: sin regionalismos y sin
 * dar por hecho de qué país es quien lee.
 *
 * NINGUNA CIFRA SE ESCRIBE A MANO AQUÍ. Todas las cantidades del producto
 * — lecciones, ejercicios, tarjetas, temas, relatos, medios, modismos,
 * términos de glosario, juegos por tipo, exámenes, letras del alfabeto y la
 * composición exacta de lo gratuito — llegan en `stats`
 * (src/lib/intro/stats.ts), contadas de las mismas fuentes que lee el sitio.
 * `npm run check:intro-numbers` construye estas diapositivas con valores
 * centinela y falla si aparece cualquier dígito que no venga de ahí; la
 * única excepción, anotada en ese guardián, son los 258 millones de
 * hablantes, que son un dato del mundo y no del producto.
 */

export interface IntroSlideLink {
  /** Ruta sin prefijo de idioma (`/alfabeto-cirilico`) o URL completa. */
  href: string;
  label: string;
  external?: boolean;
}

export interface IntroSlide {
  id: string;
  icon: IntroIconKey;
  title: string;
  body: string[];
  /** Optional short bullet list, rendered under `body`. */
  highlights?: string[];
  /** Optional links rendered under the bullets (and printed as plain URLs
   * in the PDF, which cannot be clicked in every reader). */
  links?: IntroSlideLink[];
}

/**
 * The PDF's page count: one cover plus one page per slide.
 *
 * It lives here rather than in ./pdf.tsx because that file is
 * `server-only` and react-pdf, and the e2e spec that asserts the served
 * PDF has exactly this many pages cannot import either — the same reason
 * ./stats.ts is not server-only.
 */
export function introPdfPageCount(slides: readonly IntroSlide[]): number {
  return slides.length + 1;
}

/** Une una lista en español: «a, b y c». */
function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function buildIntroSlides(stats: IntroStats): IntroSlide[] {
  const { bank, free } = stats;
  const traps = list(stats.alphabetTraps);

  // El banco de contenido: una fila por familia, y cada fila desaparece
  // entera si la base de datos no se pudo leer (bank === null). No hay
  // número de reserva escrito aquí: mostrar «0 relatos» sería peor que no
  // decir nada, y una constante de reserva es exactamente el defecto que
  // este módulo existe para quitar (ver el encabezado de ./stats.ts).
  const bankHighlights = bank
    ? [
        `${bank.flashcards} tarjetas de vocabulario en ${stats.flashcardTopics} temas`,
        `${bank.stories} relatos con audio`,
        `${stats.media} videos y canciones, de los cuales ${stats.mediaSongs} son canciones y ${stats.mediaGrammarVideos} explican gramática`,
        `${bank.idioms} modismos y refranes`,
        `${bank.glossaryTerms} términos de glosario gramatical`,
        `${bank.wordSearchPuzzles} sopas de letras y ${bank.crosswordPuzzles} crucigramas`,
      ]
    : [];

  const bankParagraph = bank
    ? `Alrededor del curso está el banco de contenido: ${bank.flashcards} tarjetas de vocabulario repartidas en ${stats.flashcardTopics} temas, ${bank.stories} relatos narrados en voz alta, ${stats.media} videos y canciones con traducción línea por línea, ${bank.idioms} modismos y refranes, ${bank.glossaryTerms} términos de glosario gramatical, ${bank.wordSearchPuzzles} sopas de letras y ${bank.crosswordPuzzles} crucigramas.`
    : null;

  // Las dos cantidades gratuitas que dependen de la base — relatos
  // abiertos y el glosario, que es gratuito entero — se leen de `bank` y
  // desaparecen con él, igual que las filas del banco de arriba.
  const freeItems = [
    `${free.lessons} lecciones completas, la primera de cada nivel`,
    `la explicación de gramática de las ${free.lessonsWithFreeGrammar} lecciones`,
    `${free.flashcards} tarjetas de vocabulario`,
    `${free.idioms} modismos`,
    ...(bank ? [`${bank.freeStories} relatos con su audio`] : []),
    `${free.wordGamePuzzles} juegos de palabras, de los dos tipos y de todos los niveles menos C1`,
    `${free.media} videos y canciones`,
    ...(bank ? [`el glosario completo, ${bank.glossaryTerms} términos`] : []),
    "la página del alfabeto entera",
  ];

  return [
    {
      id: "intro-1-reach",
      icon: "globalReach",
      title: "Un idioma que se habla en medio mundo",
      body: [
        "El ruso lo hablan cerca de 258 millones de personas, entre quienes lo tienen como lengua materna y quienes lo aprendieron después. Es el idioma materno más hablado de toda Europa y uno de los seis idiomas oficiales de la ONU.",
        "Es idioma oficial en cuatro países, y sigue siendo la lengua en la que la gente se entiende en un espacio enorme, del Cáucaso a Asia Central. Aprender ruso es poder hablar con personas de decenas de nacionalidades distintas sin cambiar de idioma.",
      ],
      highlights: [
        "Cerca de 258 millones de hablantes en total",
        "El idioma materno más hablado de Europa",
        "Uno de los seis idiomas oficiales de la ONU",
        "Oficial en cuatro países y de uso corriente del Cáucaso a Asia Central",
      ],
    },
    {
      id: "intro-2-doors",
      icon: "openDoors",
      title: "Qué puertas te abre",
      body: [
        "Los turistas rusoparlantes llegan por miles a México y al Caribe, y casi nadie los atiende en su idioma. En hotelería, turismo, restaurantes y guías de viaje, poder decir «hablo ruso» te pone en una lista muy corta de candidatos.",
        "Fuera del turismo, el ruso abre trabajo remoto y traducción, que no dependen de dónde vivas. Y abre viajes: en buena parte del espacio postsoviético te entienden en ruso, y viajar ahí sale mucho más barato que a Europa occidental.",
        "Está además la razón más simple de todas: es una habilidad rara. En un currículum latinoamericano el inglés se da por hecho y el francés no sorprende a nadie; el ruso casi no aparece nunca.",
      ],
      highlights: [
        "Turismo y hotelería: atender en ruso a quien no encuentra quién lo atienda",
        "Trabajo remoto y traducción, sin depender de dónde vivas",
        "Viajes a donde el ruso se entiende y el costo es bajo",
        "Una habilidad rara: casi no aparece en un currículum de la región",
      ],
    },
    {
      id: "intro-3-easier",
      icon: "easierThanItLooks",
      title: "Es más fácil de lo que parece",
      body: [
        "Empecemos por lo que el ruso no tiene. No hay artículos: ni «el», ni «la», ni «un». Y en presente el verbo «ser» simplemente no se dice — «Я студент» es, palabra por palabra, «yo estudiante», y así la oración ya está completa.",
        "Los tiempos verbales son tres: pasado, presente y futuro. Nada del laberinto de subjuntivos y tiempos compuestos del español. Y se lee casi como se escribe: aprendida la letra, la palabra suena sola.",
        "Lo difícil también se dice de frente. Los casos cambian la terminación de las palabras según su papel en la oración, y el aspecto verbal obliga a elegir entre dos verbos donde el español usa uno solo. No son imposibles: son largos. Por eso el curso los reparte en pasos, un caso a la vez, comparando siempre contra el español.",
      ],
      highlights: [
        "Sin artículos",
        "Sin verbo «ser» en presente",
        "Tres tiempos verbales, y ninguno compuesto",
        "Se lee casi como se escribe",
        "Los casos y el aspecto, repartidos en pasos del curso",
      ],
    },
    {
      id: "intro-4-alphabet",
      icon: "alphabetEvening",
      title: "El alfabeto se aprende en una tarde",
      body: [
        `Son ${stats.alphabetLetters} letras, y no hay que memorizarlas de golpe. Varias se leen igual que en español y se reconocen al instante; otras son griegas que ya conoces de las matemáticas; y solo quedan unas pocas realmente nuevas.`,
        `El trabajo de verdad son las letras que engañan al ojo acostumbrado al alfabeto latino — ${traps} —: unas se leen como otra cosa, otras parecen adornos y no lo son. La «Р» no es «pe», es «erre». La «С» no es «ce», es «ese». Verlas una vez con calma ahorra semanas de leer mal.`,
        "La página del alfabeto está abierta para cualquiera, sin cuenta y sin suscripción: cada letra con su sonido, el sonido español más cercano y una palabra de ejemplo que puedes escuchar.",
      ],
      highlights: [
        `${stats.alphabetLetters} letras, y varias ya las reconoces`,
        `Las letras que engañan al ojo: ${traps}`,
        "Cada letra con su sonido y una palabra de ejemplo",
        "Página abierta gratis, sin cuenta",
      ],
      links: [{ href: ALPHABET_PAGE_PATH, label: "Abrir el alfabeto cirílico" }],
    },
    {
      id: "intro-5-literature",
      icon: "literaryClassics",
      title: "Leer a los clásicos en su idioma",
      body: [
        "Una de las recompensas de aprender ruso — una recompensa del camino, no el requisito para empezar — es poder leer a Dostoievski, Tolstói, Chéjov, Pushkin y Gógol tal como escribieron. Ninguna traducción, por buena que sea, conserva del todo el ritmo y la ironía que el autor eligió palabra por palabra.",
        "Alrededor de esa literatura hay una cultura entera que se disfruta mejor desde adentro: el ballet, el ajedrez, la música clásica de Chaikovski y Rachmáninov, los logros espaciales del siglo XX. Es un patrimonio cultural, y el idioma es su puerta de entrada más directa.",
      ],
      highlights: [
        "Dostoievski, Tolstói, Chéjov, Pushkin, Gógol — en original",
        "Ballet, ajedrez y música clásica",
        "Los logros espaciales del siglo XX",
        "Una recompensa del camino, no la condición para empezar",
      ],
    },
    {
      id: "intro-6-typing",
      icon: "keyboardSetup",
      title: "Cómo escribir en ruso",
      body: [
        "Empieza por el celular, que es donde más vas a escribir. En Android: Ajustes › Sistema › Idiomas › Teclado en pantalla › agregar «Русский». En iPhone: Ajustes › General › Teclado › Teclados › Agregar teclado › Ruso. Después se cambia de idioma con el globo terráqueo que aparece junto a la barra espaciadora.",
        "En la computadora es igual de corto. En Windows: Configuración › Hora e idioma › Idioma y región › Agregar un idioma › «Русский», y se alterna con Windows + Barra espaciadora. En Mac: Ajustes del Sistema › Teclado › Fuentes de entrada › «+» › Russian, y se alterna con Control + Barra espaciadora.",
        "No hace falta comprar nada ni cambiar tu teclado físico. Al principio ayuda tener el teclado en pantalla a la vista; en pocos días los dedos encuentran solos las letras que más usas.",
      ],
      highlights: [
        "Primero el celular: es donde de verdad vas a escribir",
        "Android: Ajustes › Sistema › Idiomas › Teclado en pantalla › Русский",
        "iPhone: Ajustes › General › Teclado › Teclados › Ruso",
        "Windows: Windows + Barra espaciadora · Mac: Control + Barra espaciadora",
      ],
    },
    {
      id: "intro-7-consistency",
      icon: "dailyHabit",
      title: "Quince minutos al día le ganan a tres horas el domingo",
      body: [
        "Un idioma se fija con repetición frecuente, no con esfuerzos aislados. Quince minutos diarios rinden más que una sesión larga una vez por semana — y además se sostienen: casi nadie abandona por quince minutos, mucha gente abandona por tres horas.",
        `La plataforma trae la herramienta para eso. Hay una racha de días con calendario, que marca cada día en que estudiaste algo. Si un día no puedes, la racha no se rompe de inmediato: hay hasta ${stats.streakFreezes} congelaciones que la protegen. Y hay ${stats.badges} insignias que se ganan por constancia, por exámenes aprobados y por vocabulario dominado.`,
      ],
      highlights: [
        "Mejor quince minutos diarios que una maratón semanal",
        "Racha de días, con calendario de lo que ya estudiaste",
        `Hasta ${stats.streakFreezes} congelaciones para el día que no puedas`,
        `${stats.badges} insignias por constancia, exámenes y vocabulario`,
      ],
    },
    {
      id: "intro-8-variety",
      icon: "methodMix",
      title: "Cuando te canses, cambia de formato",
      body: [
        "Cansarse es normal y no significa que el idioma no sea para ti: significa que llevas demasiado rato haciendo lo mismo. La salida no es apretar los dientes, es cambiar de formato y seguir en ruso.",
        "El recorrido natural va así: una lección, luego tarjetas y ejercicio de recuerdo activo, luego un relato narrado en voz alta, luego un video o una canción con traducción línea por línea, y al final un juego de palabras. Cada formato toca el idioma por un lado distinto, y ninguno se parece al anterior.",
      ],
      highlights: [
        "Lección › tarjetas y recuerdo activo",
        "Relato narrado en voz alta, con el texto en ruso y en español",
        "Video o canción con traducción línea por línea",
        "Sopa de letras o crucigrama",
      ],
    },
    {
      id: "intro-9-inside",
      icon: "platformContents",
      title: "Qué hay adentro",
      body: [
        `El curso son ${stats.levels} niveles, ${stats.lessons} lecciones y ${stats.exercises} ejercicios de corrección instantánea, con ${stats.exams} exámenes que cierran cada bloque de lecciones.`,
        ...(bankParagraph ? [bankParagraph] : []),
        "El límite, dicho sin adornos: el curso llega de A1 a B2. El vocabulario, los relatos, los juegos y los materiales de video llegan hasta C1. Una parte de todo esto está abierta gratis y el resto entra con la suscripción — la lista exacta de lo gratuito está en la diapositiva siguiente.",
      ],
      highlights: [
        `${stats.lessons} lecciones en ${stats.levels} niveles, con ${stats.exercises} ejercicios`,
        `${stats.exams} exámenes, uno al final de cada bloque de lecciones`,
        ...bankHighlights,
        "Curso de A1 a B2; vocabulario, relatos, juegos y videos hasta C1",
      ],
    },
    {
      id: "intro-10-first-week",
      icon: "firstWeekPlan",
      title: "Tu primer día y tu primera semana",
      body: [
        "Hoy: la página del alfabeto y la primera lección. Nada más. Con eso ya habrás leído tus primeras palabras en ruso y habrás visto cómo funciona una lección completa, de principio a fin.",
        "Esta semana: dos lecciones, un repaso de tarjetas, un relato con audio y un juego. Cuatro formatos distintos en siete días — suficiente para saber si esto es para ti, y lo bastante liviano para no abandonarlo.",
        "Sin pagar nada, y sin dar una tarjeta, tienes una parte real de cada sección — la lista completa está aquí abajo, punto por punto. Todo lo demás entra con la suscripción.",
        "En Telegram hay un canal y un grupo de la comunidad, por si quieres enterarte de lo nuevo y preguntar dudas. Y ahora, elige tu nivel y empieza.",
      ],
      highlights: [
        "Hoy: el alfabeto y la primera lección",
        "Esta semana: dos lecciones, tarjetas, un relato y un juego",
        ...freeItems.map((item) => `Gratis: ${item}`),
        "Canal y grupo de Telegram para novedades y dudas",
      ],
      links: [
        { href: ALPHABET_PAGE_PATH, label: "Empezar por el alfabeto" },
        { href: TELEGRAM_INVITE_URL, label: "Canal y grupo de Telegram", external: true },
      ],
    },
  ];
}
