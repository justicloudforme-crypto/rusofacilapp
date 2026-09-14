import type { IntroIconKey } from "./slideIcons";
import { ALPHABET_PAGE_PATH } from "@/lib/alphabet/cyrillic-alphabet";
import { TELEGRAM_INVITE_URL } from "@/components/TelegramFloatButton";
import type { IntroStats } from "./stats";
import type { Locale } from "@/i18n/config";

/**
 * Contenido de la presentación de Introducción.
 *
 * ДВЕ ЛОКАЛИ, А НЕ ОДНА — 7.196, часть 4б (решение владельца 14.09.2026).
 *
 * До этой правки колода писалась ТОЛЬКО по-испански, «как и содержимое
 * уроков», и на `/ru/courses` владелец видел русские заголовки раздела и
 * десять испанских слайдов подряд под ними («Un idioma que se habla en
 * medio mundo»). Содержимое УРОКА по-испански — это правило про изучаемый
 * язык: урок учит русскому и объясняет его на языке ученика. Вводная
 * презентация ничему не учит: она рассказывает О ПРОДУКТЕ, и язык у неё
 * обязан быть тот же, на котором человек читает интерфейс.
 *
 * Русская колода — не подстрочник испанской: примеры, в которых
 * по-испански объясняется испанцу («La «Р» no es «pe»»), по-русски
 * бессмысленны, и на их месте стоит то же утверждение, обращённое к
 * русскому читателю. Числа при этом в обеих колодах ОДНИ И ТЕ ЖЕ и обе
 * берут их из `stats`: `npm run check:intro-numbers` теперь гоняется по
 * ОБЕИМ.
 *
 * Испанская колода не тронута ни одним знаком — сличается построчно
 * тестом. Se muestra como una serie
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

export function buildIntroSlides(stats: IntroStats, lang: Locale = "es"): IntroSlide[] {
  return lang === "ru" ? buildIntroSlidesRu(stats) : buildIntroSlidesEs(stats);
}

function buildIntroSlidesEs(stats: IntroStats): IntroSlide[] {
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

/** Соединяет список по-русски: «а, б и в». */
function listRu(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} и ${items[items.length - 1]}`;
}

/**
 * РУССКАЯ КОЛОДА — 7.196, часть 4б.
 *
 * Слайдов столько же, идентификаторы те же (на них стоит навигация и
 * нумерация страниц PDF), значки те же, и КАЖДОЕ ЧИСЛО приходит из
 * `stats` — ровно как в испанской. Единственное число, написанное здесь
 * словами, — 258 миллионов говорящих; это факт о мире, а не о продукте, и
 * он закреплён исключением в `check:intro-numbers`.
 */
function buildIntroSlidesRu(stats: IntroStats): IntroSlide[] {
  const { bank, free } = stats;
  const traps = listRu(stats.alphabetTraps);

  const bankHighlights = bank
    ? [
        `${bank.flashcards} карточек словаря в ${stats.flashcardTopics} темах`,
        `${bank.stories} рассказов с озвучкой`,
        `${stats.media} видео и песен, из них ${stats.mediaSongs} песен и ${stats.mediaGrammarVideos} с разбором грамматики`,
        `${bank.idioms} идиом и пословиц`,
        `${bank.glossaryTerms} терминов грамматического глоссария`,
        `${bank.wordSearchPuzzles} филвордов и ${bank.crosswordPuzzles} кроссвордов`,
      ]
    : [];

  const bankParagraph = bank
    ? `Вокруг курса лежит банк содержимого: ${bank.flashcards} карточек словаря по ${stats.flashcardTopics} темам, ${bank.stories} рассказов, прочитанных вслух, ${stats.media} видео и песен с построчным переводом, ${bank.idioms} идиом и пословиц, ${bank.glossaryTerms} терминов грамматического глоссария, ${bank.wordSearchPuzzles} филвордов и ${bank.crosswordPuzzles} кроссвордов.`
    : null;

  const freeItems = [
    `${free.lessons} полных урока — по первому на каждом уровне`,
    `разбор грамматики во всех ${free.lessonsWithFreeGrammar} уроках`,
    `${free.flashcards} карточек словаря`,
    `${free.idioms} идиом`,
    ...(bank ? [`${bank.freeStories} рассказов вместе с озвучкой`] : []),
    `${free.wordGamePuzzles} игр со словами — обоих видов и на всех уровнях, кроме C1`,
    `${free.media} видео и песен`,
    ...(bank ? [`весь глоссарий целиком, ${bank.glossaryTerms} терминов`] : []),
    "вся страница алфавита",
  ];

  return [
    {
      id: "intro-1-reach",
      icon: "globalReach",
      title: "Язык, на котором говорит полмира",
      body: [
        "По-русски говорят около 258 миллионов человек — и те, для кого он родной, и те, кто выучил его позже. Это самый распространённый родной язык Европы и один из шести официальных языков ООН.",
        "Он официальный в четырёх странах и остаётся языком, на котором люди понимают друг друга на огромном пространстве — от Кавказа до Средней Азии. Знать русский значит говорить с людьми десятков разных национальностей, не меняя языка.",
      ],
      highlights: [
        "Около 258 миллионов говорящих",
        "Самый распространённый родной язык Европы",
        "Один из шести официальных языков ООН",
        "Официальный в четырёх странах и в ходу от Кавказа до Средней Азии",
      ],
    },
    {
      id: "intro-2-doors",
      icon: "openDoors",
      title: "Какие двери он открывает",
      body: [
        "Русскоговорящие туристы приезжают в Мексику и на Карибы тысячами, и обслужить их на родном языке почти некому. В гостиницах, туризме, ресторанах и работе гида слова «я говорю по-русски» ставят человека в очень короткий список кандидатов.",
        "Кроме туризма русский открывает удалённую работу и перевод — то, что не зависит от места жительства. И открывает поездки: на большей части постсоветского пространства по-русски понимают, а ездить туда заметно дешевле, чем в Западную Европу.",
        "И есть самая простая причина: это редкий навык. В латиноамериканском резюме английский подразумевается сам собой, французским никого не удивишь, а русский почти не встречается вовсе.",
      ],
      highlights: [
        "Туризм и гостиницы: говорить с теми, кому больше не с кем",
        "Удалённая работа и перевод, не привязанные к месту",
        "Поездки туда, где понимают по-русски и где дешевле",
        "Редкий навык: в резюме региона он почти не встречается",
      ],
    },
    {
      id: "intro-3-easier",
      icon: "easierThanItLooks",
      title: "Он проще, чем кажется со стороны",
      body: [
        "Начнём с того, чего в русском НЕТ. Нет артиклей — ни «el», ни «la», ни «un». И глагол «быть» в настоящем времени просто не произносится: «Я студент» — это дословно «yo estudiante», и предложение уже закончено.",
        "Времён три: прошедшее, настоящее и будущее. Никакого лабиринта из сослагательных и составных времён, привычного испанскому. И читается почти как пишется: выучил букву — слово звучит само.",
        "О трудном говорится прямо. Падежи меняют окончание слова в зависимости от его роли в предложении, а вид глагола заставляет выбирать между двумя словами там, где в испанском одно. Это не непосильно — это долго. Поэтому курс раздаёт их по шагам, по одному падежу за раз, и всегда в сравнении с испанским.",
      ],
      highlights: [
        "Без артиклей",
        "Без глагола «быть» в настоящем времени",
        "Три времени, и ни одного составного",
        "Читается почти как пишется",
        "Падежи и вид глагола разложены по шагам курса",
      ],
    },
    {
      id: "intro-4-alphabet",
      icon: "alphabetEvening",
      title: "Алфавит выучивается за вечер",
      body: [
        `Букв ${stats.alphabetLetters}, и запоминать их разом не нужно. Часть читается так же, как в латинице, и узнаётся мгновенно; часть — греческие, знакомые по математике; по-настоящему новых остаётся немного.`,
        `Настоящая работа — буквы, которые обманывают глаз, привыкший к латинице: ${traps}. Одни читаются не так, как выглядят, другие кажутся украшением, а украшением не являются. Посмотреть на них один раз спокойно — значит сэкономить недели чтения вслепую.`,
        "Страница алфавита открыта любому — без учётной записи и без подписки: каждая буква со своим звуком, ближайшим испанским звуком и словом-примером, которое можно послушать.",
      ],
      highlights: [
        `${stats.alphabetLetters} букв, и часть из них уже узнаётся`,
        `Буквы, обманывающие глаз: ${traps}`,
        "Каждая буква со звуком и словом-примером",
        "Страница открыта бесплатно, без учётной записи",
      ],
      links: [{ href: ALPHABET_PAGE_PATH, label: "Открыть кириллический алфавит" }],
    },
    {
      id: "intro-5-literature",
      icon: "literaryClassics",
      title: "Читать классику на её языке",
      body: [
        "Одна из наград за русский — награда пути, а не условие старта — это возможность читать Достоевского, Толстого, Чехова, Пушкина и Гоголя так, как они написали. Ни один перевод, каким бы хорошим он ни был, не сохраняет целиком ритм и иронию, выбранные автором слово за словом.",
        "Вокруг этой литературы лежит целая культура, которая изнутри понятнее: балет, шахматы, музыка Чайковского и Рахманинова, космические достижения прошлого века. Это культурное наследие, и язык — самый прямой вход в него.",
      ],
      highlights: [
        "Достоевский, Толстой, Чехов, Пушкин, Гоголь — в оригинале",
        "Балет, шахматы и классическая музыка",
        "Космические достижения прошлого века",
        "Награда пути, а не условие, чтобы начать",
      ],
    },
    {
      id: "intro-6-typing",
      icon: "keyboardSetup",
      title: "Как печатать по-русски",
      body: [
        "Начните с телефона — писать вы будете в основном там. Android: Настройки › Система › Языки › Экранная клавиатура › добавить «Русский». iPhone: Настройки › Основные › Клавиатура › Клавиатуры › Новые клавиатуры › Русская. Дальше язык переключается глобусом рядом с пробелом.",
        "На компьютере так же коротко. Windows: Параметры › Время и язык › Язык и регион › Добавить язык › «Русский», переключение — Windows и пробел. Mac: Системные настройки › Клавиатура › Источники ввода › «+» › Russian, переключение — Control и пробел.",
        "Покупать ничего не нужно, менять физическую клавиатуру тоже. Поначалу помогает держать экранную клавиатуру на виду; за несколько дней пальцы сами находят те буквы, которые вы набираете чаще всего.",
      ],
      highlights: [
        "Сначала телефон: писать вы будете там",
        "Android: Настройки › Система › Языки › Экранная клавиатура › Русский",
        "iPhone: Настройки › Основные › Клавиатура › Клавиатуры › Русская",
        "Windows: Windows и пробел · Mac: Control и пробел",
      ],
    },
    {
      id: "intro-7-consistency",
      icon: "dailyHabit",
      title: "Пятнадцать минут в день сильнее трёх часов в воскресенье",
      body: [
        "Язык закрепляется частым повторением, а не отдельными подвигами. Пятнадцать минут каждый день дают больше, чем одно длинное занятие раз в неделю, — и держатся дольше: из-за пятнадцати минут почти никто не бросает, из-за трёх часов бросают многие.",
        `Средство для этого в приложении есть. Есть серия дней с календарём, отмечающая каждый день, в который вы чем-то занимались. Если день не получился, серия не рвётся сразу: её защищают до ${stats.streakFreezes} заморозок. И есть ${stats.badges} значков — за постоянство, за сданные экзамены и за освоенные слова.`,
      ],
      highlights: [
        "Лучше пятнадцать минут ежедневно, чем марафон раз в неделю",
        "Серия дней с календарём того, что уже пройдено",
        `До ${stats.streakFreezes} заморозок на день, который не получился`,
        `${stats.badges} значков за постоянство, экзамены и словарь`,
      ],
    },
    {
      id: "intro-8-variety",
      icon: "methodMix",
      title: "Устали — смените формат",
      body: [
        "Уставать нормально, и это не значит, что язык вам не даётся: это значит, что вы слишком долго делаете одно и то же. Выход не в том, чтобы стиснуть зубы, а в том, чтобы сменить формат и остаться в русском.",
        "Естественный порядок такой: урок, потом карточки и упражнение на активное припоминание, потом рассказ, прочитанный вслух, потом видео или песня с построчным переводом, и напоследок игра со словами. Каждый формат берёт язык с другой стороны, и ни один не похож на предыдущий.",
      ],
      highlights: [
        "Урок › карточки и активное припоминание",
        "Рассказ вслух, с текстом по-русски и по-испански",
        "Видео или песня с построчным переводом",
        "Филворд или кроссворд",
      ],
    },
    {
      id: "intro-9-inside",
      icon: "platformContents",
      title: "Что внутри",
      body: [
        `Курс — это ${stats.levels} уровней, ${stats.lessons} уроков и ${stats.exercises} упражнений с мгновенной проверкой, плюс ${stats.exams} экзаменов, закрывающих каждый блок уроков.`,
        ...(bankParagraph ? [bankParagraph] : []),
        "Граница, названная без украшений: курс идёт от A1 до B2. Словарь, рассказы, игры и видео доходят до C1. Часть всего этого открыта бесплатно, остальное входит в подписку — точный список бесплатного на следующем слайде.",
      ],
      highlights: [
        `${stats.lessons} уроков на ${stats.levels} уровнях, с ${stats.exercises} упражнениями`,
        `${stats.exams} экзаменов — по одному в конце каждого блока уроков`,
        ...bankHighlights,
        "Курс A1–B2; словарь, рассказы, игры и видео — до C1",
      ],
    },
    {
      id: "intro-10-first-week",
      icon: "firstWeekPlan",
      title: "Ваш первый день и первая неделя",
      body: [
        "Сегодня: страница алфавита и первый урок. Больше ничего. Этого хватит, чтобы прочитать первые русские слова и увидеть, как устроен урок целиком, от начала до конца.",
        "На этой неделе: два урока, повторение карточек, рассказ с озвучкой и игра. Четыре разных формата за семь дней — достаточно, чтобы понять, ваше это или нет, и достаточно легко, чтобы не бросить.",
        "Ничего не оплачивая и не давая карту, вы получаете настоящую часть каждого раздела — полный список ниже, по пунктам. Всё остальное входит в подписку.",
        "В Telegram есть канал и группа сообщества — если хотите узнавать о новом и задавать вопросы. А теперь выберите уровень и начинайте.",
      ],
      highlights: [
        "Сегодня: алфавит и первый урок",
        "На этой неделе: два урока, карточки, рассказ и игра",
        ...freeItems.map((item) => `Бесплатно: ${item}`),
        "Канал и группа в Telegram — новости и вопросы",
      ],
      links: [
        { href: ALPHABET_PAGE_PATH, label: "Начать с алфавита" },
        { href: TELEGRAM_INVITE_URL, label: "Канал и группа в Telegram", external: true },
      ],
    },
  ];
}
