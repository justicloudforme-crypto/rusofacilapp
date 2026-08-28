import type { FlashcardCategory } from "@/lib/flashcards/types";

/**
 * The 23 public vocabulary pages under /es/vocabulary/[categoria].
 *
 * Why these exist. Measured 28.08.2026: the whole card bank — 5683 cards
 * with translation, transcription and an example sentence — was invisible
 * to search. /vocabulary is a single client-rendered page (1174 characters
 * of visible text, not one Russian word in the served HTML) and
 * GET /api/flashcards hands an anonymous visitor 10 sample cards. Two URLs
 * in the sitemap for the largest body of content on the site.
 *
 * Why by category and not by word. A page per word would carry a median of
 * 98 characters of its own text inside ~800 characters of page chrome —
 * thinner than the thinnest glossary entry (778) — multiplied by 11,366
 * URLs against a sitemap of 1868. Rejected with the arithmetic in
 * PROGRESS.md. A page per category is the same content at 23 URLs and
 * ~25,000 characters each, which is the shape /es/glossary already proves
 * works.
 *
 * Two rules this file exists to enforce:
 *
 *  1. **C1 never appears.** Cards at C1 (898 of them) stay behind the
 *     paywall in full, the same principle as the free word-game tier. The
 *     filter is applied server-side before render, so C1 words are
 *     physically absent from the HTML rather than hidden with CSS.
 *  2. **No templated intro.** Every category gets its own 150–250 words
 *     about what is actually hard in THAT vocabulary — the в/на split for
 *     the city, играть в vs заниматься for sport, надеть vs одеть for
 *     clothes. A paragraph with the category name substituted into a
 *     shared sentence would recreate, at smaller scale, exactly the thin
 *     page problem these pages are meant to fix.
 *
 * Deliberately NOT here: links to glossary terms or lessons. FlashcardCard
 * carries no reference to either (see prisma/schema.prisma — category,
 * level and the text fields, nothing else), so any per-category mapping
 * would be invented rather than derived. Left empty on purpose; the pages
 * link to the glossary and course indexes as navigation, which claims no
 * relationship that isn't there.
 */
export interface VocabularyCategoryPage {
  category: FlashcardCategory;
  /** URL segment, in the wording a Spanish speaker would search for
   * rather than the internal category key. */
  slug: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  /** 150–250 words, hand-written per category. */
  intro: string[];
}

