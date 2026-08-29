/**
 * Seeds a small starter set of linguistic-terms glossary entries — the
 * course's own metalanguage, in Spanish, with its Russian equivalent (see
 * src/lib/glossary.ts). This is a foundation seed proving the pipeline
 * end-to-end, not a complete glossary: each entry mirrors a concept
 * already taught somewhere in the course (see relatedLessons).
 *
 * Safe to re-run: upserts by slug.
 *
 * SAFE BY DEFAULT: a term a staff member has hand-edited through /admin
 * (GlossaryTerm.reviewedAt set — see src/app/api/admin/glossary/save) is
 * skipped, not overwritten, even if this file's own data disagrees. Pass
 * --force to overwrite reviewed rows anyway. See CONTENT_INTEGRITY.md.
 *
 *   npm run db:seed-glossary
 *   npm run db:seed-glossary -- --force
 *
 * Two flags exist for running this against the PRODUCTION database, where
 * "re-run the whole seed" is a much bigger promise than it is locally:
 *
 *   --dry-run          Touches nothing. Reads each row and prints a
 *                      field-by-field diff of what a real run would
 *                      change, so the change can be reviewed before it
 *                      happens rather than reconstructed afterwards.
 *   --only=a,b,c       Restricts the run to those slugs. Without it,
 *                      --force means "overwrite EVERY hand-reviewed row",
 *                      which is almost never what's intended when the
 *                      goal is to push one corrected entry; with it,
 *                      --force is scoped to the slugs actually named.
 *
 *   npm run db:seed-glossary -- --dry-run
 *   npm run db:seed-glossary -- --only=arcaismo --force
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { validateGlossaryInput, type GlossaryCategory, type GlossaryExample } from "../src/lib/glossary";

import { isEntryPoint } from "../src/lib/entry-point";
const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const slugs = arg
    .slice("--only=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return slugs.length > 0 ? new Set(slugs) : null;
})();

interface SeedTerm {
  slug: string;
  term: string;
  definition: string;
  russianEquivalent: string;
  transcription: string;
  category: GlossaryCategory;
  /** Only set for "partes-de-la-oracion" terms — see the field comment on
   * GlossaryTerm.russianComparison in prisma/schema.prisma for why the
   * older Russian-concept entries below leave this out. */
  russianComparison?: string;
  /** Short example sentences in context — at least one, usually two, so
   * the pattern shows up more than once in real language rather than as a
   * single isolated word pair. */
  examples: GlossaryExample[];
  relatedLessons: string[];
}