export const VOCABULARY_CATEGORY_PAGES: VocabularyCategoryPage[] = [
  {
    category: "food",
    slug: "comida",
    h1: "Vocabulario ruso de comida y restaurante",
    metaTitle: "Vocabulario ruso de comida: lista de palabras con traducción | RusoFácilapp",
    metaDescription:
      "Lista de palabras rusas de comida, bebida y restaurante, cada una con transcripción, traducción al español y una frase de ejemplo. Niveles A1 a B2.",
    intro: [
      "La comida es de los primeros campos que se estudian y también uno de los que más rápido se usan de verdad, porque es donde vas a necesitar hablar el primer día que pises un país ruso. La buena noticia es que muchas palabras son cortas y frecuentes; la mala es que casi ninguna se parece al español, así que aquí no hay atajo de cognados como en tecnología o ciencia.",
      "Lo que más cuesta no es memorizar los sustantivos, sino lo que les pasa cuando los usas. En cuanto pides una cantidad, la palabra cambia de forma: se dice кусок хлеба, «un trozo de pan», con хлеб en genitivo, y много воды, «mucha agua». Es un reflejo constante y conviene aprender cada alimento ya dentro de una frase de cantidad, no suelto. Añade a eso que el acento se mueve dentro de la misma palabra — вода lleva el acento al final, pero воду lo lleva al principio — y que el género no se adivina por el significado: молоко y мясо son neutros, соль es femenino aunque acabe en consonante.",
      "Por eso cada palabra de esta lista viene con su frase de ejemplo: es más útil recordar «yo como pan todos los días» que la palabra «pan» aislada.",
    ],
  },
  {
    category: "shopping",
    slug: "compras",
    h1: "Vocabulario ruso de compras y precios",
    metaTitle: "Vocabulario ruso de compras y precios: palabras con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas para comprar, preguntar precios y pagar, con transcripción, traducción al español y frase de ejemplo. Niveles A1 a B2.",
    intro: [
      "Comprar algo en ruso es una de las pocas situaciones en las que un principiante puede salir adelante con muy pocas palabras, siempre que sepan combinarse. Con сколько стоит, «cuánto cuesta», y el nombre del objeto ya resuelves media conversación, y por eso este bloque aparece muy pronto en cualquier curso.",
      "La dificultad real de este campo son los números, y no por memorizarlos. En ruso el sustantivo cambia según el número que lo acompaña: se dice один рубль, después два рубля y a partir de cinco пять рублей. Son tres formas distintas de la misma palabra, y el sistema se repite con todo lo que se cuenta, así que un precio dicho a velocidad normal es difícil de descifrar hasta que el patrón se automatiza. Merece la pena practicarlo en voz alta con cantidades reales.",
      "El segundo punto es el par de verbos покупать y купить. Significan lo mismo, «comprar», pero el primero describe la acción como proceso o costumbre y el segundo como hecho terminado. Elegir mal no impide que te entiendan, pero suena raro, y es una de las distinciones que el español simplemente no marca con dos verbos distintos.",
    ],
  },
  {
    category: "city",
    slug: "ciudad-y-transporte",
    h1: "Vocabulario ruso de la ciudad y el transporte",
    metaTitle: "Vocabulario ruso de ciudad y transporte: lista con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas de la ciudad, calles, edificios y transporte público, con transcripción, traducción al español y ejemplo. Niveles A1 a B2.",
    intro: [
      "Este es el vocabulario que convierte un mapa en algo utilizable: calles, paradas, edificios, medios de transporte. Es también el campo donde antes se choca con una particularidad rusa que el español no tiene, así que conviene saberlo desde el principio en vez de descubrirlo por acumulación de correcciones.",
      "Para decir dónde está algo, el ruso usa dos preposiciones distintas, в y на, y la elección no siempre es lógica: se dice в городе, «en la ciudad», pero на улице, «en la calle», y на вокзале, «en la estación». No hay una regla que cubra todos los casos; hay grupos de palabras que piden на por tradición, y lo práctico es aprender la preposición pegada al sustantivo, como si fuera parte de la palabra. Además, ambas exigen que el sustantivo cambie de terminación, así que город se convierte en городе.",
      "El otro punto es que moverse por la ciudad se dice con verbos que distinguen si vas a pie o en vehículo: идти frente a ехать. Ese contraste no existe en español, donde «ir» sirve para las dos cosas, y es de los errores que más delatan a un extranjero.",
    ],
  },
  {
    category: "work",
    slug: "trabajo",
    h1: "Vocabulario ruso de trabajo y estudios",
    metaTitle: "Vocabulario ruso de trabajo y estudios: palabras con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas de profesiones, oficina, estudios y búsqueda de empleo, con transcripción, traducción y ejemplo. Niveles A1 a B2.",
    intro: [
      "Aquí entran las profesiones, la oficina, la universidad y todo lo que rodea a buscar y tener un empleo. Es un campo de nivel intermedio: aparecen algunas palabras en A1, pero la mayor parte se concentra en B1 y B2, cuando ya puedes construir frases largas.",
      "La construcción clave es corta y hay que aprenderla entera. Para decir a qué te dedicas, el ruso no usa el equivalente de «soy médico» sino работать врачом, literalmente «trabajar de médico», con la profesión en instrumental — un caso que el español no tiene y que aquí es obligatorio. Es un patrón muy rentable: se aplica a cualquier profesión de la lista sin excepción.",
      "El segundo detalle es la familia de verbos que describen entrar y salir de un empleo, y la trampa está en tres letras. Устроиться на работу es lo que hace el candidato; увольняться, con -ся, es irse uno mismo; y уволить, sin -ся, es despedir a otra persona. El postfijo cambia quién actúa sobre quién, y confundirlo puede dar a entender lo contrario de lo que quieres decir. Muchas profesiones tienen además forma masculina y femenina, y no todas se usan igual en la lengua real.",
    ],
  },
  {
    category: "family",
    slug: "familia",
    h1: "Vocabulario ruso de familia y hogar",
    metaTitle: "Vocabulario ruso de familia y casa: lista con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas de familia, parentesco y casa, con transcripción, traducción al español y frase de ejemplo. Niveles A1 a B2.",
    intro: [
      "La familia y la casa son el campo con el que casi todo el mundo empieza a hablar de sí mismo, y por eso conviene tenerlo sólido antes que otros más vistosos. Los nombres de parentesco son palabras cortas y muy frecuentes, así que se fijan rápido si se practican con frases reales.",
      "Lo primero que sorprende es cómo se dice tener. El ruso no usa un verbo equivalente a «tener» en la lengua cotidiana: dice у меня есть брат, literalmente «junto a mí hay un hermano». La persona va en genitivo y lo poseído en nominativo, es decir, justo al revés de lo que espera un hispanohablante. Es una construcción de rendimiento altísimo, porque sirve para hablar de familia, de objetos y de casi todo lo demás.",
      "El segundo escollo son los plurales irregulares, que en este campo se concentran: брат hace братья, сестра hace сёстры, сын hace сыновья, y no se deducen de la forma del singular. Y una nota cultural útil: мама y папа no son infantiles como podría parecer por su forma, son las palabras normales que un adulto ruso usa para hablar de sus padres.",
    ],
  },
  {
    category: "health",
    slug: "salud",
    h1: "Vocabulario ruso de salud y cuerpo",
    metaTitle: "Vocabulario ruso de salud y partes del cuerpo | RusoFácilapp",
    metaDescription:
      "Palabras rusas de salud, síntomas, médico y partes del cuerpo, con transcripción, traducción y ejemplo. Niveles A1 a B2.",
    intro: [
      "Este bloque cubre el cuerpo, los síntomas, la farmacia y la consulta médica. Es vocabulario que se estudia sin urgencia y luego se necesita de golpe, así que vale la pena tenerlo aunque no se practique a diario.",
      "La construcción central es distinta de la española y hay que darle la vuelta mentalmente. Para decir que algo te duele, el ruso dice у меня болит голова: la parte del cuerpo es el sujeto y es ella la que «duele», mientras que la persona va en genitivo. En español el sujeto suele ser la persona, y esa inversión es la fuente principal de errores en este campo. Como el sujeto es la parte del cuerpo, el verbo concuerda con ella, y en plural cambia: у меня болят ноги.",
      "Además, las partes del cuerpo acumulan plurales que no se deducen del singular: глаз hace глаза, ухо hace уши, рука hace руки con desplazamiento del acento. Son pocas palabras y muy frecuentes, así que compensa aprenderse el plural desde el primer día en lugar de tratarlo como una excepción que ya se verá más adelante.",
    ],
  },
  {
    category: "feelings",
    slug: "emociones",
    h1: "Vocabulario ruso de sentimientos y emociones",
    metaTitle: "Vocabulario ruso de emociones y sentimientos | RusoFácilapp",
    metaDescription:
      "Palabras rusas para hablar de emociones, estados de ánimo y carácter, con transcripción, traducción y ejemplo. Niveles A1 a B2.",
    intro: [
      "Hablar de cómo te sientes es lo que separa decir frases correctas de mantener una conversación. Este campo se concentra en B1 y B2 por una razón: las emociones se expresan en ruso con estructuras que no son las que un principiante ha aprendido.",
      "La más importante es la construcción impersonal con dativo. Para decir «estoy triste» el ruso dice мне грустно, literalmente «a mí tristemente»: no hay sujeto ni verbo «estar», solo la persona en dativo y una palabra invariable. El patrón se repite con casi todos los estados: мне холодно, мне скучно, мне стыдно. Cuesta al principio porque obliga a abandonar el esquema sujeto + verbo, pero después es el molde más cómodo que existe para hablar de uno mismo.",
      "El segundo punto es нравиться, el equivalente de «gustar», que se construye igual que en español: lo que gusta es el sujeto y la persona va en dativo, мне нравится эта книга. Es una coincidencia afortunada y conviene aprovecharla, porque la estructura ya la usas sin pensar. Muchos adjetivos de carácter, además, tienen forma corta y forma larga, y no siempre son intercambiables.",
    ],
  },
  {
    category: "motionVerbs",
    slug: "verbos-de-movimiento",
    h1: "Verbos de movimiento en ruso: lista de palabras",
    metaTitle: "Verbos de movimiento en ruso: lista con traducción y ejemplos | RusoFácilapp",
    metaDescription:
      "Lista de verbos de movimiento rusos con transcripción, traducción al español y frase de ejemplo: идти, ходить, ехать, ездить y sus derivados. A1 a B2.",
    intro: [
      "Los verbos de movimiento tienen fama de ser lo más difícil del ruso para un hispanohablante, y la fama es merecida, pero no por la cantidad de palabras: son pocas raíces. La dificultad es que cada una viene en pareja y hay que elegir cuál usar en cada frase.",
      "Идти y ходить significan las dos «ir a pie». La diferencia es la dirección: идти describe un trayecto concreto en marcha hacia un sitio, y ходить, un movimiento repetido o sin dirección única. Я иду в школу es «voy a la escuela ahora»; я хожу в школу es «voy a la escuela habitualmente». El español resuelve esa diferencia con el tiempo verbal o con un adverbio, no con dos verbos distintos, así que la distinción hay que construirla desde cero. Lo mismo ocurre con ехать y ездить para el movimiento en vehículo, y con бежать y бегать, лететь y летать.",
      "Encima, cada verbo admite prefijos que cambian a la vez el aspecto y el significado: de идти salen прийти, уйти, войти, выйти, перейти. Por eso esta lista es larga aunque las raíces sean pocas, y por eso cada palabra viene con una frase donde se ve la dirección.",
    ],
  },
  {
    category: "greetings",
    slug: "saludos",
    h1: "Saludos y presentaciones en ruso",
    metaTitle: "Saludos en ruso: palabras y frases con traducción | RusoFácilapp",
    metaDescription:
      "Lista de palabras y frases para saludar, despedirse y presentarse en ruso, con transcripción, traducción al español y ejemplo. Niveles A1 a B2.",
    intro: [
      "Son las primeras palabras que se aprenden y también las que más rápido delatan si alguien ha estudiado ruso de verdad o solo se sabe una lista. El problema no es la pronunciación de здравствуйте, aunque asuste; es saber cuándo usarla.",
      "El ruso distingue de forma estricta entre tratamiento formal e informal, y esa elección afecta a casi todo lo que digas después: al pronombre, a la terminación del verbo y al saludo mismo. Привет y ты valen entre amigos, compañeros de edad parecida y familia; здравствуйте y вы son lo que corresponde con desconocidos, con alguien mayor y en cualquier contexto profesional. Equivocarse hacia el lado informal se percibe como brusquedad, no como cercanía, y es un error que un hispanohablante comete con facilidad porque en español el tuteo se ha extendido mucho más.",
      "Añade otro rasgo sin equivalente: en situaciones formales a una persona se la llama por nombre y patronímico, no por el apellido ni por señor más apellido. El patronímico se forma a partir del nombre del padre, y usarlo bien es una de las señales más claras de que sabes moverte en la lengua.",
    ],
  },
  {
    category: "technology",
    slug: "tecnologia",
    h1: "Vocabulario ruso de tecnología e internet",
    metaTitle: "Vocabulario ruso de tecnología e internet | RusoFácilapp",
    metaDescription:
      "Palabras rusas de ordenadores, móviles e internet, con transcripción, traducción al español y frase de ejemplo. Niveles A1 a B2.",
    intro: [
      "Este es, con diferencia, el campo más fácil de la lista, y conviene aprovecharlo cuando el estudio se hace cuesta arriba. Casi todo el vocabulario técnico ruso viene del inglés y llega al español por el mismo camino, así que компьютер, интернет o файл se reconocen sin traducción.",
      "La trampa es justamente esa comodidad. Una palabra prestada, al entrar en ruso, se somete a la gramática rusa entera: recibe género, se declina y cambia de terminación como cualquier otra. Компьютер es masculino y hace на компьютере cuando dices dónde está algo; интернет se comporta igual. Reconocer la palabra escrita no basta para usarla en una frase, y ese salto es el trabajo real de este bloque.",
      "El segundo punto es el acento, que casi nunca cae donde lo pondría un hispanohablante por analogía con su propio idioma, y en ruso el acento no se escribe. Y hay un grupo interesante de verbos formados sobre raíces prestadas con morfología rusa nativa, como скачать, «descargar», o кликнуть, «hacer clic»: se conjugan como verbos rusos normales y son la prueba de que el préstamo ya está plenamente integrado.",
    ],
  },
  {
    category: "travel",
    slug: "viajes",
    h1: "Vocabulario ruso de viajes y hoteles",
    metaTitle: "Vocabulario ruso de viajes y hoteles: lista con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas de viaje, aeropuerto, hotel y reservas, con transcripción, traducción al español y ejemplo. Niveles A1 a B2.",
    intro: [
      "Viajar es la situación que más rápido obliga a usar el idioma bajo presión: billetes, horarios, documentos, hotel. Es un campo grande y con mucho peso en B1, porque exige combinar sustantivos con verbos de movimiento y con preposiciones.",
      "El punto que más se atasca es cómo decir a dónde vas. En ruso hay dos preposiciones para eso, в y на, y la elección depende de la palabra: se dice в Москву pero на вокзал, в гостиницу pero на самолёте. Los países y las ciudades llevan в casi siempre; las estaciones, los aeropuertos y algunas islas y regiones piden на por costumbre. No se puede deducir, así que hay que aprender la preposición junto al sustantivo desde la primera vez.",
      "Después está la elección del verbo. Ехать sirve para el transporte terrestre, лететь para el avión y плыть para el barco, y el ruso los distingue donde el español usa simplemente «ir». Cada uno tiene además su pareja de movimiento repetido, y con prefijos aparecen приехать, «llegar», y уехать, «marcharse», que son las dos palabras que de verdad necesitas para contar un viaje ya hecho.",
    ],
  },
  {
    category: "weather",
    slug: "clima-y-naturaleza",
    h1: "Vocabulario ruso del tiempo y la naturaleza",
    metaTitle: "Vocabulario ruso del clima y la naturaleza | RusoFácilapp",
    metaDescription:
      "Palabras rusas del tiempo atmosférico, estaciones y naturaleza, con transcripción, traducción y frase de ejemplo. Niveles A1 a B2.",
    intro: [
      "El tiempo es el tema de conversación universal y en ruso, además, uno de los que más pronto se pueden manejar bien, porque las frases básicas son cortas y muy repetitivas. Es un buen campo para empezar a hablar sin construir oraciones complicadas.",
      "Su rasgo característico es que casi todo se dice sin sujeto. Para «hace frío» el ruso dice холодно, una sola palabra invariable, y si quieres añadir a quién le hace frío se pone en dativo: мне холодно. Estas construcciones impersonales son la norma aquí, no una excepción, y suponen un cambio de esquema para quien viene del español, donde siempre hay un verbo conjugado y a menudo un sujeto explícito.",
      "Un detalle bonito y muy rentable: para decir «en invierno» o «en verano» no hace falta preposición, basta con poner la estación en instrumental — зимой, летом, весной, осенью. Son cuatro palabras que funcionan como adverbios y que aparecen constantemente. Y ojo con la nieve y la lluvia, que en ruso «van» en lugar de «caer»: идёт снег, идёт дождь, con el mismo verbo que se usa para caminar.",
    ],
  },
  {
    category: "clothing",
    slug: "ropa",
    h1: "Vocabulario ruso de ropa y apariencia",
    metaTitle: "Vocabulario ruso de ropa: lista de palabras con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas de ropa, calzado y descripción física, con transcripción, traducción al español y ejemplo. Niveles A1 a B2.",
    intro: [
      "La ropa es un campo agradecido para practicar adjetivos, porque cada prenda pide un color, una talla o una valoración, y así se ejercita la concordancia sin que resulte un ejercicio de gramática. La mayor parte del vocabulario está en A2 y B1.",
      "El obstáculo específico de este bloque es un par de verbos que confunde incluso a hablantes nativos: надеть y одеть. Надеть es ponerse una prenda, y lo que va detrás es la ropa; одеть es vestir a alguien, y lo que va detrás es la persona. Se dice надеть пальто, «ponerse el abrigo», pero одеть ребёнка, «vestir al niño». En español el mismo verbo «vestir» cubre las dos cosas con un pronombre, así que la distinción hay que aprenderla explícitamente.",
      "El segundo punto es que llevar puesta una prenda se dice con la preposición в más prepositional: она в красном платье, «ella lleva un vestido rojo», literalmente «ella en vestido rojo», sin verbo. Y los colores, como todos los adjetivos rusos, cambian de terminación según el género y el número del sustantivo, así que красный, красная y красное son la misma palabra.",
    ],
  },
  {
    category: "art",
    slug: "arte-y-ocio",
    h1: "Vocabulario ruso de arte y tiempo libre",
    metaTitle: "Vocabulario ruso de arte, cultura y ocio | RusoFácilapp",
    metaDescription:
      "Palabras rusas de arte, música, literatura, cine y tiempo libre, con transcripción, traducción y ejemplo. Niveles A1 a B2.",
    intro: [
      "Arte y ocio es el campo donde el vocabulario deja de ser utilitario y empieza a servir para tener opiniones. Concentra mucho material en B1, y es el puente natural hacia leer y ver cosas en ruso en lugar de solo estudiarlo.",
      "La construcción que hay que dominar aquí es заниматься más instrumental, que sirve para decir a qué actividad te dedicas: заниматься музыкой, заниматься спортом, заниматься живописью. El verbo lleva -ся y el nombre de la actividad cambia de terminación. No tiene equivalente directo en español, donde se dice «tocar música» o «hacer deporte» con verbos distintos según el caso, y aprender el molde ruso ahorra tener que memorizar un verbo para cada afición.",
      "El otro patrón muy visible es el genitivo de autoría: para «una novela de Tolstói» se dice роман Толстого, poniendo el nombre propio en genitivo, sin preposición ninguna. Aparece constantemente al hablar de libros, cuadros y películas, y también obliga a declinar apellidos, que en ruso se declinan como cualquier otra palabra. Varios sustantivos de este campo son cultismos de origen internacional y se reconocen fácilmente, aunque el acento rara vez cae donde uno esperaría.",
    ],
  },
  {
    category: "society",
    slug: "sociedad",
    h1: "Vocabulario ruso de sociedad y noticias",
    metaTitle: "Vocabulario ruso de sociedad y noticias | RusoFácilapp",
    metaDescription:
      "Palabras rusas para leer noticias y hablar de temas sociales, con transcripción, traducción al español y ejemplo. Niveles A1 a B2.",
    intro: [
      "Este bloque es el que permite pasar de las conversaciones cotidianas a leer un periódico. Casi todo su contenido está en B1 y B2, y no por capricho: son palabras largas, abstractas y con una gramática asociada que un principiante todavía no maneja.",
      "El rasgo dominante son los sustantivos derivados. En ruso, los conceptos sociales se forman con sufijos regulares a partir de adjetivos y verbos, y cada sufijo trae su género: las palabras en -ость son siempre femeninas, y las palabras en -ение son siempre neutras. Reconocer esos finales es un atajo enorme, porque te da el género y a menudo el significado aproximado sin haber visto nunca la palabra.",
      "El segundo rasgo es de registro. La prensa rusa usa mucho la construcción pasiva con -ся, del tipo проблема обсуждается, «el problema se discute», que evita decir quién hace la acción — igual que el «se» impersonal español, con la diferencia de que aquí va pegado al verbo. También abundan las cadenas de genitivos encadenados, muy características del estilo informativo. Si el objetivo es leer noticias, este campo rinde más practicado con textos reales que con tarjetas sueltas.",
    ],
  },
  {
    category: "abstract",
    slug: "conceptos-abstractos",
    h1: "Vocabulario ruso de conceptos abstractos",
    metaTitle: "Vocabulario ruso de conceptos abstractos con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas abstractas — ideas, cualidades y nociones generales — con transcripción, traducción y frase de ejemplo. Niveles A1 a B2.",
    intro: [
      "Las palabras abstractas son las últimas que se aprenden y las primeras que se olvidan, porque no hay nada que señalar con el dedo. Por eso este bloque es de los más pequeños de la lista y se concentra casi entero en B1 y B2, cuando ya hay gramática suficiente para usarlas en frases con sentido.",
      "La ventaja es que casi todas están construidas con las mismas piezas. El sufijo -ость convierte un adjetivo en el nombre de su cualidad y produce siempre palabras femeninas: de una raíz que significa «libre» sale la palabra para «libertad». El sufijo -ство forma nombres neutros de estado o condición, y -ение, también neutro, convierte un verbo en el nombre de su acción. Conocer estas tres terminaciones permite deducir el género y el sentido general de cientos de palabras que aún no has visto.",
      "El consejo práctico es no aprenderlas sueltas. Una palabra abstracta se retiene por la compañía que lleva — el verbo con el que suele aparecer, la preposición que le sigue — y no por su traducción aislada, que a menudo es aproximada. Por eso cada entrada de esta lista incluye una frase completa donde se ve el uso real.",
    ],
  },
  {
    category: "connectors",
    slug: "palabras-basicas",
    h1: "Palabras básicas del ruso: pronombres, preposiciones y conectores",
    metaTitle: "Palabras básicas en ruso: pronombres, preposiciones y conectores | RusoFácilapp",
    metaDescription:
      "Las palabras que sostienen cualquier frase rusa — pronombres, preposiciones, conjunciones — con transcripción, traducción y ejemplo. A1 a B2.",
    intro: [
      "Este es el bloque menos vistoso y el más rentable de todos. No son nombres de cosas, sino las piezas que unen la frase: pronombres, preposiciones, conjunciones, partículas. Es también el único campo con un peso enorme en A1, porque sin estas palabras no se puede construir ninguna oración, por mucho vocabulario temático que se tenga.",
      "Su dificultad es que casi ninguna funciona sola. Cada preposición rusa exige que la palabra siguiente adopte un caso concreto, y la misma preposición puede pedir casos distintos según el significado: в con acusativo indica movimiento hacia dentro, y con prepositional, ubicación. Aprender la preposición sin el caso que rige es aprender media palabra.",
      "El otro punto delicado son las conjunciones и, а y но. El español las cubre casi todas con «y» y «pero», mientras que el ruso separa: и suma, но introduce una oposición fuerte, y а marca un contraste suave, comparativo, que en español no se traduce con una sola palabra fija. Usar но donde toca а es uno de los errores más frecuentes y persistentes, y también uno de los que más rápido mejoran la naturalidad cuando se corrigen.",
    ],
  },
  {
    category: "science",
    slug: "ciencia",
    h1: "Vocabulario ruso de ciencia",
    metaTitle: "Vocabulario ruso de ciencia: lista de palabras con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas de ciencia, investigación y disciplinas académicas, con transcripción, traducción al español y ejemplo. Niveles A1 a B2.",
    intro: [
      "El vocabulario científico es, junto con el tecnológico, el más transparente para un hispanohablante, porque ambos idiomas lo tomaron prestado de las mismas raíces griegas y latinas. Muchas palabras se entienden a la primera lectura, y eso permite avanzar rápido en textos que de otro modo parecerían inaccesibles.",
      "Hay una correspondencia especialmente útil: las palabras españolas terminadas en -ción tienen casi siempre una pareja rusa en -ция, y todas ellas son femeninas y se declinan igual. Es un patrón mecánico que cubre decenas de términos y que conviene aprender como regla, no palabra por palabra. Algo parecido ocurre con los finales -логия y -графия.",
      "El aviso importante es el acento. Aunque la palabra sea reconocible por escrito, el acento ruso rara vez coincide con el español, no se marca en el texto y cambia por completo cómo suena; una palabra que lees sin problema puede resultarte irreconocible al oírla. Por eso cada entrada lleva su transcripción con el acento marcado. Y el estilo científico ruso tiene además su propia gramática: abundan las construcciones pasivas con -ся y las oraciones sin sujeto personal.",
    ],
  },
  {
    category: "politics",
    slug: "politica",
    h1: "Vocabulario ruso de política",
    metaTitle: "Vocabulario ruso de política: lista de palabras con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas de política, instituciones y actualidad, con transcripción, traducción al español y frase de ejemplo. Niveles A1 a B2.",
    intro: [
      "Es un campo de nivel alto: casi todo está en B1 y B2, y su utilidad real aparece cuando ya puedes leer prensa o escuchar un informativo sin traducir palabra por palabra. Antes de ese punto, estudiarlo rinde poco.",
      "Buena parte de los términos son internacionalismos y se reconocen sin esfuerzo, pero eso engaña. Lo difícil no es entender la palabra suelta, sino la sintaxis en la que aparece: el registro político ruso encadena genitivos uno detrás de otro para expresar relaciones que el español resuelve con preposiciones, y esas cadenas se vuelven largas y densas. Descifrarlas exige tener automatizadas las terminaciones de genitivo, no solo saberlas.",
      "El segundo rasgo es la nominalización. Donde el español usa un verbo, el ruso formal prefiere el sustantivo derivado de ese verbo, casi siempre en -ение o -ание, ambos neutros. Una frase que en español sería «decidieron aumentar» se convierte en algo más parecido a «se tomó la decisión sobre el aumento». Reconocer que dentro de esos sustantivos hay un verbo escondido es la clave para leer este tipo de texto con soltura.",
    ],
  },
  {
    category: "psychology",
    slug: "psicologia",
    h1: "Vocabulario ruso de psicología",
    metaTitle: "Vocabulario ruso de psicología con traducción y ejemplos | RusoFácilapp",
    metaDescription:
      "Palabras rusas de psicología, carácter y estados mentales, con transcripción, traducción al español y ejemplo. Niveles A1 a B2.",
    intro: [
      "Este bloque va un paso más allá que el de emociones: no se trata de decir cómo te sientes ahora, sino de describir carácter, procesos mentales y relaciones. Es vocabulario de B1 y B2, con mucha palabra derivada y abstracta.",
      "Su columna vertebral es el sufijo -ость, que convierte un adjetivo en el nombre de la cualidad correspondiente y da siempre sustantivos femeninos. Una vez visto el patrón, cada adjetivo de carácter que aprendas te regala su sustantivo, lo que multiplica el vocabulario sin memorización adicional. Conviene aprender las dos formas a la vez, porque en la frase real alternan.",
      "El segundo rasgo son los verbos con -ся, muy abundantes aquí. Muchos describen un estado interior que no recae sobre nadie más, como волноваться, «preocuparse», o бояться, «temer», y varios de ellos no existen sin ese postfijo, igual que en español «quejarse» o «atreverse» no existen sin el «se». También rige mucho el dativo con construcciones impersonales del tipo мне кажется, «me parece». Como en el resto de campos abstractos, estas palabras se retienen mejor dentro de una frase que en una lista de equivalencias.",
    ],
  },
  {
    category: "synonymsAntonyms",
    slug: "sinonimos-y-antonimos",
    h1: "Sinónimos y antónimos en ruso",
    metaTitle: "Sinónimos y antónimos en ruso: lista con traducción | RusoFácilapp",
    metaDescription:
      "Pares de sinónimos y antónimos rusos con transcripción, traducción al español y frase de ejemplo, para precisar el vocabulario. A1 a B2.",
    intro: [
      "Este bloque no añade temas nuevos: afina los que ya tienes. Está pensado para el momento en que ya te haces entender y quieres dejar de repetir siempre la misma palabra, y por eso su peso está en A2 y B1, cuando el vocabulario básico ya está en su sitio.",
      "Lo que hay que tener claro es que en ruso los sinónimos casi nunca son intercambiables sin más. Suelen diferenciarse por registro — una palabra es neutra y su pareja resulta libresca o coloquial — o por la compañía que admiten: dos adjetivos que se traducen igual al español pueden combinarse con sustantivos distintos y sonar mal fuera de su pareja habitual. Sustituir uno por otro sin comprobarlo es una fuente segura de frases raras.",
      "Los antónimos son más fiables y por eso son un recurso de estudio excelente: aprender una palabra junto a su contrario duplica el vocabulario y ancla mejor el significado, porque el par se recuerda como una unidad. Aquí conviene fijarse además en el aspecto verbal, ya que algunas oposiciones no están entre dos raíces distintas sino entre las dos formas aspectuales del mismo verbo.",
    ],
  },
  {
    category: "sport",
    slug: "deportes",
    h1: "Vocabulario ruso de deportes",
    metaTitle: "Vocabulario ruso de deportes: palabras con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas de deportes, ejercicio y competición, con transcripción, traducción al español y frase de ejemplo. Niveles A1 a B2.",
    intro: [
      "Es uno de los bloques más pequeños de la lista, pero tiene una ventaja didáctica que compensa su tamaño: enseña de una sola vez un contraste gramatical que se aplica muchísimo más allá del deporte.",
      "En ruso, decir que practicas un deporte se hace de dos maneras distintas según el deporte. Si es un juego con pelota o con equipos, se usa играть в más acusativo: играть в футбол, играть в теннис. Si es una actividad sin adversario directo, se usa заниматься más instrumental: заниматься плаванием, заниматься йогой. No es una elección estilística, es obligatoria, y el español no la marca de ninguna manera, porque «jugar al fútbol» y «hacer natación» se distinguen por el verbo, no por la forma del sustantivo.",
      "El resto del campo es más sencillo. Muchos nombres de deportes son internacionalismos reconocibles, aunque siempre con el aviso del acento, que no coincide con el español. Y como buena parte del vocabulario describe movimiento — correr, saltar, nadar —, este bloque se apoya de forma natural en los verbos de movimiento y sus parejas de dirección.",
    ],
  },
  {
    category: "law",
    slug: "derecho",
    h1: "Vocabulario ruso de derecho y leyes",
    metaTitle: "Vocabulario ruso de derecho y leyes con traducción | RusoFácilapp",
    metaDescription:
      "Palabras rusas de derecho, leyes y trámites, con transcripción, traducción al español y frase de ejemplo. Niveles B1 y B2.",
    intro: [
      "Es el bloque más pequeño de todos y el único que no tiene ninguna palabra de nivel principiante: empieza directamente en B1. Tiene sentido, porque el lenguaje jurídico no es vocabulario cotidiano con palabras difíciles, sino un registro entero con su propia gramática.",
      "Su rasgo más marcado es la nominalización llevada al extremo. Donde la lengua hablada usa un verbo, el texto jurídico ruso usa el sustantivo derivado de ese verbo, casi siempre en -ение o -ание, y lo rodea de genitivos encadenados. El resultado son sintagmas largos, sin verbo conjugado a la vista, que hay que desmontar de dentro hacia fuera. Practicar la lectura de una sola frase larga rinde aquí más que memorizar veinte términos sueltos.",
      "El segundo rasgo es la voz pasiva con -ся y las construcciones impersonales, que sirven para no nombrar al responsable de la acción: es el mismo recurso del «se» impersonal español, y cumple la misma función de dar un tono neutro y oficial. Buena parte de este vocabulario resulta además útil fuera de un juzgado, porque es el mismo registro de los contratos, los formularios y cualquier trámite administrativo.",
    ],
  },
];

const BY_SLUG = new Map(VOCABULARY_CATEGORY_PAGES.map((p) => [p.slug, p]));

export function getVocabularyCategoryPage(slug: string): VocabularyCategoryPage | undefined {
  return BY_SLUG.get(slug);
}

/** Levels published on these pages. C1 is deliberately absent: those 898
 * cards stay behind the paywall in full, and filtering here (rather than
 * in the component) is what keeps them out of the served HTML entirely. */
export const PUBLIC_VOCABULARY_LEVELS = ["A1", "A2", "B1", "B2"] as const;