const terms: SeedTerm[] = [
  // Partes de la oración — terminología gramatical básica en español,
  // explicada "como para niños" (ver petición del usuario) y comparada con
  // cómo se comporta esa misma pieza en ruso. Estos son los términos que
  // GlossaryText (src/components/glossary/GlossaryText.tsx) detecta
  // automáticamente dentro de la prosa de gramática de las lecciones.
  {
    slug: "sustantivo",
    term: "sustantivo",
    definition:
      "Es la palabra que nombra a una persona, un animal, una cosa, un lugar o una idea. Por ejemplo: niño, perro, mesa, ciudad, amor. Casi siempre puedes poner «el» o «la» delante de un sustantivo.",
    russianEquivalent: "имя существительное",
    transcription: "ímya sushchyestvítyel'naye",
    category: "partes-de-la-oracion",
    russianComparison:
      "En español el sustantivo casi nunca cambia de forma (solo entre singular y plural: mesa / mesas). En ruso, en cambio, la TERMINACIÓN del sustantivo cambia según el papel que cumple en la frase — eso son los «casos» (para más detalle, busca ese término en este glosario). Además, en ruso todo sustantivo tiene un género fijo: masculino, femenino o NEUTRO (el español solo tiene masculino y femenino).",
    examples: [
      { es: "El perro corre en el parque.", ru: "Собака бежит в парке." },
      { es: "Mi hermana estudia medicina.", ru: "Моя сестра изучает медицину." },
    ],
    relatedLessons: ["a1-1"],
  },
  {
    slug: "adjetivo",
    term: "adjetivo",
    definition:
      "Es la palabra que describe cómo es un sustantivo: de qué color, tamaño o cualidad. Por ejemplo: grande, bonito, rápido, ruso. Un adjetivo casi siempre acompaña a un sustantivo.",
    russianEquivalent: "имя прилагательное",
    transcription: "ímya prilagátyel'naye",
    category: "partes-de-la-oracion",
    russianComparison:
      "En español el adjetivo concuerda con el sustantivo en género y número (niño alto / niña alta / niños altos). En ruso concuerda además en CASO — es decir, la terminación del adjetivo cambia junto con la del sustantivo que describe, no solo por género y número. Por eso los adjetivos rusos tienen más terminaciones posibles que los españoles.",
    examples: [
      { es: "Tengo un coche rojo.", ru: "У меня красная машина." },
      { es: "Ella es muy inteligente.", ru: "Она очень умная." },
    ],
    relatedLessons: ["a1-6"],
  },
  {
    slug: "verbo",
    term: "verbo",
    definition:
      "Es la palabra que expresa una acción (correr, hablar, comer) o un estado (ser, estar). Es la palabra que le dice a la frase «qué está pasando».",
    russianEquivalent: "глагол",
    transcription: "glagól",
    category: "partes-de-la-oracion",
    russianComparison:
      "Además de cambiar según quién hace la acción (como en español: yo hablo / tú hablas), en ruso casi todos los verbos existen en dos versiones — imperfectiva y perfectiva — que indican si la acción está en proceso o si ya se completó. El español no tiene esa distinción como par de verbos separados; lo resuelve de otra forma (con tiempos como el pretérito o el imperfecto).",
    examples: [
      { es: "Nosotros comemos pan.", ru: "Мы едим хлеб." },
      { es: "Ellos trabajan en una oficina.", ru: "Они работают в офисе." },
    ],
    relatedLessons: ["a1-7"],
  },
  {
    slug: "adverbio",
    term: "adverbio",
    definition:
      "Es la palabra que da más información sobre un verbo, un adjetivo u otro adverbio: dice cómo, cuándo, dónde o cuánto. Por ejemplo: rápido, ayer, aquí, muy. A diferencia del adjetivo, el adverbio NUNCA cambia de forma.",
    russianEquivalent: "наречие",
    transcription: "naryéchiye",
    category: "partes-de-la-oracion",
    russianComparison:
      "Buena noticia: en ambos idiomas el adverbio es invariable, no cambia de forma nunca (ni por género, ni por número, ni por caso). Muchos adverbios rusos de modo se forman con la terminación «-о», parecido a cómo el español a veces usa «-mente» (rápidamente ≈ быстро).",
    examples: [
      { es: "Habla muy rápido.", ru: "Он говорит очень быстро." },
      { es: "Llegamos tarde a la fiesta.", ru: "Мы пришли на вечеринку поздно." },
    ],
    relatedLessons: ["a1-8"],
  },
  {
    slug: "adverbio-de-lugar",
    term: "adverbio de lugar",
    definition:
      "Es un adverbio que responde a la pregunta «¿dónde?». Dice en qué lugar pasa algo. Por ejemplo: aquí, allí, arriba, cerca, lejos.",
    russianEquivalent: "наречие места",
    transcription: "naryéchiye myésta",
    category: "partes-de-la-oracion",
    russianComparison:
      "Funcionan igual que en español — son palabras fijas que no cambian. La diferencia importante está en los VERBOS que suelen acompañarlos: en ruso, para decir «dónde está algo» se usa el caso preposicional (где?), y para decir «hacia dónde se mueve algo» se usa el caso acusativo (куда?) — dos preguntas distintas que en español resolvemos con la misma preposición «en» o «a».",
    examples: [
      { es: "El gato está aquí.", ru: "Кот здесь." },
      { es: "Vivo cerca del centro.", ru: "Я живу недалеко от центра." },
    ],
    relatedLessons: ["a1-11"],
  },
  {
    slug: "pronombre",
    term: "pronombre",
    definition:
      "Es la palabra que se usa EN LUGAR de un sustantivo, para no repetirlo. Por ejemplo, en vez de decir «María» dos veces, decimos «ella». Los más comunes son: yo, tú, él, ella, nosotros...",
    russianEquivalent: "местоимение",
    transcription: "myestaimyéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "Igual que los sustantivos, en ruso los pronombres también cambian de terminación según el caso — «yo» puede ser я, меня, мне, según su función en la frase, algo que en español no ocurre (siempre decimos «yo», sin importar su papel).",
    examples: [
      { es: "Ella vive en Moscú.", ru: "Она живёт в Москве." },
      { es: "¿Puedes ayudarme?", ru: "Можешь мне помочь?" },
    ],
    relatedLessons: ["a1-2"],
  },
  {
    slug: "preposicion",
    term: "preposición",
    definition:
      "Es una palabra corta que conecta otras palabras y explica una relación entre ellas — de lugar, tiempo, compañía, etc. Por ejemplo: en, con, de, para, sin.",
    russianEquivalent: "предлог",
    transcription: "predlók",
    category: "partes-de-la-oracion",
    russianComparison:
      "Diferencia clave: en ruso, cada preposición «exige» que la palabra siguiente use un caso concreto — no puedes combinar cualquier preposición con cualquier terminación. Por ejemplo, «с» (con) exige el caso instrumental. En español las preposiciones no le cambian la forma a la palabra que sigue.",
    examples: [
      { es: "El libro está sobre la mesa.", ru: "Книга на столе." },
      { es: "Voy a la escuela con mi hermano.", ru: "Я иду в школу с братом." },
    ],
    relatedLessons: ["a1-11"],
  },
  {
    slug: "articulo",
    term: "artículo",
    definition:
      "Es la palabra chiquita que va antes de un sustantivo: el, la, los, las, un, una. En español casi siempre necesitas un artículo antes de un sustantivo.",
    russianEquivalent: "артикль",
    transcription: "artíkl'",
    category: "partes-de-la-oracion",
    russianComparison:
      "Aquí hay una diferencia enorme y muy buena noticia: el ruso NO TIENE artículos. No existe «el», «la», «un» ni «una» en ruso — simplemente se omiten. «Дом» puede significar «casa», «la casa» o «una casa», según el contexto. Es una de las cosas que hace al ruso más simple que el español en ese aspecto.",
    examples: [
      { es: "La casa es grande.", ru: "Дом большой." },
      { es: "Un perro ladra en la calle.", ru: "Собака лает на улице." },
    ],
    relatedLessons: ["a1-1"],
  },
  {
    slug: "conjuncion",
    term: "conjunción",
    definition: "Es la palabra que une dos palabras o dos partes de una frase. Por ejemplo: y, pero, porque, si, o.",
    russianEquivalent: "союз",
    transcription: "sayús",
    category: "partes-de-la-oracion",
    russianComparison:
      "Funcionan de forma muy parecida en los dos idiomas — conectan ideas sin cambiar de forma. La diferencia está en el detalle: el ruso distingue entre «и» (y — suma cosas parecidas) y «а» (y/pero — marca un contraste suave), un matiz que en español normalmente se resuelve solo con «y» o «pero».",
    examples: [
      { es: "Quiero café y té.", ru: "Я хочу кофе и чай." },
      { es: "No vino porque estaba enfermo.", ru: "Он не пришёл, потому что был болен." },
    ],
    relatedLessons: ["a2-22"],
  },
  {
    slug: "sujeto",
    term: "sujeto",
    definition:
      "Es la persona o cosa que HACE la acción del verbo, o de la que se habla en la frase. En «María come una manzana», el sujeto es María — es quien come.",
    russianEquivalent: "подлежащее",
    transcription: "padlyezháshcheye",
    category: "partes-de-la-oracion",
    russianComparison:
      "El sujeto siempre va en caso nominativo tanto en ruso como el sujeto en español va sin preposición. La diferencia es que en ruso el orden de palabras es mucho más libre: como el caso ya indica quién es el sujeto, no siempre tiene que ir primero en la frase, a diferencia del español, donde el orden sujeto-verbo-objeto es más fijo.",
    examples: [
      { es: "María canta muy bien.", ru: "Мария поёт очень хорошо." },
      { es: "El profesor explica la lección.", ru: "Учитель объясняет урок." },
    ],
    relatedLessons: ["a1-6"],
  },
  {
    slug: "complemento-directo",
    term: "complemento directo",
    definition:
      "Es la persona o cosa que RECIBE la acción del verbo — sobre quién o qué recae la acción. En «María come una manzana», el complemento directo es «una manzana»: es lo que se come.",
    russianEquivalent: "прямое дополнение",
    transcription: "pryamóye dapalnyéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "En español el complemento directo no cambia la forma de la palabra (solo a veces se le pone «a», con personas). En ruso, el complemento directo casi siempre se marca con el caso acusativo — la propia palabra cambia de terminación para mostrar que es ella quien recibe la acción, sin necesidad de una preposición extra.",
    examples: [
      { es: "Compré un libro.", ru: "Я купил книгу." },
      { es: "¿Ves la película?", ru: "Ты смотришь фильм?" },
    ],
    relatedLessons: ["a1-13"],
  },
  {
    slug: "genero-gramatical",
    term: "género gramatical",
    definition:
      "Es una «categoría» que tiene cada sustantivo: masculino o femenino en español (el niño / la niña). No siempre tiene que ver con el sexo real — «la mesa» es femenino aunque una mesa no tenga género biológico, es solo una regla del idioma.",
    russianEquivalent: "грамматический род",
    transcription: "grammatíchyeskiy rot",
    category: "partes-de-la-oracion",
    russianComparison:
      "El ruso tiene TRES géneros en vez de dos: masculino, femenino y NEUTRO (este último no existe en español). La buena noticia es que en ruso el género casi siempre se reconoce por la última letra de la palabra: terminación en consonante → masculino (стол), en «-а/-я» → femenino (книга), en «-о/-е» → neutro (окно). En español, en cambio, el género de muchas palabras simplemente hay que memorizarlo.",
    examples: [
      { es: "El niño es alto.", ru: "Мальчик высокий." },
      { es: "La niña es alta.", ru: "Девочка высокая." },
    ],
    relatedLessons: ["a1-1"],
  },
  {
    slug: "infinitivo",
    term: "infinitivo",
    definition:
      "Es la forma «básica» o «de diccionario» de un verbo — la que no está conjugada para nadie en particular. En español siempre termina en -ar, -er o -ir: hablar, comer, vivir.",
    russianEquivalent: "инфинитив",
    transcription: "infinitíf",
    category: "partes-de-la-oracion",
    russianComparison:
      "Se usa de forma muy parecida: es la entrada que vas a encontrar en cualquier diccionario. La diferencia es que en ruso, cada verbo tiene DOS infinitivos — uno imperfectivo y uno perfectivo (por ejemplo, читать / прочитать, «leer»/«leer [hasta terminar]») — mientras que en español un solo infinitivo cubre ambas ideas.",
    examples: [
      { es: "Quiero aprender ruso.", ru: "Я хочу учить русский." },
      { es: "Es importante dormir bien.", ru: "Важно хорошо спать." },
    ],
    relatedLessons: ["a1-7"],
  },
  {
    slug: "concordancia",
    term: "concordancia",
    definition:
      "Es la «regla de que las palabras combinen entre sí» dentro de una frase — por ejemplo, que un adjetivo tenga el mismo género y número que el sustantivo que describe: «niñas altas» (femenino plural + femenino plural), no «niñas alto».",
    russianEquivalent: "согласование",
    transcription: "saglasavániye",
    category: "partes-de-la-oracion",
    russianComparison:
      "En español la concordancia es solo de género y número. En ruso, la concordancia entre un adjetivo y su sustantivo es más exigente: también deben coincidir en CASO. Por eso, al cambiar la función de un sustantivo en la frase, su adjetivo lo acompaña cambiando también — los dos se mueven juntos.",
    examples: [
      { es: "Las casas blancas son bonitas.", ru: "Белые дома красивые." },
      { es: "Un hombre alto camina despacio.", ru: "Высокий мужчина идёт медленно." },
    ],
    // a2-10 and a2-11 teach exactly this concept in the dative and the
    // instrumental. A separate "declinación del adjetivo" entry would be a
    // second term on a concept this one already states outright ("también
    // deben coincidir en CASO"), so the lessons join the term instead.
    relatedLessons: ["a2-9", "a2-10", "a2-11"],
  },
  {
    slug: "tiempo-verbal",
    term: "tiempo verbal",
    definition:
      "Es la forma del verbo que indica CUÁNDO pasa la acción: en el pasado, en el presente o en el futuro. Por ejemplo, «hablo» (presente), «hablé» (pasado) y «hablaré» (futuro) son tres tiempos del mismo verbo.",
    russianEquivalent: "время глагола",
    transcription: "vryémya glagóla",
    category: "partes-de-la-oracion",
    russianComparison:
      "El ruso también tiene tres tiempos — presente, pasado y futuro — pero con una diferencia importante: el tiempo PASADO no cambia según quién hace la acción (yo/tú/él usan la misma forma), sino según el género y número del sujeto. Además, el futuro se construye distinto según el aspecto del verbo (busca «aspecto perfectivo»/«aspecto imperfectivo» en este glosario): el futuro perfectivo es una sola palabra (прочитаю), pero el futuro imperfectivo se arma con «быть» + infinitivo (буду читать).",
    examples: [
      { es: "Ahora estudio ruso.", ru: "Сейчас я изучаю русский." },
      { es: "Ayer trabajé mucho.", ru: "Вчера я много работал." },
    ],
    relatedLessons: ["a1-15", "a1-16"],
  },
  {
    slug: "modo-verbal",
    term: "modo verbal",
    definition:
      "Es la forma del verbo que muestra la actitud del hablante: si algo es un hecho real (modo indicativo: «como»), una orden (modo imperativo: «¡come!») o algo posible/hipotético (modo condicional: «comería»).",
    russianEquivalent: "наклонение глагола",
    transcription: "naklanyéniye glagóla",
    category: "partes-de-la-oracion",
    russianComparison:
      "El ruso tiene los mismos tres conceptos, pero los construye distinto: el modo imperativo tiene sus propias terminaciones especiales (говори! — ¡habla!), mientras que el modo condicional NO usa una terminación especial del verbo — se forma con la partícula «бы» más la forma de pasado (я бы сказал — yo diría), sin importar si hablamos de un condicional presente, pasado o futuro.",
    examples: [
      { es: "Come más verduras.", ru: "Ешь больше овощей." },
      { es: "Yo compraría esa casa.", ru: "Я бы купил этот дом." },
    ],
    relatedLessons: ["a1-9"],
  },
  {
    slug: "numero-gramatical",
    term: "número gramatical",
    definition:
      "Es la marca que dice si hablamos de UNA cosa (singular: libro) o de VARIAS (plural: libros). En español casi siempre se marca añadiendo «-s» o «-es» al final de la palabra.",
    russianEquivalent: "грамматическое число",
    transcription: "grammatíchyeskaye chisló",
    category: "partes-de-la-oracion",
    russianComparison:
      "El concepto es igual, pero el plural ruso no se forma con una sola terminación fija como el «-s» español — depende del género de la palabra (столы, книги, окна son tres plurales distintos, uno por cada género). Además, en ruso el plural TAMBIÉN cambia según el caso, igual que el singular — el número y el caso viajan siempre juntos en la misma terminación.",
    examples: [
      { es: "Tengo un libro.", ru: "У меня одна книга." },
      { es: "Tengo tres libros.", ru: "У меня три книги." },
    ],
    relatedLessons: ["a1-4"],
  },
  {
    slug: "complemento-indirecto",
    term: "complemento indirecto",
    definition:
      "Es la persona que RECIBE el beneficio o resultado de la acción — normalmente responde a «¿a quién?» o «¿para quién?». En «Le doy un regalo a María», el complemento indirecto es «a María»: es quien recibe el regalo.",
    russianEquivalent: "косвенное дополнение",
    transcription: "kósvyennaye dapalnyéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "En español el complemento indirecto casi siempre lleva la preposición «a» (y a veces se duplica con «le/les»). En ruso no hace falta ninguna preposición: el complemento indirecto se marca solo con el caso dativo — la propia palabra cambia de terminación para mostrar que es ella quien recibe el beneficio de la acción (María → Марии).",
    examples: [
      { es: "Le doy un regalo a María.", ru: "Я дарю подарок Марии." },
      { es: "Le escribo una carta a mi abuela.", ru: "Я пишу письмо бабушке." },
    ],
    relatedLessons: ["a1-24", "a1-25"],
  },
  {
    slug: "voz-activa",
    term: "voz activa",
    definition:
      "Es cuando el SUJETO de la frase hace la acción directamente. En «El gato come el pescado», el gato (sujeto) hace la acción de comer — eso es voz activa, la forma más común y natural de hablar.",
    russianEquivalent: "действительный залог",
    transcription: "dyeystvítyel'nyy zalók",
    category: "partes-de-la-oracion",
    russianComparison:
      "Funciona igual que en español: el sujeto realiza la acción directamente, sin marcas especiales en el verbo. La voz activa rusa es la construcción por defecto — la que ya conoces de casi todas las lecciones del curso hasta ahora.",
    examples: [
      { es: "El gato come el pescado.", ru: "Кот ест рыбу." },
      { es: "Los estudiantes escriben la tarea.", ru: "Студенты пишут домашнее задание." },
    ],
    relatedLessons: ["a1-7"],
  },
  {
    slug: "voz-pasiva",
    term: "voz pasiva",
    definition:
      "Es cuando el SUJETO de la frase RECIBE la acción, en vez de hacerla. En «El pescado es comido por el gato», el pescado (sujeto gramatical) no hace nada — la acción la hace el gato, pero el foco de la frase es el pescado.",
    russianEquivalent: "страдательный залог",
    transcription: "stradátyel'nyy zalók",
    category: "partes-de-la-oracion",
    russianComparison:
      "Aquí hay una diferencia real de estilo entre los dos idiomas: el español usa mucho «ser + participio» (es comido) o «se» (se vende pan), pero el ruso prefiere el participio pasivo (busca «participio pasivo» en este glosario) o un verbo reflexivo en «-ся» para la misma idea. La voz pasiva es más frecuente en ruso en textos formales/periodísticos que en la conversación cotidiana.",
    examples: [
      { es: "La carta fue escrita por mi hermano.", ru: "Письмо было написано моим братом." },
      { es: "Aquí se vende pan.", ru: "Здесь продаётся хлеб." },
    ],
    relatedLessons: ["b1-20", "b2-13"],
  },
  {
    slug: "oracion-subordinada",
    term: "oración subordinada",
    definition:
      "Es una frase «dentro de otra frase», que no puede quedarse sola con sentido completo — depende de una frase principal. Casi siempre empieza con una palabra como «que», «porque», «cuando» o «si». En «Creo que llueve», «que llueve» es la oración subordinada.",
    russianEquivalent: "придаточное предложение",
    transcription: "pridátachnaye pryedlazhéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "La lógica es la misma en los dos idiomas: una frase principal + una palabra conectora + una frase subordinada. La diferencia está en la puntuación: en ruso, la coma ANTES de «что» (que), «потому что» (porque) o «когда» (cuando) es obligatoria siempre, sin excepción — mientras que en español muchas veces esa misma frase no lleva coma.",
    examples: [
      { es: "Creo que va a llover.", ru: "Я думаю, что пойдёт дождь." },
      { es: "Salimos cuando terminó la clase.", ru: "Мы вышли, когда закончился урок." },
    ],
    relatedLessons: ["b1-23", "b1-24", "b1-26"],
  },
  {
    slug: "caso-nominativo",
    term: "caso nominativo",
    definition: "La forma 'de diccionario' de un sustantivo: la que se usa para nombrar algo o cuando es el sujeto de la frase.",
    russianEquivalent: "именительный падеж",
    transcription: "imyenítyel'nyy padyésh",
    category: "casos",
    examples: [
      { es: "Esto es una mesa.", ru: "Это стол." },
      { es: "María es médica.", ru: "Мария — врач." },
    ],
    relatedLessons: ["a1-3"],
  },
  {
    slug: "caso-genitivo",
    term: "caso genitivo",
    definition: "El caso que responde '¿de quién?/¿de qué?' — marca posesión, ausencia (con «нет») y cantidad, entre otros usos.",
    russianEquivalent: "родительный падеж",
    transcription: "radítyel'nyy padyésh",
    category: "casos",
    examples: [
      { es: "No tengo tiempo.", ru: "У меня нет времени." },
      { es: "Este es el libro de mi hermana.", ru: "Это книга моей сестры." },
    ],
    relatedLessons: ["a1-21", "a1-22", "a1-23", "a2-3"],
  },
  {
    slug: "aspecto-perfectivo",
    term: "aspecto perfectivo",
    definition:
      "La forma del verbo ruso que presenta una acción como un hecho completo, con resultado — a diferencia del imperfectivo, que la presenta como proceso o hábito.",
    russianEquivalent: "совершенный вид",
    transcription: "savyershénnyy vit",
    category: "aspecto",
    examples: [
      { es: "Leí el libro (y lo terminé).", ru: "Я прочитал книгу." },
      { es: "Él escribió la carta (y la terminó).", ru: "Он написал письмо." },
    ],
    relatedLessons: ["a2-1", "b1-15", "b1-16"],
  },
  {
    slug: "aspecto-imperfectivo",
    term: "aspecto imperfectivo",
    definition:
      "La forma del verbo ruso que presenta una acción como proceso, hábito, o hecho general — sin enfocarse en si se completó.",
    russianEquivalent: "несовершенный вид",
    transcription: "nyesavyershénnyy vit",
    category: "aspecto",
    examples: [
      { es: "Leía el libro / estuve leyendo el libro.", ru: "Я читал книгу." },
      { es: "Ella escribía la carta cuando llegué.", ru: "Она писала письмо, когда я пришёл." },
    ],
    relatedLessons: ["a2-1", "b1-15", "b1-16"],
  },
  {
    slug: "participio-activo",
    term: "participio activo",
    definition: "Forma verbal-adjetiva que sustituye a 'который' + verbo cuando 'который' sería el sujeto (nominativo) de la subordinada.",
    russianEquivalent: "действительное причастие",
    transcription: "dyeystvítyel'naye prichástiye",
    category: "participios-gerundios",
    examples: [
      { es: "la persona que trabaja aquí", ru: "человек, работающий здесь" },
      { es: "los estudiantes que estudian ruso", ru: "студенты, изучающие русский язык" },
    ],
    relatedLessons: ["b1-19", "b2-9", "b2-12"],
  },
  {
    slug: "participio-pasivo",
    term: "participio pasivo",
    definition: "Forma verbal-adjetiva que expresa que el sustantivo al que acompaña recibe la acción del verbo, no la realiza.",
    russianEquivalent: "страдательное причастие",
    transcription: "stradátyel'naye prichástiye",
    category: "participios-gerundios",
    examples: [
      { es: "el libro escrito", ru: "написанная книга" },
      { es: "la tienda cerrada", ru: "закрытый магазин" },
    ],
    relatedLessons: ["b1-20", "b2-13"],
  },
  {
    slug: "gerundio",
    term: "gerundio",
    definition:
      "Forma verbal invariable (деепричастие) que expresa una acción secundaria simultánea o previa a la acción principal, siempre con el mismo sujeto que ella.",
    russianEquivalent: "деепричастие",
    transcription: "diyeprichástiye",
    category: "participios-gerundios",
    examples: [
      { es: "Leyendo el libro, hacía anotaciones.", ru: "Читая книгу, он делал заметки." },
      { es: "Paseando por el parque, hablábamos en ruso.", ru: "Гуляя по парку, мы говорили по-русски." },
    ],
    relatedLessons: ["b1-21", "b1-22", "b2-10"],
  },
  {
    slug: "verbos-de-movimiento",
    term: "verbos de movimiento",
    definition:
      "Familia de verbos rusos que distinguen movimiento unidireccional de multidireccional (идти/ходить, ехать/ездить...) y que, con prefijos, expresan matices espaciales precisos (llegar, entrar, cruzar...) sin equivalente morfológico directo en español.",
    russianEquivalent: "глаголы движения",
    transcription: "glagóly dvizhéniya",
    category: "verbos-movimiento",
    examples: [
      { es: "Salió de casa y se fue al trabajo.", ru: "Он вышел из дома и пошёл на работу." },
      { es: "Ella va a la tienda todos los días.", ru: "Она идёт в магазин каждый день." },
    ],
    relatedLessons: ["a2-14", "b1-9", "b1-10"],
  },
  {
    slug: "caso-dativo",
    term: "caso dativo",
    definition:
      "Es el caso que usa el complemento indirecto: la persona o cosa que RECIBE la acción (a quién, para quién). En español no cambia la forma de la palabra, solo se marca con «a» o «para»; en ruso, el sustantivo mismo cambia de terminación.",
    russianEquivalent: "дательный падеж",
    transcription: "datyél'nyy padyésh",
    category: "casos",
    russianComparison:
      "En español «le doy un libro a Ana» no cambia la palabra «Ana». En ruso sí: «Ана» se convierte en «Ане» (Я даю книгу Ане). El dativo también aparece en construcciones muy comunes como decir la edad («мне 20 лет», literalmente «a mí 20 años») o con verbos como нравиться (gustar), donde quien siente la emoción va en dativo, no en nominativo.",
    examples: [
      { es: "Le doy un libro a Ana.", ru: "Я даю книгу Ане." },
      { es: "Tengo veinte años (lit. a mí hay veinte años).", ru: "Мне двадцать лет." },
    ],
    relatedLessons: ["a1-3", "a1-24"],
  },
  {
    slug: "caso-acusativo",
    term: "caso acusativo",
    definition:
      "Es el caso del complemento directo: la persona o cosa que recibe directamente la acción del verbo, sin preposición (a quién veo, qué como).",
    russianEquivalent: "винительный падеж",
    transcription: "vinítyel'nyy padyésh",
    category: "casos",
    russianComparison:
      "Aparece constantemente con verbos básicos como видеть (ver), читать (leer) o любить (amar). Para sustantivos femeninos en -а, el acusativo cambia la terminación a -у (книга → книгу); para masculinos inanimados y neutros, suele coincidir con el nominativo — una simplificación real que ayuda al principio.",
    examples: [
      { es: "Veo una casa.", ru: "Я вижу дом." },
      { es: "Leo un libro.", ru: "Я читаю книгу." },
    ],
    relatedLessons: ["a1-3", "a1-13", "a2-3"],
  },
  {
    slug: "caso-instrumental",
    term: "caso instrumental",
    definition:
      "Es el caso que indica el instrumento o medio con el que se hace algo («¿con qué?»), y también se usa para expresar profesión u ocupación («trabajar de/como algo»).",
    russianEquivalent: "творительный падеж",
    transcription: "tvarítyel'nyy padyésh",
    category: "casos",
    russianComparison:
      "En español decimos «escribo con un lápiz» usando la preposición «con»; en ruso, la palabra «lápiz» cambia de forma y ya no necesita preposición: пишу карандашом. También se usa sin preposición para decir la profesión: «trabajo de profesor» se dice работаю учителем, literalmente «trabajo profesor-INSTRUMENTAL».",
    examples: [
      { es: "Escribo con un lápiz.", ru: "Я пишу карандашом." },
      { es: "Trabajo de profesor.", ru: "Я работаю учителем." },
    ],
    relatedLessons: ["a1-3", "a1-26"],
  },
  {
    slug: "caso-preposicional",
    term: "caso preposicional",
    definition:
      "Es el caso que se usa siempre con ciertas preposiciones, sobre todo «о/об» (sobre, acerca de) y «в/на» cuando indican el LUGAR donde algo está (no hacia dónde se mueve).",
    russianEquivalent: "предложный падеж",
    transcription: "predlózhnyy padyésh",
    category: "casos",
    russianComparison:
      "Es el único caso ruso que nunca aparece sin preposición — de ahí su nombre. La misma preposición «в» cambia el caso del sustantivo según el sentido: «в доме» (en la casa, preposicional = ubicación) frente a «в дом» (hacia la casa, acusativo = dirección) — una distinción que el español no marca en la palabra misma.",
    examples: [
      { es: "Hablo de Rusia.", ru: "Я говорю о России." },
      { es: "Vivo en la ciudad.", ru: "Я живу в городе." },
    ],
    relatedLessons: ["a1-3", "a1-11"],
  },
  {
    slug: "conjuncion-subordinante",
    term: "conjunción subordinante",
    definition:
      "Es la conjunción que une una oración principal con una oración subordinada que depende de ella, indicando causa, concesión, condición u otra relación lógica (porque, aunque, como, cuando).",
    russianEquivalent: "подчинительный союз",
    transcription: "patchinítyel'nyy sayús",
    category: "conjunciones",
    russianComparison:
      "El ruso tiene varias conjunciones causales que en español se traducen todas como «porque»: потому что (la más neutra), так как (más formal, suele ir al principio de la frase) y поскольку (muy formal/escrito). Elegir cuál usar depende del registro, no solo del significado — algo que el español no distingue con una sola palabra.",
    examples: [
      { es: "Me quedé en casa porque hacía frío.", ru: "Я остался дома, потому что было холодно." },
      { es: "Aunque llovía, salimos a caminar.", ru: "Несмотря на дождь, мы пошли гулять." },
    ],
    relatedLessons: ["b2-14", "b2-15"],
  },
  {
    slug: "verbo-de-movimiento-unidireccional",
    term: "verbo de movimiento unidireccional",
    definition:
      "Es el verbo de movimiento que describe un desplazamiento en una sola dirección, en un momento concreto (voy ahora mismo hacia allá, en un solo trayecto).",
    russianEquivalent: "однонаправленный глагол движения",
    transcription: "adnanapravlyónnyy glagól dvizhéniya",
    category: "verbos-movimiento",
    russianComparison:
      "El ruso tiene dos verbos distintos donde el español solo usa «ir»: идти se usa para un trayecto único, en curso o hacia un destino concreto (voy ahora al trabajo), mientras que su pareja ходить (ver «verbo de movimiento multidireccional») se usa para desplazamientos habituales o de ida y vuelta. Elegir el verbo correcto es una de las mayores dificultades para hispanohablantes, porque el español no hace esta distinción gramaticalmente.",
    examples: [
      { es: "Ahora voy a la escuela.", ru: "Я сейчас иду в школу." },
      { es: "Vamos al cine (ahora, hacia allá).", ru: "Мы идём в кино." },
    ],
    relatedLessons: ["a2-14", "a2-15"],
  },
  {
    slug: "verbo-de-movimiento-multidireccional",
    term: "verbo de movimiento multidireccional",
    definition:
      "Es el verbo de movimiento que describe un desplazamiento habitual, repetido, de ida y vuelta, o sin dirección concreta (voy y vengo regularmente, camino sin rumbo fijo).",
    russianEquivalent: "разнонаправленный глагол движения",
    transcription: "raznanapravlyónnyy glagól dvizhéniya",
    category: "verbos-movimiento",
    russianComparison:
      "Se usa para hábitos («todos los días voy a la escuela»), viajes de ida y vuelta ya completados («ayer fui al cine y volví») o capacidad general («el niño ya camina»). Frente a идти/ехать (unidireccionales, ver esa entrada), estos verbos — ходить, ездить, бегать — no describen un trayecto único sino un patrón repetido.",
    examples: [
      { es: "Todos los días voy a la escuela.", ru: "Я каждый день хожу в школу." },
      { es: "Ayer fui al cine (y volví).", ru: "Вчера я ходил в кино." },
    ],
    relatedLessons: ["a2-14", "a2-16"],
  },
  {
    slug: "registro-formal-e-informal",
    term: "registro formal e informal",
    definition:
      "Es la diferencia entre hablarle a alguien de manera formal (respetuosa, con distancia) o informal (cercana, entre amigos o familiares) — en ruso se marca sobre todo en el pronombre y la forma del verbo, no solo en el tono.",
    russianEquivalent: "формальное и неформальное обращение",
    transcription: "farmál'naye i nyefarmál'naye abrashchéniye",
    category: "registro-estilo",
    russianComparison:
      "El ruso usa «ты» (tú) para el tratamiento informal y «вы» (usted/ustedes) para el formal — igual que el español distingue «tú» de «usted» — pero con una diferencia importante: «вы» también es el «vosotros/ustedes» plural, así que una misma palabra sirve para «usted» formal y para dirigirse a varias personas, sin importar la confianza.",
    examples: [
      { es: "¿Cómo te llamas? (informal)", ru: "Как тебя зовут?" },
      { es: "¿Cómo se llama usted? (formal)", ru: "Как вас зовут?" },
    ],
    relatedLessons: ["b1-8"],
  },
  {
    slug: "modo-imperativo",
    term: "modo imperativo",
    definition:
      "Es la forma del verbo que se usa para dar órdenes, pedidos o consejos directamente a alguien (¡ven!, ¡espera!, ¡no hagas eso!).",
    russianEquivalent: "повелительное наклонение",
    transcription: "pavyelítyel'naye naklanyéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "Se forma quitando la terminación del presente y añadiendo -й (tras vocal), -и (tras consonante) o -ь (en algunos verbos con consonante suave): читать → читай! (¡lee!), говорить → говори! (¡habla!). Igual que en español, cambia según se hable de «tú» (ты) o de «usted/ustedes» (вы) — la forma con -те (читайте!) es la formal/plural, paralela a nuestro «lean» frente a «lee».",
    examples: [
      { es: "¡Ven aquí!", ru: "Иди сюда!" },
      { es: "¡No hagas eso!", ru: "Не делай этого!" },
    ],
    relatedLessons: ["a1-9"],
  },
  {
    slug: "modo-condicional",
    term: "modo condicional",
    definition:
      "Es la forma verbal que expresa una acción hipotética, posible o deseada bajo una condición («haría», «iría si pudiera»).",
    russianEquivalent: "условное наклонение",
    transcription: "uslóvnaye naklanyéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "El ruso lo forma de manera mucho más simple que el español: verbo en pasado + la partícula бы (invariable, no se conjuga). No hay una terminación especial que memorizar para cada persona — «yo iría / tú irías / él iría» se dice siempre con la misma partícula: я пошёл бы / ты пошёл бы / он пошёл бы; solo cambia el género/número del verbo en pasado, nunca бы.",
    examples: [
      { es: "Iría al cine si tuviera tiempo.", ru: "Я пошёл бы в кино, если бы у меня было время." },
      { es: "Compraría esa casa.", ru: "Я купил бы этот дом." },
    ],
    relatedLessons: ["b2-1", "b2-2"],
  },
  {
    slug: "discurso-indirecto",
    term: "discurso indirecto",
    definition:
      "Es la forma de contar lo que alguien dijo sin citarlo literalmente entre comillas, integrando sus palabras dentro de la propia frase («dijo que vendría», en vez de «dijo: “vendré”»).",
    russianEquivalent: "косвенная речь",
    transcription: "kósvyennaya rech'",
    category: "partes-de-la-oracion",
    russianComparison:
      "A diferencia del español, el ruso NO cambia los tiempos verbales al pasar a discurso indirecto (no existe el equivalente a nuestra «concordancia de tiempos»): si alguien dijo «Я работаю» (presente), se reporta igual en presente: Он сказал, что работает. La palabra conectora también cambia según el tipo de frase original: что para afirmaciones, чтобы para órdenes o deseos, y las palabras interrogativas (где, когда...) o ли para preguntas.",
    examples: [
      { es: "Dijo que trabaja aquí.", ru: "Он сказал, что работает здесь." },
      { es: "Me pidió que cerrara la puerta.", ru: "Он попросил, чтобы я закрыл дверь." },
    ],
    relatedLessons: ["b1-23", "b1-24"],
  },
  {
    slug: "numeral",
    term: "numeral",
    definition:
      "Es la palabra que expresa una cantidad (numeral cardinal: uno, dos, tres) o un orden (numeral ordinal: primero, segundo, tercero).",
    russianEquivalent: "числительное",
    transcription: "chislítyel'naye",
    category: "partes-de-la-oracion",
    russianComparison:
      "La gran diferencia con el español: en ruso, los numerales cardinales exigen que el sustantivo que los acompaña cambie de caso y a veces de número. Con 1 el sustantivo va en singular normal (один стол), con 2-4 va en genitivo singular (два стола), y desde 5 en adelante va en genitivo plural (пять столов) — una regla sin equivalente en español, donde el sustantivo nunca cambia de forma por el numeral que lo acompaña.",
    examples: [
      { es: "Tengo una mesa.", ru: "У меня один стол." },
      { es: "Tengo cinco mesas.", ru: "У меня пять столов." },
    ],
    relatedLessons: ["a1-4", "b2-8"],
  },
  {
    slug: "grado-comparativo",
    term: "grado comparativo",
    definition:
      "Es la forma del adjetivo o adverbio que compara dos cosas, indicando que una tiene más o menos de una cualidad que la otra («más grande», «más rápido»).",
    russianEquivalent: "сравнительная степень",
    transcription: "sravnítyel'naya styépyen'",
    category: "partes-de-la-oracion",
    russianComparison:
      "El ruso tiene dos formas de comparativo: una simple, con el sufijo -ее/-ей añadido al adjetivo (быстрый → быстрее, «más rápido»), y otra compuesta con более + el adjetivo sin cambiar (para el registro formal/escrito). A diferencia del español, que casi siempre usa «más + adjetivo», el ruso prefiere la forma simple de una sola palabra en el habla cotidiana.",
    examples: [
      { es: "Este libro es más interesante.", ru: "Эта книга интереснее." },
      { es: "Él corre más rápido que yo.", ru: "Он бегает быстрее меня." },
    ],
    relatedLessons: ["a2-7", "a2-19", "a2-20"],
  },
  {
    slug: "grado-superlativo",
    term: "grado superlativo",
    definition:
      "Es la forma del adjetivo que expresa el grado máximo de una cualidad, comparando algo con todo un grupo («el más grande de todos», «el mejor»).",
    russianEquivalent: "превосходная степень",
    transcription: "pryevaskhódnaya styépyen'",
    category: "partes-de-la-oracion",
    russianComparison:
      "La forma más común y sencilla en ruso no es un sufijo especial, sino самый + el adjetivo normal: самый большой (el más grande), самый красивый (el más bonito) — literalmente «el mismo/muy + adjetivo». Es mucho más regular y predecible que el superlativo español, que a veces usa formas irregulares.",
    examples: [
      { es: "Es el edificio más alto de la ciudad.", ru: "Это самое высокое здание в городе." },
      { es: "Ella es la mejor estudiante.", ru: "Она самая лучшая студентка." },
    ],
    relatedLessons: ["a2-7", "a2-21"],
  },
  {
    slug: "pronombre-posesivo",
    term: "pronombre posesivo",
    definition: "Es el pronombre que indica a quién pertenece algo («mi», «tu», «su», «nuestro»...).",
    russianEquivalent: "притяжательное местоимение",
    transcription: "prityazhátyel'naye myestaimyéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "A diferencia del español, los posesivos rusos (мой, твой, его, её, наш, ваш, их) concuerdan en género, número y CASO con el sustantivo que poseen, no con la persona que posee: «mi libro» es мой (masculino) pero «mi casa» es моя (femenino) — el posesivo cambia según lo poseído, igual que un adjetivo normal.",
    examples: [
      { es: "Este es mi libro.", ru: "Это моя книга." },
      { es: "¿Dónde está tu casa?", ru: "Где твой дом?" },
    ],
    relatedLessons: ["a2-9", "a2-10"],
  },
  {
    slug: "pronombre-reflexivo",
    term: "pronombre reflexivo",
    definition: "Es el pronombre que indica que la acción del verbo recae sobre el propio sujeto que la realiza («me lavo», «se viste»).",
    russianEquivalent: "возвратное местоимение",
    transcription: "vazvrátnaye myestaimyéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "El ruso tiene un único pronombre reflexivo, себя, que sirve para TODAS las personas (yo, tú, él, nosotros...) sin cambiar — muy distinto del español, que usa uno diferente para cada persona (me, te, se, nos). Además, muchos verbos rusos llevan la partícula reflexiva -ся/-сь pegada al final del verbo mismo (мыться = «lavarse»), en vez de un pronombre separado.",
    examples: [
      { es: "Me lavo las manos.", ru: "Я мою себе руки." },
      { es: "Ella se viste rápido.", ru: "Она быстро одевается." },
    ],
    relatedLessons: ["b1-11", "b1-21"],
  },
  {
    slug: "par-aspectual",
    term: "par aspectual",
    definition:
      "Es la pareja de verbos rusos —uno perfectivo y uno imperfectivo— que expresan la MISMA acción pero con aspecto distinto (escribir: писать, imperfectivo, y написать, perfectivo).",
    russianEquivalent: "видовая пара",
    transcription: "vidaváya pára",
    category: "aspecto",
    russianComparison:
      "Casi todos los verbos rusos existen en pareja: uno para hablar de la acción como proceso o hábito (imperfectivo) y otro para hablarla como hecho completo (perfectivo) — ver «aspecto perfectivo» y «aspecto imperfectivo». No son dos tiempos del mismo verbo, sino dos verbos distintos con la misma raíz que hay que memorizar juntos, como una unidad léxica.",
    examples: [
      { es: "escribir (como proceso) / escribir (como hecho completo)", ru: "писать / написать" },
      { es: "leer (como proceso) / leer (como hecho completo)", ru: "читать / прочитать" },
    ],
    relatedLessons: ["a2-16", "b1-4"],
  },
  // 2026-08-19 expansion (run 154+): user flagged the glossary as far too
  // thin for Spanish speakers relative to the rest of the platform.
  // Targeting the weakest categories first: conjunciones (1 term),
  // registro-estilo (1 term), verbos-movimiento (3 terms), plus deeper
  // usage-pattern entries for casos/aspecto beyond the base case/aspect
  // names already covered above.
  {
    slug: "conjuncion-coordinante",
    term: "conjunción coordinante",
    definition:
      "Es la conjunción que une dos palabras, frases u oraciones de igual valor gramatical, sin que una dependa de la otra (y, pero, o).",
    russianEquivalent: "сочинительный союз",
    transcription: "sachinítyel'nyy sayús",
    category: "conjunciones",
    russianComparison:
      "El ruso distingue tres conjunciones coordinantes básicas donde el español a veces usa una sola: и (suma neutra, «y»), а (contraste suave, introduce algo nuevo o distinto sin ser tan fuerte como «pero») y но (contraste fuerte, «pero»). Confundir а y но es un error típico de hispanohablantes, porque ambas se traducen como «pero», pero а es mucho más suave.",
    examples: [
      { es: "Compré pan y leche.", ru: "Я купил хлеб и молоко." },
      { es: "Ella no llamó, sino que escribió.", ru: "Она не позвонила, а написала." },
    ],
    relatedLessons: ["b2-14", "b2-15"],
  },
  {
    slug: "verbo-reflexivo-sya",
    term: "verbo reflexivo (con -ся)",
    definition:
      "Es el verbo que lleva el postfijo -ся/-сь pegado al final, y que puede indicar una acción reflexiva, recíproca, pasiva, o simplemente ser un verbo distinto sin ese matiz — depende del verbo concreto.",
    russianEquivalent: "возвратный глагол",
    transcription: "vazvrátnyy glagól",
    category: "otros",
    russianComparison:
      "El postfijo -ся en ruso no siempre significa lo mismo que un verbo reflexivo en español. A veces sí es reflexivo puro (мыться — «lavarse»), pero también puede marcar reciprocidad (обниматься — «abrazarse mutuamente»), un significado pasivo (строиться — «ser construido») o incluso cambiar totalmente el significado del verbo, sin equivalente reflexivo en español (нравиться — «gustar», que sin «-ся» no existe con ese sentido). No hay que traducir automáticamente cada verbo en -ся como reflexivo.",
    examples: [
      { es: "Me lavo por la mañana.", ru: "Я умываюсь по утрам." },
      { es: "La casa se está construyendo.", ru: "Дом строится." },
    ],
    // Was the only term in this file with an empty list. No lesson is
    // ABOUT -ся (no lesson title mentions it), so these five were picked
    // by reading the grammar text of every candidate rather than by
    // keyword count, and each teaches a different one of the meanings
    // this entry lists: b1-12 reciprocity (переписываться), b1-21/b1-22
    // the gerund forms reflexives take (-ясь / -вшись), b2-6 the
    // impersonal use that matches Spanish "se", b2-22 the reflexive
    // passive (Проблема исследуется). b2-20 was rejected on purpose: it
    // covers "вести себя", which is the pronoun себя, not the -ся postfix.
    relatedLessons: ["b1-12", "b1-21", "b1-22", "b2-6", "b2-22"],
  },
  {
    slug: "diminutivo",
    term: "diminutivo",
    definition:
      "Es el sufijo que se añade a un sustantivo (o adjetivo) para expresar tamaño pequeño, cariño, familiaridad o, según el tono, incluso ironía o desprecio.",
    russianEquivalent: "уменьшительно-ласкательный суффикс",
    transcription: "umyen'shítyel'na-laskátyel'nyy súfiks",
    category: "otros",
    russianComparison:
      "El español tiene diminutivos (casita, perrito) pero el ruso los usa con mucha más frecuencia y con más matices: мама → мамочка (cariño), стол → столик (tamaño real más pequeño), собака → собачка (cariño hacia el animal). Un mismo sustantivo puede tener varios diminutivos distintos según el grado de cariño (нога → ножка), y usarlos mal — por ejemplo, con un desconocido en un contexto formal — puede sonar infantil o inapropiado.",
    examples: [
      { es: "¡Qué gatito tan bonito!", ru: "Какой хорошенький котик!" },
      { es: "Espera un momentito.", ru: "Подожди минуточку." },
    ],
    relatedLessons: [],
  },
  {
    slug: "par-ehat-ezdit",
    term: "ехать / ездить",
    definition:
      "Es el segundo par de verbos de movimiento más importante: ехать (unidireccional) se usa para un desplazamiento en vehículo, en curso o hacia un destino concreto; ездить (multidireccional) se usa para desplazamientos habituales o de ida y vuelta, siempre en vehículo.",
    russianEquivalent: "ехать / ездить",
    transcription: "yékhat' / yézdit'",
    category: "verbos-movimiento",
    russianComparison:
      "Funciona igual que идти/ходить (ver «verbo de movimiento unidireccional»), pero se usa cuando el desplazamiento es en un medio de transporte (coche, tren, autobús...) y no a pie. Un error común de hispanohablantes es usar идти para «ir en coche» simplemente porque «ir» en español no distingue el medio de transporte — en ruso, el verbo cambia según cómo te desplazas.",
    examples: [
      { es: "Voy al trabajo en coche (ahora).", ru: "Я еду на работу." },
      { es: "Todos los días voy al trabajo en coche.", ru: "Я каждый день езжу на работу." },
    ],
    relatedLessons: ["a2-15"],
  },
  {
    slug: "par-bezhat-begat",
    term: "бежать / бегать",
    definition:
      "Es el par de verbos de movimiento para «correr»: бежать (unidireccional) describe una carrera en curso, en una dirección concreta; бегать (multidireccional) describe correr como actividad habitual, sin dirección fija, o de ida y vuelta.",
    russianEquivalent: "бежать / бегать",
    transcription: "byezhát' / byégat'",
    category: "verbos-movimiento",
    russianComparison:
      "Como con los demás pares de verbos de movimiento, el error típico es usar solo una forma para todo. Бегать también se usa para «hacer running» como afición, no solo para desplazamientos concretos — un matiz que en español se resuelve con verbos o expresiones distintas («correr» frente a «hacer running»), no con dos formas del mismo verbo.",
    examples: [
      { es: "Mira, el niño corre hacia la puerta.", ru: "Смотри, мальчик бежит к двери." },
      { es: "Corro (hago running) todas las mañanas.", ru: "Я бегаю каждое утро." },
    ],
    relatedLessons: ["a2-16"],
  },
  {
    slug: "verbo-movimiento-con-prefijo",
    term: "verbo de movimiento con prefijo",
    definition:
      "Es un verbo de movimiento (идти, ехать, бежать...) al que se añade un prefijo espacial (при-, у-, в-, вы-, под-, от-, пере-, про-, до-...) para expresar un matiz preciso de dirección, como llegar, salir, cruzar o acercarse.",
    russianEquivalent: "приставочный глагол движения",
    transcription: "pristávachnyy glagól dvizhéniya",
    category: "verbos-movimiento",
    russianComparison:
      "El español expresa estos matices con verbos completamente distintos o con preposiciones (llegar, salir, entrar, cruzar, acercarse), mientras que el ruso construye todos a partir del mismo verbo base más un prefijo. Una vez aprendido el patrón (при- = llegar/acercarse, у- = irse, в-/вы- = entrar/salir, пере- = cruzar, до- = llegar hasta un punto), se puede predecir el significado de muchos verbos nuevos sin memorizarlos uno a uno.",
    examples: [
      { es: "El tren llegó a las tres.", ru: "Поезд пришёл в три часа." },
      { es: "Ella salió de la habitación.", ru: "Она вышла из комнаты." },
    ],
    // b1-11 (под-/от-) and b1-14 (the full recap of the prefix system) were
    // missing: b1-11's only link was `pronombre-reflexivo`, which has
    // nothing to do with what that lesson teaches. No new term — the prefix
    // system is one concept, not one concept per prefix pair.
    relatedLessons: ["b1-9", "b1-10", "b1-11", "b1-12", "b1-13", "b1-14"],
  },
  {
    slug: "genitivo-de-negacion",
    term: "genitivo de negación",
    definition:
      "Es el uso del caso genitivo para el complemento de un verbo en forma negativa, en lugar del acusativo que usaría la misma frase en afirmativo.",
    russianEquivalent: "родительный падеж при отрицании",
    transcription: "radítyel'nyy padyésh pri atritsánii",
    category: "casos",
    russianComparison:
      "En español la negación no cambia el caso del complemento («leo un libro» → «no leo el libro»), pero en ruso muchos verbos cambian el complemento de acusativo a genitivo al negarse: «Я читаю книгу» (acusativo) frente a «Я не читаю книги» (genitivo). No es obligatorio en todos los verbos ni registros, pero es muy frecuente, sobre todo por escrito.",
    examples: [
      { es: "No tengo dinero.", ru: "У меня нет денег." },
      { es: "No leo periódicos.", ru: "Я не читаю газет." },
    ],
    relatedLessons: ["a1-21", "a2-9"],
  },
  {
    slug: "acusativo-animado-inanimado",
    term: "acusativo animado/inanimado",
    definition:
      "Es la distinción, exclusiva del caso acusativo masculino singular (y de todo el plural), entre sustantivos animados (personas, animales) e inanimados: los animados toman la forma del genitivo, los inanimados la del nominativo.",
    russianEquivalent: "одушевлённость в винительном падеже",
    transcription: "adushyvlyónnast' v vinítyel'nam padyezhé",
    category: "casos",
    russianComparison:
      "El español no tiene esta distinción morfológica (usa siempre el mismo sustantivo, con o sin la preposición «a» para personas), pero el ruso obliga a elegir una forma distinta según si el objeto directo es un ser vivo o no: «Я вижу стол» (mesa, inanimado, igual que el nominativo) frente a «Я вижу брата» (hermano, animado, igual que el genitivo).",
    examples: [
      { es: "Veo la mesa.", ru: "Я вижу стол." },
      { es: "Veo a mi hermano.", ru: "Я вижу брата." },
    ],
    relatedLessons: ["a1-13", "a1-14"],
  },
  {
    slug: "instrumental-predicativo",
    term: "instrumental predicativo",
    definition:
      "Es el uso del caso instrumental para el atributo de verbos como «быть» (fuera del presente), «стать», «казаться» o «работать», en vez del nominativo que se usaría con «быть» en presente.",
    russianEquivalent: "творительный падеж в роли сказуемого",
    transcription: "tvarítyel'nyy padyésh v rolí skazúyemava",
    category: "casos",
    russianComparison:
      "En español el atributo del verbo «ser» no cambia de forma («es médico», «era médico», «será médico»), pero en ruso el atributo pasa a instrumental fuera del presente: «Он врач» (presente, nominativo) frente a «Он был врачом» / «Он станет врачом» (pasado/futuro, instrumental). Es un error muy común dejar el atributo en nominativo en pasado o futuro por calco del español.",
    examples: [
      { es: "Él es médico.", ru: "Он врач." },
      { es: "Él era médico.", ru: "Он был врачом." },
    ],
    relatedLessons: ["a1-26", "a1-27"],
  },
  {
    slug: "verbo-de-aspecto-unico",
    term: "verbo de aspecto único",
    definition:
      "Es el verbo que solo existe en una forma aspectual (casi siempre imperfectivo), sin una pareja del aspecto opuesto.",
    russianEquivalent: "одновидовой глагол",
    transcription: "adnavidavóy glagól",
    category: "aspecto",
    russianComparison:
      "El español no tiene esta categoría: cualquier verbo español puede, en principio, presentarse como completado o como proceso según el tiempo verbal elegido. En ruso, en cambio, algunos verbos —sobre todo los que describen estados o situaciones, no acciones puntuales— solo tienen una forma, y no hay que buscarles una pareja perfectiva que no existe.",
    examples: [
      { es: "Este edificio ya existía en el siglo XIX.", ru: "Это здание уже существовало в девятнадцатом веке." },
      { es: "Esta casa le pertenecía a mi abuelo.", ru: "Этот дом принадлежал моему дедушке." },
    ],
    relatedLessons: ["a2-1"],
  },
  {
    slug: "verbo-biaspectual",
    term: "verbo biaspectual",
    definition:
      "Es el verbo que tiene la misma forma para el aspecto perfectivo y el imperfectivo — el contexto, y no la morfología, indica si la acción se presenta como completa o como proceso.",
    russianEquivalent: "двувидовой глагол",
    transcription: "dvuvidavóy glagól",
    category: "aspecto",
    russianComparison:
      "Es lo contrario del verbo de aspecto único: aquí una misma palabra cubre los dos aspectos, y solo el contexto (a menudo palabras como «уже» para el sentido perfectivo o «сейчас»/«постоянно» para el imperfectivo) indica cuál se quiere expresar — algo que en español no ocurre, porque el aspecto se marca siempre con el tiempo verbal, nunca con la forma léxica del verbo.",
    examples: [
      { es: "Ellos ya investigaron el caso.", ru: "Они уже исследовали это дело." },
      { es: "Los científicos están investigando el fenómeno ahora mismo.", ru: "Учёные сейчас исследуют это явление." },
    ],
    relatedLessons: ["a2-1"],
  },
  {
    slug: "estilo-coloquial",
    term: "estilo coloquial",
    definition:
      "Es el registro relajado, propio de la conversación cotidiana entre amigos o familia, con vocabulario informal, partículas de relleno y construcciones más libres que en el habla o escritura formal.",
    russianEquivalent: "разговорный стиль",
    transcription: "razgavórnyy stíl'",
    category: "registro-estilo",
    russianComparison:
      "Igual que en español distinguimos «voy a comer» de «me voy pa' comer», el ruso coloquial recorta palabras (сейчас → щас, «ahora mismo»), usa muletillas como «ну», «короче», «типа» constantemente, y tolera un orden de palabras más libre que el ruso escrito o formal.",
    examples: [
      { es: "Ahora mismo voy, espera.", ru: "Щас иду, подожди." },
      { es: "Bueno, en fin, ni idea.", ru: "Ну короче, без понятия." },
    ],
    relatedLessons: ["b2-5", "b2-25"],
  },
  {
    slug: "estilo-cientifico-oficial",
    term: "estilo científico/oficial",
    definition:
      "Es el registro más formal del ruso escrito, usado en textos académicos, administrativos y burocráticos: frases largas, sustantivación de verbos, voz pasiva y ausencia casi total de coloquialismos o emociones.",
    russianEquivalent: "научный и официально-деловой стиль",
    transcription: "naúchnyy i afitsiál'na-dyelavóy stíl'",
    category: "registro-estilo",
    russianComparison:
      "El español académico/burocrático también evita el «yo» y prefiere construcciones impersonales o pasivas («se considera que», «fue determinado»), pero el ruso lleva esto más lejos con sustantivos derivados de verbos que suenan muy pesados en español si se traducen literalmente: «осуществление мероприятия» sería literalmente «la realización de la medida», donde el español normal simplemente diría «hacer/organizar algo».",
    examples: [
      { es: "Se determinó que el proceso no cumplía la norma.", ru: "Было установлено, что процесс не соответствует норме." },
      { es: "La comisión llevará a cabo la revisión del proyecto.", ru: "Комиссия осуществит рассмотрение проекта." },
    ],
    relatedLessons: ["b2-22", "b2-23", "b2-24"],
  },
  {
    slug: "segundo-caso-locativo",
    term: "segundo caso locativo (местный падеж)",
    definition:
      "Es una forma especial y poco frecuente del caso preposicional que solo existe para un grupo pequeño de sustantivos masculinos, usada exclusivamente con «в» y «на» para indicar lugar. En vez de la terminación normal del preposicional, estos sustantivos toman una terminación en «-у»/«-ю» acentuada: «в лесу» (no «в лесе»), «в саду», «на полу», «в году».",
    russianEquivalent: "местный падеж",
    transcription: "myéstnyy padyésh",
    category: "casos",
    examples: [
      { es: "Los niños juegan en el bosque.", ru: "Дети играют в лесу." },
      { es: "Este año viajaremos a España.", ru: "В этом году мы поедем в Испанию." },
    ],
    relatedLessons: ["b1-14"],
  },
  {
    slug: "dativo-impersonal",
    term: "dativo impersonal (мне холодно)",
    definition:
      "Es una construcción típicamente rusa sin sujeto gramatical: la persona que siente o experimenta algo va en caso dativo, y no en nominativo como en español. Por eso «tengo frío» se dice literalmente «a mí (me) frío»: «мне холодно». Lo mismo pasa con «me gusta» (мне нравится), «tengo... años» (мне... лет) o «no puedo» (мне нельзя).",
    russianEquivalent: "безличная конструкция с дательным падежом",
    transcription: "byezlíchnaya kanstruktsíya s datyél'nym padyezhóm",
    category: "casos",
    russianComparison:
      "En español el que siente frío, sueño o vergüenza es el SUJETO de la oración («yo tengo frío»). En ruso esa persona no es sujeto: va en dativo y el verbo (si lo hay) queda en forma neutra invariable, sin sujeto gramatical. Es uno de los cambios de perspectiva más difíciles de interiorizar para un hispanohablante.",
    examples: [
      { es: "Tengo frío, cierra la ventana, por favor.", ru: "Мне холодно, закрой окно, пожалуйста." },
      { es: "A mi hermano le gusta este libro.", ru: "Моему брату нравится эта книга." },
    ],
    // a1-25 («мне нравится» and the state adverbs) and b1-2 (нужно/надо/
    // можно/нельзя + infinitive) are the same construction this definition
    // already names, taught earlier and later than a2-8.
    relatedLessons: ["a1-25", "a2-8", "b1-2", "b1-29"],
  },
  {
    slug: "conjuncion-adversativa",
    term: "conjunción adversativa",
    definition:
      "Es la conjunción que une dos ideas que se contraponen o contrastan entre sí, como «pero» o «sino» en español. En ruso hay dos palabras distintas para esta idea: «но» (contraste general, como «pero») y «а» (contraste más suave, casi de comparación, sin equivalente exacto en español).",
    russianEquivalent: "противительный союз",
    transcription: "prativítyel'nyy sayús",
    category: "conjunciones",
    russianComparison:
      "El español tiene una sola palabra fuerte para esto («pero»), mientras que el ruso distingue: «но» se usa para un contraste marcado («quería ir, pero no pude» — хотел пойти, но не смог), y «а» conecta dos ideas paralelas que simplemente difieren, sin tanta fuerza opositora («yo estudio, y/mientras mi hermano trabaja» — я учусь, а мой брат работает). Confundir «но» y «а» es un error muy común de hispanohablantes.",
    examples: [
      { es: "Quería llamarte, pero se me acabó la batería.", ru: "Я хотел тебе позвонить, но у меня сел телефон." },
      { es: "Yo vivo en Madrid, y mi hermana vive en Barcelona.", ru: "Я живу в Мадриде, а моя сестра живёт в Барселоне." },
    ],
    relatedLessons: ["a1-9"],
  },
  {
    slug: "conjuncion-causal",
    term: "conjunción causal",
    definition:
      "Es la conjunción que introduce la causa o razón de algo, como «porque» en español. En ruso las más comunes son «потому что» (la más neutra y frecuente) y «так как»/«поскольку» (más formales, típicas de textos escritos).",
    russianEquivalent: "причинный союз",
    transcription: "prichínnyy sayús",
    category: "conjunciones",
    examples: [
      { es: "No fui a la fiesta porque estaba enfermo.", ru: "Я не пошёл на вечеринку, потому что был болен." },
      { es: "Como llovía mucho, cancelaron el partido.", ru: "Так как шёл сильный дождь, матч отменили." },
    ],
    relatedLessons: ["a2-5", "b2-16"],
  },
  {
    slug: "conjuncion-condicional",
    term: "conjunción condicional",
    definition:
      "Es la conjunción que introduce una condición, como «si» en español. En ruso es «если». Cuando la condición es hipotética o contraria a la realidad («si tuviera dinero...»), el ruso añade la partícula «бы» junto al verbo en pasado: «если бы у меня были деньги...».",
    russianEquivalent: "условный союз",
    transcription: "uslóvnyy sayús",
    category: "conjunciones",
    russianComparison:
      "El español cambia de modo verbal (indicativo / subjuntivo) para marcar si la condición es real o hipotética. El ruso, en cambio, no tiene subjuntivo: usa siempre el pasado + la partícula «бы» para marcar lo hipotético, sin importar si se refiere a presente, pasado o futuro imaginado.",
    examples: [
      { es: "Si llueve, me quedaré en casa.", ru: "Если пойдёт дождь, я останусь дома." },
      { es: "Si tuviera más tiempo, aprendería piano.", ru: "Если бы у меня было больше времени, я бы учился играть на пианино." },
    ],
    relatedLessons: ["b1-4"],
  },
  {
    slug: "particula-modal",
    term: "partícula modal",
    definition:
      "Es una palabra corta e invariable que no se traduce sola, pero cambia el tono o matiz de la frase: énfasis, duda, suavidad, sorpresa. En ruso son muy frecuentes: «же» (énfasis: «ведь я же говорил» — si es que ya te lo dije), «ли» (marca de pregunta indirecta o duda), «бы» (condicional/deseo), «-то» (algo impreciso, como «un tal»).",
    russianEquivalent: "модальная частица",
    transcription: "madál'naya chastítsa",
    category: "otros",
    russianComparison:
      "El español expresa estos matices con entonación, adverbios («si es que», «acaso») o el orden de palabras, pero rara vez con una palabra dedicada y pegada al verbo como el ruso. Por eso las partículas modales suelen «desaparecer» al traducir al español y son difíciles de notar para un hispanohablante que lee ruso.",
    examples: [
      { es: "¡Si ya te lo había dicho!", ru: "Я же тебе говорил!" },
      { es: "Alguien llamó, no sé quién.", ru: "Кто-то звонил, не знаю кто." },
    ],
    relatedLessons: ["b1-1", "b2-29"],
  },
  {
    slug: "interjeccion",
    term: "interjección",
    definition:
      "Es una palabra corta que expresa una emoción o reacción espontánea, sin formar parte de la estructura gramatical de la frase: dolor, sorpresa, alegría, dolor. En español: «¡ay!», «¡uy!», «¡vaya!». En ruso: «ой» (sorpresa o dolor leve), «ах» (asombro, a veces pena), «ура» (¡viva!).",
    russianEquivalent: "междометие",
    transcription: "mizhdamyétiye",
    category: "otros",
    examples: [
      { es: "¡Ay! Me pillé el dedo con la puerta.", ru: "Ой! Я прищемил палец дверью." },
      { es: "¡Viva! ¡Ganamos el partido!", ru: "Ура! Мы выиграли матч!" },
    ],
    relatedLessons: ["a1-3"],
  },
  {
    slug: "palabra-parentetica",
    term: "palabra parentética (вводное слово)",
    definition:
      "Es una palabra o expresión que se inserta en la frase para dar la opinión, actitud o grado de certeza del hablante, sin ser parte gramatical de la oración: «por suerte», «claro», «al parecer». En ruso siempre se marca con comas por ambos lados: «конечно» (claro), «кажется» (al parecer, parece que), «к счастью» (por suerte).",
    russianEquivalent: "вводное слово",
    transcription: "vvódnaye slóva",
    category: "otros",
    russianComparison:
      "En español estas expresiones no siempre llevan coma obligatoria, pero en ruso la coma es una regla ortográfica estricta: toda «вводное слово» se separa con comas del resto de la frase, algo que muchos estudiantes olvidan al escribir.",
    examples: [
      { es: "Por suerte, no perdimos el tren.", ru: "К счастью, мы не опоздали на поезд." },
      { es: "Parece que va a llover.", ru: "Кажется, будет дождь." },
    ],
    relatedLessons: ["a2-1"],
  },
  {
    slug: "construccion-participial",
    term: "construcción participial (причастный оборот)",
    definition:
      "Es un participio junto con las palabras que lo acompañan (complementos), que en conjunto funcionan como una oración de relativo reducida. Equivale a una frase con «que + verbo» en español: «el libro que está en la mesa» = «книга, лежащая на столе».",
    russianEquivalent: "причастный оборот",
    transcription: "prichástnyy abarót",
    category: "participios-gerundios",
    russianComparison:
      "El español prefiere casi siempre la oración de relativo completa («el hombre que lee un libro»), mientras que el ruso escrito usa mucho el participio con su complemento como una sola unidad compacta («читающий книгу человек» o «человек, читающий книгу»), típico de un registro más formal o literario.",
    examples: [
      { es: "El estudiante que escribe la carta es mi amigo.", ru: "Студент, пишущий письмо, — мой друг." },
      { es: "Vimos la casa construida el año pasado.", ru: "Мы увидели дом, построенный в прошлом году." },
    ],
    relatedLessons: ["b2-10", "b2-12"],
  },
  {
    slug: "construccion-de-gerundio",
    term: "construcción de gerundio (деепричастный оборот)",
    definition:
      "Es un gerundio (деепричастие) junto con las palabras que lo acompañan, que describe una acción secundaria simultánea o previa a la acción principal, realizada por el MISMO sujeto. Equivale a «-ando/-iendo» en español cuando el sujeto de ambas acciones es el mismo: «leyendo el periódico, tomaba café» = «читая газету, он пил кофе».",
    russianEquivalent: "деепричастный оборот",
    transcription: "diyeprichástnyy abarót",
    category: "participios-gerundios",
    russianComparison:
      "En español el gerundio («-ando/-iendo») se usa con más libertad y a veces con sujetos distintos al de la frase principal (uso más laxo). En ruso, el деепричастие exige estrictamente que las dos acciones tengan el MISMO sujeto — usarlo con sujetos distintos es un error gramatical grave, a diferencia del español.",
    examples: [
      { es: "Leyendo el periódico, él tomaba café.", ru: "Читая газету, он пил кофе." },
      { es: "Saliendo de casa, se dio cuenta de que había olvidado las llaves.", ru: "Выходя из дома, он понял, что забыл ключи." },
    ],
    relatedLessons: ["b2-11"],
  },
  {
    slug: "jerga-juvenil",
    term: "jerga juvenil",
    definition:
      "Es el vocabulario informal usado sobre todo por gente joven, que cambia rápido con las modas y suele venir de préstamos del inglés o de juegos de palabras. En ruso: «крутой» (genial, guay), «тусовка» (quedada, reunión informal), «чилить» (relajarse, del inglés «chill»).",
    russianEquivalent: "молодёжный сленг",
    transcription: "maladyózhnyy slyenk",
    category: "registro-estilo",
    examples: [
      { es: "Esta fiesta está genial.", ru: "Эта тусовка просто крутая." },
      { es: "Voy a relajarme en casa este finde.", ru: "Я собираюсь чилить дома в эти выходные." },
    ],
    relatedLessons: ["b1-25"],
  },
  {
    slug: "arcaismo",
    term: "arcaísmo",
    definition:
      "Es una palabra o forma antigua que ya no se usa en el habla cotidiana, pero que aparece en textos literarios, religiosos o históricos, o de forma irónica/solemne. En ruso: «сей» (este, antiguo), «очи» (ojos, poético), «уста» (labios/boca, poético).",
    russianEquivalent: "архаизм",
    transcription: "arkhaízm",
    category: "registro-estilo",
    examples: [
      { es: "Sus ojos (poético: sus «ojos» arcaicos) brillaban de emoción.", ru: "Её очи сияли от волнения." },
      { es: "En este (arcaico: «este mismo») lugar nació el poeta.", ru: "На сём месте родился поэт." },
    ],
    // Was ["c1-3"] — a dead link: there is no C1 level (levelSlugs is
    // ["a1","a2","b1","b2"], 120 lessons total), so this term rendered no
    // lesson links at all. b2-4 is the one lesson that actually teaches
    // this: it names the archaic vocabulary layer (очи/уста/чело/ланиты)
    // and frames it as a recognition-only skill — the same очи/уста this
    // entry uses as its own examples. Deliberately just one lesson: b1-21
    // calls the gerund «будучи» arcaic in passing and b2-11/b2-25 deal
    // with formal register (which is not the same as archaic), so linking
    // them would pad the block with lessons a reader would open and not
    // find the concept in.
    relatedLessons: ["b2-4"],
  },
  {
    slug: "par-nesti-nosit",
    term: "нести / носить",
    definition:
      "Es otro par de verbos de movimiento, esta vez para «llevar (cargando algo)»: «нести» describe llevar algo en una dirección concreta, una sola vez (unidireccional); «носить» describe llevar algo de forma habitual, repetida o en varias direcciones (multidireccional) — y también significa «llevar puesto» (ropa).",
    russianEquivalent: "нести / носить",
    transcription: "nyestí / nasít'",
    category: "verbos-movimiento",
    examples: [
      { es: "Ahora mismo llevo (cargando) una caja pesada a la oficina.", ru: "Сейчас я несу тяжёлую коробку в офис." },
      { es: "Ella siempre lleva puesto un abrigo azul.", ru: "Она всегда носит синее пальто." },
    ],
    relatedLessons: ["a2-20"],
  },
  {
    // The base pair, and the one entry this series was missing: ехать/
    // ездить, бежать/бегать, лететь/летать, плыть/плавать and нести/носить
    // each had a lexical entry, while идти/ходить — the pair a learner
    // meets first, in a2-14 — had none. par-ehat-ezdit's own comparison
    // already sends the reader to "идти/ходить" and had nowhere to point.
    slug: "par-idti-hodit",
    term: "идти / ходить",
    definition:
      "Es el par de verbos de movimiento del que salen todos los demás: «идти» describe un desplazamiento a pie en una sola dirección, en curso o hacia un destino concreto; «ходить» describe ese mismo desplazamiento a pie cuando es habitual, repetido o de ida y vuelta. Los dos se usan solo para moverse sin vehículo.",
    russianEquivalent: "идти / ходить",
    transcription: "idtí / khadít'",
    category: "verbos-movimiento",
    russianComparison:
      "El español reparte con un solo verbo, «ir», lo que el ruso obliga a dividir en dos: «voy a la escuela» sirve igual para ahora mismo y para todos los días. Dos atajos prácticos: si cabe «estoy de camino ahora», es «идти»; si cabe «suelo ir», es «ходить». En pasado la diferencia se nota aún más — «я ходил в магазин» significa que fui y ya volví, mientras que «я шёл в магазин» describe estar de camino en aquel momento.",
    examples: [
      { es: "Voy a la escuela (ahora, de camino).", ru: "Я иду в школу." },
      { es: "Voy a la escuela todos los días.", ru: "Я хожу в школу каждый день." },
    ],
    relatedLessons: ["a2-14", "a2-18"],
  },
  {
    slug: "genitivo-de-cantidad",
    term: "genitivo de cantidad",
    definition:
      "Es el uso del caso genitivo después de números y palabras de cantidad. La forma exacta depende del número: después de «1» el sustantivo va en nominativo singular; después de «2, 3, 4» va en genitivo SINGULAR; después de «5» en adelante (y después de «много», «мало», «сколько») va en genitivo PLURAL.",
    russianEquivalent: "родительный падеж количества",
    transcription: "radítyel'nyy padyésh kalíchistva",
    category: "casos",
    russianComparison:
      "En español el sustantivo casi nunca cambia de forma después de un número («un libro», «dos libros», «cinco libros» — solo cambia singular/plural). En ruso la terminación del sustantivo cambia tres veces según el número: «одна книга», «две книги», «пять книг» — un obstáculo real para hispanohablantes que no están acostumbrados a que el número «elija» la forma del sustantivo.",
    examples: [
      { es: "Tengo dos hermanas y cinco amigos.", ru: "У меня две сестры и пять друзей." },
      { es: "En la mesa había tres manzanas.", ru: "На столе было три яблока." },
    ],
    relatedLessons: ["a1-20"],
  },
  {
    slug: "instrumental-de-medio",
    term: "instrumental de medio",
    definition:
      "Es el uso del caso instrumental, SIN preposición, para indicar la herramienta o el medio con el que se hace algo. Equivale a «con + sustantivo» en español, pero en ruso no lleva ninguna preposición: solo la terminación del sustantivo cambia.",
    russianEquivalent: "творительный падеж орудия действия",
    transcription: "tvarítyel'nyy padyésh arúdiya dyéystviya",
    category: "casos",
    russianComparison:
      "En español siempre se necesita la preposición «con» para expresar el instrumento («escribo con un bolígrafo»). En ruso esa idea se expresa solo con la terminación del caso instrumental, sin ninguna preposición: «пишу ручкой» (literalmente «escribo bolígrafo-INSTRUMENTAL»). Añadir «с» aquí sería un error.",
    examples: [
      { es: "Escribo la carta con un bolígrafo.", ru: "Я пишу письмо ручкой." },
      { es: "Cortó el pan con un cuchillo.", ru: "Он разрезал хлеб ножом." },
    ],
    relatedLessons: ["a1-26"],
  },
  {
    slug: "dativo-de-direccion",
    term: "dativo de dirección (к + dativo)",
    definition:
      "Es el uso de la preposición «к» con el caso dativo para indicar movimiento HACIA una persona o un lugar (sin llegar a entrar), como «hacia» o «a casa de» en español. Es distinto del acusativo de dirección, que se usa con «в»/«на» cuando sí se entra a un lugar.",
    russianEquivalent: "дательный падеж направления (к + дательный)",
    transcription: "datyél'nyy padyésh napravlyéniya",
    category: "casos",
    russianComparison:
      "El español usa «a» o «hacia» tanto para ir HACIA una persona como para entrar en un lugar, sin distinguir gramaticalmente los dos casos. El ruso sí distingue: «к» + dativo para acercarse a alguien o algo sin entrar («voy a casa de mi abuela» — иду к бабушке), y «в»/«на» + acusativo para entrar en un lugar («voy a la tienda» — иду в магазин).",
    examples: [
      { es: "Voy a casa de mi abuela este fin de semana.", ru: "В эти выходные я еду к бабушке." },
      { es: "El tren se acerca a la estación.", ru: "Поезд подъезжает к станции." },
    ],
    relatedLessons: ["a2-14"],
  },
  {
    slug: "acusativo-de-direccion",
    term: "acusativo de dirección (в/на + acusativo)",
    definition:
      "Es el uso de las preposiciones «в» o «на» con el caso acusativo para indicar movimiento hacia DENTRO o ENCIMA de un lugar, como respuesta a la pregunta «¿adónde?». Se distingue del uso de «в»/«на» con el caso preposicional, que responde a «¿dónde?» e indica ubicación estática, sin movimiento.",
    russianEquivalent: "винительный падеж направления (в/на + винительный)",
    transcription: "vinítyel'nyy padyésh napravlyéniya",
    category: "casos",
    russianComparison:
      "El español usa «en» tanto para ubicación («estoy en la tienda») como, con verbos de movimiento y la preposición «a», para dirección («voy a la tienda»), sin cambiar la forma del sustantivo. El ruso usa la MISMA preposición «в»/«на» para ambas ideas, pero cambia el CASO: preposicional para ubicación estática («я в магазине»), acusativo para movimiento hacia allí («я иду в магазин») — el caso, no la preposición, es lo que marca la diferencia.",
    examples: [
      { es: "Voy a la tienda a comprar pan.", ru: "Я иду в магазин за хлебом." },
      { es: "Puso el libro en la mesa.", ru: "Он положил книгу на стол." },
    ],
    relatedLessons: ["a1-14"],
  },
  {
    slug: "preposicional-de-tema",
    term: "preposicional de tema (о/об + preposicional)",
    definition:
      "Es el uso de la preposición «о» (u «об» antes de vocal) con el caso preposicional para indicar el TEMA del que se habla, piensa o escribe. Equivale a «de/sobre» en español: «hablar de algo» = «говорить о чём-то».",
    russianEquivalent: "предложный падеж темы (о/об + предложный)",
    transcription: "pryedlózhnyy padyésh tyémy",
    category: "casos",
    examples: [
      { es: "Ellos hablaban de sus planes de vacaciones.", ru: "Они говорили о своих планах на отпуск." },
      { es: "Escribí un artículo sobre el clima.", ru: "Я написал статью о погоде." },
    ],
    relatedLessons: ["a1-12"],
  },
  {
    slug: "genitivo-posesivo",
    term: "genitivo posesivo",
    definition:
      "Es el uso del caso genitivo, sin preposición, para indicar de quién es algo o a qué pertenece algo. Equivale a «de + persona» en español: «el libro de mi hermano» = «книга брата».",
    russianEquivalent: "родительный падеж принадлежности",
    transcription: "radítyel'nyy padyésh prinadlyézhnasti",
    category: "casos",
    russianComparison:
      "El español necesita siempre la preposición «de» para marcar posesión («la casa de mi amigo»). El ruso no usa ninguna preposición aquí: solo cambia la terminación de la palabra que indica el poseedor, colocada después del sustantivo poseído: «дом друга» (literalmente «casa amigo-GENITIVO»).",
    examples: [
      { es: "Este es el coche de mi padre.", ru: "Это машина моего отца." },
      { es: "La puerta de la casa estaba abierta.", ru: "Дверь дома была открыта." },
    ],
    relatedLessons: ["a1-18", "a2-30"],
  },
  {
    slug: "instrumental-de-compania",
    term: "instrumental de compañía (с + instrumental)",
    definition:
      "Es el uso de la preposición «с» («con») junto con el caso instrumental para indicar con QUIÉN se hace algo, es decir, compañía. No debe confundirse con el instrumental de medio, que no lleva preposición: aquí sí es obligatoria la preposición «с» porque se trata de una persona que acompaña, no de una herramienta.",
    russianEquivalent: "творительный падеж совместности (с + творительный)",
    transcription: "tvarítyel'nyy padyésh savmyéstnasti",
    category: "casos",
    russianComparison:
      "Aquí el ruso sí usa preposición, igual que el español «con», pero conviene contrastarlo con el instrumental de medio (sin preposición): «пишу ручкой» (con un bolígrafo, herramienta, SIN «с») frente a «иду с другом» (con un amigo, compañía, CON «с»). La misma idea de «con» en español corresponde a dos construcciones distintas en ruso según sea herramienta o persona.",
    examples: [
      { es: "Fui al cine con mi amiga.", ru: "Я пошёл в кино с подругой." },
      { es: "Tomamos café con leche.", ru: "Мы пили кофе с молоком." },
    ],
    relatedLessons: ["a1-27"],
  },
  {
    slug: "genitivo-partitivo",
    term: "genitivo partitivo",
    definition:
      "Es el uso del caso genitivo para indicar una PARTE de un todo, o una cantidad indefinida de algo, especialmente con líquidos y sustancias. Equivale a «de» en español: «un vaso de agua» = «стакан воды».",
    russianEquivalent: "родительный падеж части целого",
    transcription: "radítyel'nyy padyésh chásti tsélava",
    category: "casos",
    examples: [
      { es: "Quiero un vaso de agua, por favor.", ru: "Я хочу стакан воды, пожалуйста." },
      { es: "Compré una barra de pan.", ru: "Я купил буханку хлеба." },
    ],
    relatedLessons: ["a1-17"],
  },
  {
    slug: "aspecto-en-imperativo",
    term: "aspecto en el imperativo",
    definition:
      "Al dar una orden o petición en ruso, la elección entre aspecto perfectivo e imperfectivo cambia el matiz: el IMPERFECTIVO se usa para invitaciones amables o para pedir que se empiece/continúe una acción en general («Заходи!» — ¡Entra! como invitación cordial), mientras que el PERFECTIVO se usa para una orden concreta, puntual, o más urgente/enfática («Зайди!» — ¡Entra! como orden específica y directa).",
    russianEquivalent: "вид глагола в повелительном наклонении",
    transcription: "vit glagóla v pavyelítyel'nam naklanyénii",
    category: "aspecto",
    russianComparison:
      "El español no distingue el matiz de urgencia o cordialidad mediante un cambio morfológico del verbo en el imperativo (se hace con entonación o palabras como «por favor»). El ruso sí tiene una herramienta gramatical específica para esto: la elección de aspecto, que un hispanohablante debe aprender a manejar activamente y no solo con el tono de voz.",
    examples: [
      { es: "¡Pasa, pasa! (invitación cordial)", ru: "Заходи, заходи!" },
      { es: "¡Cierra la puerta! (orden concreta y directa)", ru: "Закрой дверь!" },
    ],
    relatedLessons: ["a1-9"],
  },
  {
    slug: "gerundio-de-pasado",
    term: "gerundio de pasado (деепричастие прошедшего времени)",
    definition:
      "Es la forma del gerundio ruso (деепричастие) que describe una acción SECUNDARIA ya terminada, ocurrida ANTES de la acción principal — se forma normalmente de verbos perfectivos con el sufijo «-в»/«-вши». Se diferencia del gerundio normal (de presente), que describe una acción simultánea y se forma de verbos imperfectivos con «-я»/«-а».",
    russianEquivalent: "деепричастие прошедшего времени",
    transcription: "diyeprichástiye prashédshiva vryémini",
    category: "participios-gerundios",
    russianComparison:
      "El gerundio español («-ando/-iendo») casi siempre indica simultaneidad, y para una acción previa el español prefiere otra construcción («después de leer», «habiendo leído»). El ruso, en cambio, tiene una forma de gerundio dedicada exclusivamente a la anterioridad («прочитав» — habiendo leído / después de leer), formada del aspecto perfectivo — una distinción morfológica que el español no marca de forma tan sistemática.",
    examples: [
      { es: "Habiendo leído el libro, se lo devolvió a la biblioteca.", ru: "Прочитав книгу, он вернул её в библиотеку." },
      { es: "Habiendo terminado el trabajo, se fue a casa.", ru: "Закончив работу, она пошла домой." },
    ],
    relatedLessons: ["b2-10"],
  },
  {
    slug: "conjuncion-final",
    term: "conjunción final (чтобы)",
    definition:
      "Es la conjunción que introduce una finalidad o propósito, equivalente a «para que» en español. Cuando el sujeto de las dos acciones es el mismo, «чтобы» va seguida de un infinitivo; cuando los sujetos son distintos, va seguida de un verbo en pasado (aunque la acción se refiera al futuro).",
    russianEquivalent: "целевой союз",
    transcription: "tsylyevóy sayús",
    category: "conjunciones",
    russianComparison:
      "El español usa el subjuntivo después de «para que» cuando cambia el sujeto («para que lo leyera»). El ruso no tiene subjuntivo: en su lugar usa siempre el verbo en PASADO después de «чтобы», sin importar si la acción es futura — el mismo mecanismo que se usa en el modo condicional con «бы».",
    examples: [
      { es: "Estudio ruso para viajar a Rusia.", ru: "Я учу русский, чтобы поехать в Россию." },
      { es: "Le di el libro para que lo leyera.", ru: "Я дал ему книгу, чтобы он её прочитал." },
    ],
    relatedLessons: ["b1-8", "b2-17"],
  },
  {
    slug: "conjuncion-concesiva",
    term: "conjunción concesiva (хотя)",
    definition:
      "Es la conjunción que introduce una idea que contrasta con la principal sin anularla, equivalente a «aunque» en español. La más común es «хотя».",
    russianEquivalent: "уступительный союз",
    transcription: "ustupítyel'nyy sayús",
    category: "conjunciones",
    examples: [
      { es: "Aunque llovía, salimos a caminar.", ru: "Хотя шёл дождь, мы пошли гулять." },
      { es: "Compré el vestido, aunque era caro.", ru: "Я купила платье, хотя оно было дорогое." },
    ],
    relatedLessons: ["b1-16"],
  },
  {
    slug: "prefijo-verbal",
    term: "prefijo verbal",
    definition:
      "Es la partícula que se añade al principio de un verbo ruso para cambiar su significado y, casi siempre, convertirlo de imperfectivo a perfectivo. Un mismo verbo base puede dar lugar a muchos verbos distintos según el prefijo: «писать» (escribir) → «написать» (terminar de escribir), «переписать» (reescribir), «дописать» (terminar de escribir lo que faltaba).",
    russianEquivalent: "приставка глагола",
    transcription: "pristávka glagóla",
    category: "otros",
    russianComparison:
      "El español expresa estos matices con verbos o frases distintas («terminar de escribir», «volver a escribir»), mientras que el ruso los codifica dentro de un solo verbo mediante el prefijo — una herramienta sistemática de formación de palabras que el español no tiene de forma tan productiva.",
    examples: [
      { es: "Terminé de escribir la carta.", ru: "Я дописал письмо." },
      { es: "Voy a reescribir el informe.", ru: "Я перепишу отчёт." },
    ],
    relatedLessons: ["b1-2"],
  },
  {
    slug: "sufijo-aumentativo",
    term: "sufijo aumentativo",
    definition:
      "Es el sufijo que se añade a un sustantivo para indicar que algo es grande, exagerado o intenso, a veces con un matiz tosco o cómico — lo contrario del diminutivo. El más común es «-ище»/«-ища»: «дом» (casa) → «домище» (casona enorme), «рука» (mano) → «ручища» (manaza).",
    russianEquivalent: "увеличительный суффикс",
    transcription: "uvyelichítyel'nyy súfiks",
    category: "otros",
    examples: [
      { es: "Vive en una casona enorme.", ru: "Он живёт в домище." },
      { es: "Tiene unas manazas enormes.", ru: "У него ручища." },
    ],
    relatedLessons: ["a2-2"],
  },
  {
    slug: "participio-corto-largo",
    term: "forma corta y larga del participio pasivo",
    definition:
      "El participio pasivo ruso tiene dos formas: la LARGA, que se declina como un adjetivo (cambia según género, número y caso) y se usa antes de un sustantivo, y la CORTA, que solo cambia según género y número (no se declina por caso) y se usa como predicado, después de un sujeto. «закрытая дверь» (la puerta cerrada, forma larga, atributiva) frente a «Дверь закрыта» (la puerta está cerrada, forma corta, predicado).",
    russianEquivalent: "краткая и полная форма причастия",
    transcription: "krátkaya i pólnaya fórma prichástiya",
    category: "participios-gerundios",
    russianComparison:
      "En español, el participio usado como adjetivo tiene una sola forma tanto delante del sustantivo como en el predicado: «la puerta cerrada» / «la puerta está cerrada» — siempre «cerrada». En ruso son dos formas morfológicamente distintas («закрытая» / «закрыта»), y elegir la incorrecta suena claramente mal a un hablante nativo.",
    examples: [
      { es: "La puerta cerrada está a la izquierda.", ru: "Закрытая дверь находится слева." },
      { es: "La puerta está cerrada.", ru: "Дверь закрыта." },
    ],
    relatedLessons: ["b1-20"],
  },
  {
    slug: "aspecto-en-negacion",
    term: "aspecto en la negación",
    definition:
      "Al negar, la elección de aspecto cambia el sentido, y funciona de dos maneras distintas según el modo. EN EL IMPERATIVO: el imperfectivo prohíbe la acción en general («Не хлопай дверью!», no des portazos), mientras que el perfectivo advierte contra un accidente («Не разбей вазу!», cuidado, no vayas a romper el jarrón). EN EL INDICATIVO: el imperfectivo es la opción neutra, la que simplemente dice que algo no ocurrió («Я не читал эту книгу», no he leído este libro); el perfectivo añade un matiz — un intento que no llegó a su resultado («Я не прочитал книгу до конца», no llegué a terminar el libro) o una expectativa incumplida («Автобус не пришёл», el autobús no llegó, aunque se le esperaba).",
    russianEquivalent: "вид глагола в отрицании",
    transcription: "vit glagóla v atritsánii",
    category: "aspecto",
    russianComparison:
      "El español no distingue gramaticalmente ninguna de las dos cosas: «prohibir en general» y «advertir contra un accidente» se dicen igual con el imperativo negativo más el tono o un «cuidado», y «no leí el libro» sirve tanto para el hecho neutro como para el intento fallido. El ruso marca ambas distinciones con la misma herramienta, la elección de aspecto. Regla práctica al negar en indicativo: si solo estás diciendo que algo no pasó, imperfectivo; si quieres dar a entender que se intentó y no salió, o que se esperaba y no ocurrió, perfectivo.",
    examples: [
      { es: "No des portazos (prohibición general, imperativo).", ru: "Не хлопай дверью!" },
      { es: "¡Cuidado, no rompas el jarrón! (advertencia, imperativo).", ru: "Осторожно, не разбей вазу!" },
      { es: "No he leído este libro (hecho neutro, indicativo).", ru: "Я не читал эту книгу." },
      { es: "No llegué a terminar el libro (intento sin resultado, indicativo).", ru: "Я не прочитал книгу до конца." },
    ],
    relatedLessons: ["a1-9", "b1-18"],
  },
  {
    slug: "aspecto-en-pasado-habitual",
    term: "aspecto en el pasado habitual",
    definition:
      "En pasado, el IMPERFECTIVO se usa para acciones repetidas o habituales, sin destacar un resultado concreto («solía llamarme»), mientras que el PERFECTIVO se usa para una acción única y completada, con un resultado visible («me llamó [una vez] y me contó la noticia»).",
    russianEquivalent: "вид глагола в прошедшем времени при повторяющемся действии",
    transcription: "vit glagóla v prashédshym vryémini pri pavtaryáyushchimsya dyéystvii",
    category: "aspecto",
    examples: [
      { es: "De niño, iba a la playa todos los veranos.", ru: "В детстве я каждое лето ездил на пляж." },
      { es: "Ayer me llamó y me contó la noticia.", ru: "Вчера он позвонил мне и рассказал новость." },
    ],
    relatedLessons: ["a2-1"],
  },
  {
    // b1-17 is a whole lesson on this and had no term in its own category:
    // its only link was `verbo-modal`, which is about modality, not aspect.
    // verbo-modal's comparison even points forward at "hay que elegir el
    // ASPECTO del infinitivo" with nothing to point to.
    slug: "aspecto-del-infinitivo",
    term: "aspecto del infinitivo",
    definition:
      "Es la elección de aspecto del infinitivo que sigue a otro verbo — y no es libre, la rige el verbo de delante. Los verbos de fase (начать, продолжать, перестать) piden SIEMPRE infinitivo imperfectivo; los de logro puntual (успеть, решить, удаться) piden casi siempre perfectivo; y los modales propios (мочь, хотеть, уметь) admiten los dos, cambiando el sentido de la frase.",
    russianEquivalent: "вид инфинитива после другого глагола",
    transcription: "vit infinitíva pósli drugóva glagóla",
    category: "aspecto",
    russianComparison:
      "El infinitivo español no marca aspecto: en «empezar a leer» y «conseguir leer» lo que cambia es el verbo de delante, nunca la forma de «leer». En ruso cambia el infinitivo, y a veces es lo único que cambia: «Я не мог поднять чемодан» dice que no tenía fuerza en general, «Я не смог поднять чемодан» dice que aquella vez lo intenté y no pude. Con los verbos de fase no hay elección posible — «начал прочитать» es agramatical, mientras que en español «empezar a terminar de leer» solo suena raro.",
    examples: [
      { es: "Empezó a leer el libro.", ru: "Он начал читать книгу." },
      { es: "Conseguí terminar el trabajo a tiempo.", ru: "Я успел закончить работу вовремя." },
    ],
    relatedLessons: ["b1-17"],
  },
  {
    slug: "estilo-poetico",
    term: "estilo poético/literario",
    definition:
      "Es el registro elevado propio de la poesía y la prosa literaria de alto nivel, marcado por un orden de palabras inusual (a menudo invertido), vocabulario elevado y, a veces, formas arcaicas. A diferencia del arcaísmo (que es específicamente una palabra anticuada), el estilo poético puede usar palabras totalmente modernas colocadas de forma marcada o inesperada.",
    russianEquivalent: "поэтический стиль",
    transcription: "paetíchyeskiy stíl'",
    category: "registro-estilo",
    examples: [
      { es: "¡Te amo, oh patria mía!", ru: "Люблю тебя, о родина моя!" },
      { es: "El viento cantaba entre los árboles.", ru: "Пел ветер меж деревьев." },
    ],
    // Was ["c1-1"] — same dead C1 link as `arcaismo` above. b2-4 is again
    // the real lesson: it teaches the inverted word order used for poetic
    // emphasis («Тихо шумел лес»), the elevated vocabulary, and the four
    // stylistic figures — i.e. exactly the register this entry defines.
    // b2-28 was considered and rejected: it teaches how to JUDGE a work
    // (гениальный/посредственный), not the literary register itself, and
    // the lesson text itself draws that line against b2-4.
    relatedLessons: ["b2-4"],
  },
  {
    slug: "caso-vocativo",
    term: "caso vocativo (звательный падеж)",
    definition:
      "Es un caso antiguo, ya casi desaparecido del ruso moderno, que se conserva en un puñado de formas fijas y arcaicas de invocación religiosa o poética («Господи!» — ¡Dios mío!, «Боже!» — ¡Dios!). De forma informal, el ruso coloquial actual también crea un «vocativo truncado»: se corta la vocal final de un nombre al dirigirse directamente a alguien («Кать!» de Катя, «Маш!» de Маша, «Пап!» de папа).",
    russianEquivalent: "звательный падеж",
    transcription: "zvátyel'nyy padyésh",
    category: "casos",
    russianComparison:
      "El español no tiene una forma morfológica distinta para el vocativo: el nombre no cambia, solo se marca con entonación o coma («¡Katia, ven aquí!»). El ruso históricamente sí tenía una forma de caso dedicada a esto, y de manera informal conserva ese impulso hoy en el habla coloquial.",
    examples: [
      { es: "¡Dios mío, ayúdame!", ru: "Господи, помоги мне!" },
      { es: "¡Kate, ven aquí!", ru: "Кать, иди сюда!" },
    ],
    relatedLessons: ["a1-1"],
  },
  // ── Bloque A1/A2 (2026-08-28) ──────────────────────────────────────
  // Written for the A1/A2 lessons that had no glossary term at all. Each
  // entry below corresponds to a lesson that actually TEACHES the concept,
  // not one that merely mentions the word — the same bar applied to
  // `diminutivo`, which stays empty because no lesson teaches it.
  // Transcriptions follow the standard recorded in PROGRESS.md: actual
  // pronunciation, not the letters (final devoicing, reduction after hard
  // hushing consonants, live-speech stress).
  {
    slug: "verbo-modal",
    term: "verbo modal",
    definition:
      "Es un verbo que no describe una acción por sí mismo, sino la actitud del hablante hacia otra acción — querer, poder, saber hacer algo — y por eso va seguido de un infinitivo. Los tres básicos del ruso son «хотеть» (querer), «мочь» (poder) y «уметь» (saber hacer, tener la destreza).",
    russianEquivalent: "модальный глагол",
    transcription: "madál'nyy glagól",
    category: "partes-de-la-oracion",
    russianComparison:
      "La construcción es paralela a la española: verbo modal conjugado + infinitivo invariable («quiero comer» / «Я хочу есть»). La diferencia aparece más adelante: en ruso también hay que elegir el ASPECTO del infinitivo que sigue, algo que el español no pide nunca.",
    examples: [
      { es: "Quiero beber agua.", ru: "Я хочу пить воду." },
      { es: "No puedo ayudarte hoy.", ru: "Я не могу тебе помочь сегодня." },
    ],
    relatedLessons: ["a1-10", "b1-17"],
  },
  {
    slug: "verbo-irregular",
    term: "verbo irregular",
    definition:
      "Es un verbo cuya conjugación no sigue ninguno de los dos modelos regulares del ruso, de modo que sus formas deben aprenderse de memoria una por una. Los casos más frecuentes del nivel inicial son «хотеть» (querer), que además cambia de modelo entre singular y plural, y «мочь» (poder), con alternancia de consonante en la raíz.",
    russianEquivalent: "неправильный глагол",
    transcription: "nyepravíl'nyy glagól",
    category: "partes-de-la-oracion",
    russianComparison:
      "El español también tiene verbos irregulares muy frecuentes (ser, ir, tener), así que la idea no es nueva. Lo que sí es nuevo es el tipo de irregularidad: el ruso suele alterar la CONSONANTE final de la raíz (могу / можешь), mientras que el español altera sobre todo la vocal (puedo / podemos).",
    examples: [
      { es: "Yo quiero, pero nosotros queremos: la raíz cambia.", ru: "Я хочу, но мы хотим." },
      { es: "Yo puedo, tú puedes: г se convierte en ж.", ru: "Я могу, ты можешь." },
    ],
    relatedLessons: ["a1-5", "a1-10"],
  },
  {
    slug: "acusativo-de-tiempo",
    term: "acusativo de tiempo",
    definition:
      "Es el uso del caso acusativo, tras la preposición «в», para decir EN QUÉ día ocurre algo. Afecta sobre todo a los días femeninos, que cambian su terminación -а por -у: среда → в среду (el miércoles), суббота → в субботу (el sábado).",
    russianEquivalent: "винительный падеж времени",
    transcription: "vinítyel'nyy padyésh vryémini",
    category: "casos",
    russianComparison:
      "En español la palabra no cambia nunca: «el lunes», «el miércoles» — solo se añade el artículo. El ruso usa la misma preposición «в» para todos los días, pero obliga a poner el nombre del día en acusativo. Y ojo: para los meses NO se usa acusativo sino preposicional (в январе), así que la preposición «в» sola no basta para saber qué caso toca.",
    examples: [
      { es: "El miércoles voy al médico.", ru: "В среду я иду к врачу." },
      { es: "Trabajo el sábado.", ru: "Я работаю в субботу." },
    ],
    relatedLessons: ["a1-19"],
  },
  {
    slug: "adjetivo-corto",
    term: "adjetivo corto",
    definition:
      "Es la forma reducida del adjetivo, sin la terminación completa, que en ruso solo puede funcionar como predicado — nunca delante del sustantivo. Concuerda en género y número con aquello de lo que se habla: рад/рада/рады (contento), нужен/нужна/нужно/нужны (necesario), согласен/согласна/согласны (de acuerdo).",
    russianEquivalent: "краткое прилагательное",
    transcription: "krátkaye prilagátyel'naye",
    category: "partes-de-la-oracion",
    russianComparison:
      "El español no tiene nada equivalente: «contento» es la misma palabra en «un niño contento» y en «el niño está contento». En ruso son dos formas distintas y no son intercambiables. La trampa mayor está en «нужен»: concuerda con la COSA necesitada, no con quien la necesita («Мне нужен билет» — literalmente «a mí es-necesario un billete»), justo al revés que el español, donde «necesito» se conjuga según quien necesita.",
    examples: [
      { es: "Necesito un billete.", ru: "Мне нужен билет." },
      { es: "Estoy de acuerdo contigo.", ru: "Я согласен с тобой." },
    ],
    relatedLessons: ["a1-30", "b1-3", "b2-8"],
  },
  {
    slug: "adverbio-predicativo",
    term: "adverbio predicativo",
    definition:
      "Es una palabra terminada en -о que funciona como el núcleo de una oración sin sujeto ni verbo: холодно (hace frío), жарко (hace calor), трудно (es difícil), интересно (es interesante). Es la forma normal de hablar del clima, del entorno y de los estados en ruso.",
    russianEquivalent: "предикативное наречие",
    transcription: "pryedikatívnaye naryéchiye",
    category: "partes-de-la-oracion",
    russianComparison:
      "Aquí el contraste es máximo: el español necesita siempre un verbo, casi siempre «hacer» o «ser» («hace frío», «es difícil»). El ruso no pone ningún verbo en presente — «Холодно» es una oración completa de una sola palabra. El verbo solo reaparece en pasado o futuro, en forma neutra: «Было холодно» (hacía frío), «Будет холодно» (hará frío).",
    examples: [
      { es: "Hace frío afuera.", ru: "На улице холодно." },
      { es: "Ayer hacía calor.", ru: "Вчера было жарко." },
    ],
    relatedLessons: ["a2-4", "b1-7"],
  },
  {
    slug: "preposicion-v-na",
    term: "preposiciones «в» y «на» de lugar",
    definition:
      "Son las dos preposiciones básicas de ubicación, ambas seguidas de caso preposicional. «В» sitúa algo DENTRO de un espacio cerrado (в доме, en la casa) y «на» sobre una superficie o en un espacio abierto, un evento o una actividad (на улице, en la calle; на работе, en el trabajo; на концерте, en el concierto).",
    russianEquivalent: "предлоги «в» и «на»",
    transcription: "predlógi «v» i «na»",
    category: "casos",
    russianComparison:
      "El español resuelve ambas con un solo «en»: «en la casa», «en la calle», «en el trabajo». Por eso la elección no se puede deducir traduciendo — hay que aprenderla palabra por palabra, y algunas asignaciones no tienen ninguna lógica visible desde fuera (на почте, en la oficina de correos, pero в банке, en el banco).",
    examples: [
      { es: "Vivo en una casa nueva.", ru: "Я живу в новом доме." },
      { es: "Hoy trabajo en casa, no en el trabajo.", ru: "Сегодня я работаю дома, а не на работе." },
    ],
    relatedLessons: ["a2-6"],
  },
  {
    slug: "tema-duro-y-blando",
    term: "tema duro y tema blando",
    definition:
      "Es la división básica de adjetivos y sustantivos rusos en dos grupos según cómo termina su raíz, y de ella depende cuál de las dos series de terminaciones se usa en TODOS los casos. Los adjetivos de tema duro toman -ый/-ым/-ого (новый → новым), los de tema blando toman -ий/-им/-его (синий → синим).",
    russianEquivalent: "твёрдая и мягкая основа",
    transcription: "tvyórdaya i myáhkaya asnóva",
    category: "otros",
    russianComparison:
      "El español no tiene nada parecido: un adjetivo español no cambia según cómo suene su raíz. Conviene aprender la pareja de terminaciones a la vez (-ым/-им, -ого/-его, -ому/-ему) en lugar de memorizar dos sistemas separados: es una sola regla que se repite en todos los casos.",
    examples: [
      { es: "con el amigo nuevo (tema duro)", ru: "с новым другом" },
      { es: "con el bolígrafo azul (tema blando)", ru: "с синим карандашом" },
    ],
    relatedLessons: ["a2-11"],
  },
  {
    slug: "regimen-preposicional",
    term: "régimen preposicional",
    definition:
      "Es la regla, fija para cada preposición, de qué caso debe llevar el sustantivo que va detrás. No se deduce del significado: «благодаря» (gracias a) pide dativo, «из-за» (por culpa de) pide genitivo, «между» (entre) pide instrumental. La preposición y su caso se aprenden siempre como un solo bloque.",
    russianEquivalent: "предложное управление",
    transcription: "predlózhnaye upravlyéniye",
    category: "casos",
    russianComparison:
      "En español ninguna preposición cambia la forma del sustantivo: «según él», «entre la casa y la escuela». Por eso el hispanohablante tiende a fijarse solo en el significado de la preposición y a olvidar el caso. Dos atajos útiles: la mayoría de las preposiciones compuestas piden genitivo (вокруг, напротив, после), y el pequeño grupo espacial над/под/между/перед pide siempre instrumental.",
    examples: [
      { es: "Gracias a tu ayuda (dativo).", ru: "Благодаря твоей помощи." },
      { es: "Por culpa del mal tiempo (genitivo).", ru: "Из-за плохой погоды." },
    ],
    relatedLessons: ["a2-12"],
  },
  {
    slug: "orden-de-palabras",
    term: "orden de palabras",
    definition:
      "Es la posición de las palabras dentro de la oración. En ruso no marca quién es el sujeto y quién el objeto — de eso se encargan los casos — así que queda libre para otra función: colocar al final lo que se quiere destacar como información nueva.",
    russianEquivalent: "порядок слов",
    transcription: "paryádak slof",
    category: "otros",
    russianComparison:
      "En español el orden es la principal marca de función: «Mamá quiere al hijo» y «Al hijo quiere mamá» no se pueden intercambiar sin más. En ruso «Мама любит сына» y «Сына любит мама» significan exactamente lo mismo, porque la terminación -а de «сына» ya dice que es el objeto. Lo que cambia entre las dos versiones no es el sentido, sino el énfasis.",
    examples: [
      { es: "Mamá quiere al hijo. / Al hijo lo quiere mamá.", ru: "Мама любит сына. / Сына любит мама." },
      { es: "El bosque susurraba en silencio (orden invertido, énfasis poético).", ru: "Тихо шумел лес." },
    ],
    relatedLessons: ["a2-13", "b2-4"],
  },
  {
    slug: "par-letet-letat",
    term: "лететь / летать",
    definition:
      "Es el par de verbos de movimiento para «volar»: «лететь» describe un vuelo concreto, ahora y en una sola dirección (unidireccional); «летать» describe volar de forma habitual, repetida o como capacidad general (multidireccional). Se conjugan de forma distinta: лечу, летишь, летит frente a летаю, летаешь, летает.",
    russianEquivalent: "лететь / летать",
    transcription: "lyetyét' / lyetát'",
    category: "verbos-movimiento",
    examples: [
      { es: "El avión vuela a Moscú (ahora).", ru: "Самолёт летит в Москву." },
      { es: "Vuelo a Moscú a menudo (hábito).", ru: "Я часто летаю в Москву." },
    ],
    relatedLessons: ["a2-17", "a2-18"],
  },
  {
    slug: "par-plyt-plavat",
    term: "плыть / плавать",
    definition:
      "Es el par de verbos de movimiento para «nadar» y «navegar»: «плыть» describe el desplazamiento concreto, ahora y en una dirección (unidireccional); «плавать» describe nadar de forma habitual o saber nadar como capacidad (multidireccional). Sirve tanto para personas como para embarcaciones.",
    russianEquivalent: "плыть / плавать",
    transcription: "plyt' / plávat'",
    category: "verbos-movimiento",
    examples: [
      { es: "Nada hacia la orilla (ahora).", ru: "Он плывёт к берегу." },
      { es: "Nado por las mañanas (hábito).", ru: "Я плаваю по утрам." },
    ],
    relatedLessons: ["a2-17", "a2-18"],
  },
  {
    slug: "pronombre-indefinido",
    term: "pronombre indefinido",
    definition:
      "Es el pronombre que señala a alguien o algo sin identificarlo: кто-то (alguien), что-то (algo), какой-то (algún, cierto). Se forman añadiendo una partícula invariable a un interrogativo, y solo la parte pronominal se declina — la partícula queda siempre al final: кого-то, кому-то, кем-то.",
    russianEquivalent: "неопределённое местоимение",
    transcription: "nyeapryedyelyónnaye myestaimyéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "«Alguien», «algo» y «algún» no cambian de forma en español. En ruso sí se declinan, y además existe toda una familia paralela de adverbios formados igual (где-то, куда-то, когда-то, почему-то) que el español solo puede traducir con frases de varias palabras: «en algún lugar», «por alguna razón».",
    examples: [
      { es: "Alguien está llamando a la puerta.", ru: "Кто-то звонит в дверь." },
      { es: "Hablé con alguien interesante.", ru: "Я разговаривал с кем-то интересным." },
    ],
    relatedLessons: ["a2-23", "a2-24"],
  },
  {
    slug: "contraste-to-nibud",
    term: "«-то» frente a «-нибудь»",
    definition:
      "Es la regla que decide cuál de las dos partículas indefinidas se usa. «-то» marca algo que EXISTE de verdad aunque no se sepa cuál: se usa para hechos concretos, en pasado o presente. «-нибудь» marca algo cuya existencia todavía está en el aire: preguntas, condiciones, peticiones y futuro.",
    russianEquivalent: "частицы «-то» и «-нибудь»",
    transcription: "chastítsy «-ta» i «-nibút'»",
    category: "partes-de-la-oracion",
    russianComparison:
      "El español no distingue nada de esto: «alguien llamó» y «¿llamó alguien?» usan la misma palabra. Por eso es una categoría genuinamente nueva, y el error típico es usar «-то» en una pregunta. La comprobación rápida: si la frase es una pregunta, una condición con «если», una petición o habla del futuro, toca «-нибудь».",
    examples: [
      { es: "Alguien llamó (hecho: sí ocurrió).", ru: "Кто-то звонил." },
      { es: "¿Llamó alguien? (no se sabe si ocurrió).", ru: "Кто-нибудь звонил?" },
    ],
    relatedLessons: ["a2-23", "a2-24"],
  },
  {
    slug: "pronombre-negativo",
    term: "pronombre negativo",
    definition:
      "Es el pronombre formado con el prefijo «ни-» que niega la existencia de alguien o algo: никто (nadie), ничто/ничего (nada), никакой (ninguno). Se declina en todos los casos (никого, никому, никем) y exige siempre la partícula «не» junto al verbo.",
    russianEquivalent: "отрицательное местоимение",
    transcription: "atritsátyel'naye myestaimyéniye",
    category: "partes-de-la-oracion",
    russianComparison:
      "La trampa está en las preposiciones. El español mantiene la palabra entera y pone la preposición delante: «con nadie», «de nada». El ruso parte el pronombre en dos y mete la preposición en medio: «ни с кем», «ни о чём» — nunca «с никем». Es el error más frecuente en este tema.",
    examples: [
      { es: "No se lo dijo a nadie.", ru: "Он никому не сказал." },
      { es: "No hablé con nadie.", ru: "Я ни с кем не говорил." },
    ],
    relatedLessons: ["a2-25"],
  },
  {
    slug: "adverbio-negativo",
    term: "adverbio negativo",
    definition:
      "Es el adverbio formado con el prefijo «ни-» a partir de un interrogativo: нигде (en ningún lugar), никуда (a ningún lugar), никогда (nunca), никак (de ninguna manera). Son invariables y, como los pronombres negativos, exigen «не» junto al verbo.",
    russianEquivalent: "отрицательное наречие",
    transcription: "atritsátyel'naye naryéchiye",
    category: "partes-de-la-oracion",
    russianComparison:
      "El español necesita varias palabras («en ningún lugar», «de ninguna manera»); el ruso lo condensa en una sola con «ни-». El más difícil de captar es «никак»: no significa un simple «no», sino «de ninguna manera posible, por más que lo intente», y suele acompañar a «мочь» (poder).",
    examples: [
      { es: "Nunca he estado en Rusia.", ru: "Я никогда не был в России." },
      { es: "No consigo resolver este problema de ninguna manera.", ru: "Я никак не могу решить эту задачу." },
    ],
    relatedLessons: ["a2-26"],
  },
  {
    slug: "doble-negacion",
    term: "doble negación",
    definition:
      "Es la regla que obliga a mantener «не» junto al verbo aunque la oración ya tenga una palabra negativa. En ruso no es un refuerzo opcional ni un error: «Я ничего не знаю» lleva dos marcas de negación y es la única forma correcta de decir «no sé nada».",
    russianEquivalent: "двойное отрицание",
    transcription: "dvaynóye atritsániye",
    category: "otros",
    russianComparison:
      "Aquí el español ayuda en lugar de estorbar: «no sé nada», «no vino nadie» también llevan dos marcas. La estructura coincide casi punto por punto, así que este es uno de los pocos temas donde la intuición del hispanohablante funciona directamente — a diferencia de un anglohablante, que tiene que desaprender la regla contraria.",
    examples: [
      { es: "No sé nada.", ru: "Я ничего не знаю." },
      { es: "Nadie vino.", ru: "Никто не пришёл." },
    ],
    relatedLessons: ["a1-21", "a2-25", "a2-26"],
  },
  {
    slug: "regimen-verbal",
    term: "régimen verbal",
    definition:
      "Es la exigencia, propia de cada verbo, de que su complemento vaya en un caso concreto. No se deduce del significado y forma parte de lo que hay que aprender junto con el verbo: «владеть» (dominar un idioma) pide instrumental, «помогать» (ayudar) pide dativo, «ждать» (esperar) pide acusativo o genitivo según el matiz.",
    russianEquivalent: "глагольное управление",
    transcription: "glagól'naye upravlyéniye",
    category: "otros",
    russianComparison:
      "El español tiene algo comparable con las preposiciones que rigen ciertos verbos («soñar CON», «depender DE»), y se aprenden igual: en bloque con el verbo. La diferencia es que el ruso lo marca con una terminación en vez de una preposición. Un mismo verbo puede además tener dos regímenes con sentidos distintos: «У меня болит горло» (me duele la garganta) frente a «Я болею гриппом» (tengo gripe).",
    examples: [
      { es: "Domino el idioma inglés (instrumental).", ru: "Я владею английским языком." },
      { es: "Tengo gripe (instrumental).", ru: "Я болею гриппом." },
    ],
    relatedLessons: ["a2-27", "b1-27"],
  },
  {
    slug: "plurale-tantum",
    term: "sustantivo solo en plural",
    definition:
      "Es el sustantivo que existe únicamente en plural y no tiene forma de singular: брюки (pantalones), джинсы (vaqueros), очки (gafas), часы (reloj), деньги (dinero). Todo lo que lo acompaña — adjetivos, verbos, numerales — va también en plural.",
    russianEquivalent: "существительные только множественного числа",
    transcription: "sushchyestvítyel'nyye tól'ka mnózhystvyennava chislá",
    category: "otros",
    russianComparison:
      "El español también dice «pantalones» o «gafas» en plural, así que el punto de partida es familiar. La diferencia es que en español el singular existe y es válido («un pantalón», «una gafa»), mientras que en ruso simplemente no hay tal forma. Y algunos casos no coinciden: «часы» (reloj) y «деньги» (dinero) son plurales en ruso y singulares en español.",
    examples: [
      { es: "Estos pantalones me quedan grandes.", ru: "Эти брюки мне велики." },
      { es: "¿Dónde están mis gafas?", ru: "Где мои очки?" },
    ],
    relatedLessons: ["a2-28"],
  },
  {
    slug: "oracion-indefinido-personal",
    term: "oración indefinido-personal",
    definition:
      "Es la oración cuyo verbo va en tercera persona del plural sin ningún sujeto expreso, porque quién hace la acción no importa o no se conoce: «Обещают дождь» (pronostican lluvia), «Говорят, что...» (dicen que...), «Здесь не курят» (aquí no se fuma).",
    russianEquivalent: "неопределённо-личное предложение",
    transcription: "nyeapryedyelyónna-líchnaye pryedlazhéniye",
    category: "otros",
    russianComparison:
      "El español tiene dos recursos para esto: el plural impersonal («dicen que») y la construcción con «se» («aquí no se fuma»). El ruso usa el mismo plural sin sujeto para ambos casos, así que la primera de las dos opciones españolas es la que mejor guía la traducción — «se dice» corresponde a «говорят», no a una construcción reflexiva.",
    examples: [
      { es: "Pronostican lluvia para el fin de semana.", ru: "Обещают дождь на выходных." },
      { es: "Dicen que mañana hará frío.", ru: "Говорят, что завтра будет холодно." },
    ],
    relatedLessons: ["a2-29"],
  },
  // ── Bloque B1/B2 (2026-08-28) ──────────────────────────────────────
  // Same bar as the A1/A2 block above: only concepts a lesson actually
  // teaches. The situational B1/B2 lessons (media, culture, business,
  // ecology, exam prep) get no term — see the "gaps that will stay"
  // block in PROGRESS.md for the list and the reason for each.
  {
    slug: "conector-argumentativo",
    term: "conector argumentativo",
    definition:
      "Es la palabra o expresión que marca el papel de cada pieza dentro de un argumento: enumerar (во-первых, во-вторых), añadir peso (кроме того, более того), conceder antes de rebatir (хотя, тем не менее) y concluir (таким образом, следовательно). Pertenecen al registro escrito y al debate formal, no a la conversación corriente.",
    russianEquivalent: "средства связи в аргументации",
    transcription: "sryétstva svyázi v argumyentátsyi",
    category: "conjunciones",
    russianComparison:
      "El inventario español es muy parecido («en primer lugar», «además», «sin embargo», «por lo tanto»), así que la dificultad no está en entenderlos sino en el registro: mezclar un conector formal con vocabulario coloquial suena tan raro en ruso como en español. La regla práctica es mantener un solo nivel de registro en todo el texto.",
    examples: [
      { es: "En primer lugar, es más barato; además, es más rápido.", ru: "Во-первых, это дешевле; кроме того, это быстрее." },
      { es: "Así pues, se puede sacar una conclusión.", ru: "Таким образом, можно сделать вывод." },
    ],
    relatedLessons: ["b2-3", "b2-26"],
  },
  {
    slug: "verbo-movimiento-figurado",
    term: "verbo de movimiento en sentido figurado",
    definition:
      "Es el uso de un verbo de movimiento con prefijo para hablar de algo que no se mueve por el espacio: procesos mentales, estados y cambios. La preposición y el caso se conservan igual que en el sentido literal — «дойти до» + genitivo (llegar a un extremo), «выйти из» + genitivo (salir de un estado), «прийти к» + dativo (llegar a una conclusión).",
    russianEquivalent: "переносное значение глаголов движения",
    transcription: "pyeryenósnaye znachéniye glagólaf dvizhéniya",
    category: "verbos-movimiento",
    russianComparison:
      "El español hace exactamente lo mismo («llegar a una conclusión», «salir de una crisis»), así que la metáfora se entiende sin esfuerzo. Lo que no se puede adivinar es qué preposición toca en cada familia: «прийти К выводу» con dativo, pero «прийти В себя» (volver en sí) con acusativo, sin ninguna lógica que lo prediga.",
    examples: [
      { es: "Llegamos a una conclusión.", ru: "Мы пришли к выводу." },
      { es: "Perdió los estribos.", ru: "Он вышел из себя." },
    ],
    relatedLessons: ["b2-18", "b2-19"],
  },
  {
    slug: "idiomatismo",
    term: "expresión idiomática",
    definition:
      "Es la expresión fija cuyo significado no se deduce de las palabras que la componen y que, además, arrastra su propia estructura gramatical: «сходить с ума от» (volverse loco de), «вести себя» (comportarse, donde «себя» nunca se omite), «во что бы то ни стало» (cueste lo que cueste, invariable por completo).",
    russianEquivalent: "устойчивое выражение",
    transcription: "ustóychivaye vyrazhéniye",
    category: "registro-estilo",
    russianComparison:
      "La idea es la misma que en español («tomar el pelo», «a duras penas») y el consejo también: se aprenden como un bloque entero, nunca palabra por palabra. La diferencia práctica en ruso es que el bloque incluye el caso y la preposición, así que memorizar solo el significado no basta para poder usarlo.",
    examples: [
      { es: "Está loco de alegría.", ru: "Он сходит с ума от радости." },
      { es: "Lo haremos cueste lo que cueste.", ru: "Мы сделаем это во что бы то ни стало." },
    ],
    relatedLessons: ["b2-5", "b2-20", "b2-21"],
  },
  {
    slug: "marcador-narrativo",
    term: "marcador narrativo",
    definition:
      "Es la palabra que ordena una historia en el tiempo y avisa al oyente de en qué punto va: «однажды» para abrir (una vez, cierto día), «сначала» → «потом»/«затем» → «после этого» para la cadena de sucesos, «наконец»/«в итоге» para cerrar, y «пока» + imperfectivo para lo que ocurre de fondo al mismo tiempo.",
    russianEquivalent: "средства связи в повествовании",
    transcription: "sryétstva svyázi v pavyestvavánii",
    category: "otros",
    russianComparison:
      "Los equivalentes españoles son casi uno a uno («una vez», «primero», «luego», «finalmente»), así que lo nuevo no es el vocabulario sino su interacción con el aspecto: «пока» pide siempre imperfectivo porque marca duración, mientras que la cadena de sucesos consecutivos va en perfectivo. Elegir bien el marcador y el aspecto equivocado deja la frase igual de rota.",
    examples: [
      { es: "Una vez estaba paseando por el parque...", ru: "Однажды я гулял в парке..." },
      { es: "Mientras buscábamos setas, todo estaba en silencio.", ru: "Пока мы искали грибы, было тихо." },
    ],
    relatedLessons: ["b1-5"],
  },
  {
    slug: "interrogativo-con-by-ni",
    term: "construcción «бы ни»",
    definition:
      "Es el esquema «interrogativo + бы ни + verbo en pasado», que expresa que da igual cuál sea la respuesta: кто бы ни (quienquiera que), что бы ни (pase lo que pase), как бы ни (por más que), где бы ни (dondequiera que). El verbo va siempre en pasado, aunque la frase hable del presente o del futuro.",
    russianEquivalent: "конструкция «бы ни»",
    transcription: "kanstruktsyya «by ni»",
    category: "conjunciones",
    russianComparison:
      "El español resuelve esto con el subjuntivo («pase lo que pase», «vayas donde vayas»), un modo que el ruso no tiene. En su lugar el ruso reutiliza la forma de pasado, igual que en el condicional con «бы» — así que un pasado ruso aquí no significa pasado, y traducirlo como tal es el error típico.",
    examples: [
      { es: "Pase lo que pase, estaré a tu lado.", ru: "Что бы ни случилось, я буду рядом." },
      { es: "Vaya donde vaya, lo recuerdo.", ru: "Куда бы я ни поехал, я помню об этом." },
    ],
    relatedLessons: ["b2-21"],
  },
  {
    slug: "exclamacion-kakoy-kak",
    term: "exclamación con «какой» y «как»",
    definition:
      "Son las dos estructuras exclamativas del ruso, y la elección depende de lo que viene después: «какой» (concordando en género y número) va delante de un SUSTANTIVO, y «как», invariable, delante de un ADJETIVO CORTO o un ADVERBIO. «Какая красивая картина!» frente a «Как интересно!».",
    russianEquivalent: "восклицательное предложение с «какой» и «как»",
    transcription: "vasklitsátyel'naye pryedlazhéniye s «kakóy» i «kak»",
    category: "otros",
    russianComparison:
      "Aquí el español tiene una sola palabra para las dos cosas: «¡qué película!» y «¡qué interesante!» usan el mismo «qué». El ruso obliga a decidir según la categoría gramatical de la palabra siguiente, así que el hispanohablante tiene que hacer un análisis que en su idioma nunca hace.",
    examples: [
      { es: "¡Qué cuadro tan bonito!", ru: "Какая красивая картина!" },
      { es: "¡Qué interesante!", ru: "Как интересно!" },
    ],
    relatedLessons: ["b1-30"],
  },
  {
    slug: "proporcionalidad-chem-tem",
    term: "construcción «чем... тем...»",
    definition:
      "Es el esquema de proporcionalidad: «чем» + comparativo en la primera mitad y «тем» + comparativo en la segunda, para decir que dos magnitudes cambian juntas. «Чем выше образование, тем больше возможностей» (cuanto más alta la educación, más oportunidades).",
    russianEquivalent: "конструкция «чем... тем...»",
    transcription: "kanstruktsyya «chem... tem...»",
    category: "conjunciones",
    russianComparison:
      "Es uno de los pocos puntos donde la estructura coincide casi exactamente con el español («cuanto más..., más...»), incluida la coma obligatoria entre las dos mitades. Conviene no confundirlo con el «чем» de la comparación normal («Книга интереснее, чем фильм»), que compara dos cosas una sola vez en lugar de encadenar dos cambios.",
    examples: [
      { es: "Cuanto más alta la educación, más oportunidades.", ru: "Чем выше образование, тем больше возможностей." },
      { es: "Cuanto más lo pienso, menos lo entiendo.", ru: "Чем больше я думаю, тем меньше понимаю." },
    ],
    relatedLessons: ["b1-28"],
  },
];

/** Fields compared in --dry-run. Deliberately the exact key set written
 * below, so a new column can't silently drop out of the preview and land
 * as an unannounced change in production. */
function diffFields(existing: Record<string, unknown>, data: Record<string, unknown>): string[] {
  return Object.keys(data).filter((key) => String(existing[key] ?? "") !== String(data[key] ?? ""));
}

async function main() {
  let skipped = 0;
  let changed = 0;
  let identical = 0;
  let created = 0;
  let filteredOut = 0;

  for (const term of terms) {
    if (ONLY && !ONLY.has(term.slug)) {
      filteredOut++;
      continue;
    }
    const result = validateGlossaryInput(term);
    if (!result.valid) {
      console.error(`Skipping "${term.term}": ${result.error}`);
      continue;
    }
    const data = {
      ...result.value,
      relatedLessons: JSON.stringify(result.value.relatedLessons),
      examples: JSON.stringify(result.value.examples),
    };

    const existing = await db.glossaryTerm.findUnique({ where: { slug: result.value.slug } });
    if (existing) {
      if (existing.reviewedAt && !FORCE) {
        console.warn(`⚠ Skipping "${term.term}" — hand-reviewed on ${existing.reviewedAt.toISOString()}, re-run with --force to overwrite anyway.`);
        skipped++;
        continue;
      }
      const changedFields = diffFields(existing as unknown as Record<string, unknown>, data);
      if (changedFields.length === 0) {
        identical++;
        continue;
      }
      changed++;
      if (DRY_RUN) {
        console.log(`~ ${result.value.slug} — would UPDATE ${changedFields.length} field(s)${existing.reviewedAt ? " (reviewed, needs --force)" : ""}`);
        for (const key of changedFields) {
          console.log(`    ${key}:\n      before: ${String((existing as unknown as Record<string, unknown>)[key] ?? "")}\n      after:  ${String(data[key as keyof typeof data] ?? "")}`);
        }
        continue;
      }
      await db.glossaryTerm.update({ where: { slug: result.value.slug }, data });
    } else {
      created++;
      if (DRY_RUN) {
        console.log(`+ ${result.value.slug} — would CREATE`);
        continue;
      }
      await db.glossaryTerm.create({ data });
    }
  }

  const scope = ONLY ? `${ONLY.size} slug(s) selected, ${filteredOut} not selected` : `all ${terms.length} term(s)`;
  if (DRY_RUN) {
    console.log(`\n— DRY RUN, nothing written. Scope: ${scope}.`);
    console.log(`  would update ${changed}, would create ${created}, identical ${identical}, skipped as reviewed ${skipped}.`);
    return;
  }
  console.log(`✔ Scope: ${scope}. Updated ${changed}, created ${created}, identical ${identical}, skipped (reviewed) ${skipped}.`);
}

// Only when this file is the process entry point — importing it must not
// run it. See src/lib/entry-point.ts for the incident behind this.
if (isEntryPoint(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
