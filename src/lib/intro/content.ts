import type { IntroIconKey } from "./slideIcons";

/**
 * Contenido de la presentación de Introducción — igual que el contenido de
 * las lecciones (ver src/lib/lessons/content.ts), se escribe siempre en
 * español, sin importar el idioma de la interfaz. Se muestra como una serie
 * de diapositivas tanto en la página de inicio (src/components/intro/IntroPresentation.tsx)
 * como en el PDF descargable (src/lib/intro/pdf.tsx) — un único origen de
 * verdad para ambos.
 */

export interface IntroSlide {
  id: string;
  icon: IntroIconKey;
  title: string;
  body: string[];
  /** Optional short bullet list, rendered under `body`. */
  highlights?: string[];
}

export const introSlides: IntroSlide[] = [
  {
    id: "intro-1-scale",
    icon: "globalReach",
    title: "Un idioma de alcance verdaderamente global",
    body: [
      "El ruso no es un idioma regional: lo hablan cerca de 258 millones de personas en el mundo, entre hablantes nativos y como segunda lengua. Con unos 150 millones de hablantes nativos, es el idioma nativo más hablado de toda Europa.",
      "Es idioma oficial en cuatro países — Rusia, Bielorrusia, Kazajistán y Kirguistán — y sigue siendo ampliamente usado en toda la antigua Unión Soviética, desde el Cáucaso hasta Asia Central.",
    ],
    highlights: [
      "≈ 258 millones de hablantes en total",
      "Idioma nativo más hablado de Europa",
      "Oficial en 4 países: Rusia, Bielorrusia, Kazajistán, Kirguistán",
      "Uno de los 6 idiomas oficiales de la ONU",
    ],
  },
  {
    id: "intro-2-geography",
    icon: "russiaMap",
    title: "El país más grande del planeta",
    body: [
      "Rusia no tiene comparación en tamaño: cubre más de 17 millones de km², casi el doble que el segundo país más grande, y se extiende a lo largo de dos continentes, Europa y Asia.",
      "Esa escala se nota hasta en el reloj: Rusia abarca 11 husos horarios distintos. Cuando en Kaliningrado, al oeste, apenas empieza el día, en Kamchatka, al este, ya casi termina.",
    ],
    highlights: [
      "Más de 17 millones de km² de territorio",
      "11 husos horarios — el país con más del mundo",
      "Se extiende sobre dos continentes: Europa y Asia",
    ],
  },
  {
    id: "intro-3-space",
    icon: "spaceFirst",
    title: "Una gran potencia histórica y científica",
    body: [
      "Más allá del tamaño, Rusia es una potencia histórica con siglos de peso en la política, la ciencia y la cultura mundiales. Fue cuna de algunos de los mayores hitos científicos del siglo XX.",
      "El 12 de abril de 1961, el cosmonauta soviético Yuri Gagarin se convirtió en el primer ser humano en viajar al espacio, a bordo del Vostok 1 — un logro que abrió la era espacial para toda la humanidad. Años antes, en 1957, el Sputnik 1 había sido el primer satélite artificial en orbitar la Tierra.",
    ],
    highlights: [
      "Yuri Gagarin (1961): primer humano en el espacio",
      "Sputnik 1 (1957): primer satélite artificial de la historia",
      "Siglos de influencia en la ciencia, la política y las artes",
    ],
  },
  {
    id: "intro-4-literature",
    icon: "literaryClassics",
    title: "La verdadera meta: leer a los grandes clásicos en su idioma original",
    body: [
      "Esta es, en el fondo, la razón más poderosa para aprender ruso: poder leer en el idioma original algunas de las obras más importantes de toda la literatura universal. Ninguna traducción, por buena que sea, conserva del todo el ritmo, la ironía o los matices exactos que un autor eligió palabra por palabra.",
      "El ruso te abre la puerta a Fiódor Dostoievski, Lev Tolstói, Antón Chéjov, Alexánder Pushkin y Nikolái Gógol — autores que no solo definieron la literatura rusa, sino que cambiaron la forma en que el mundo entero entiende la novela, el cuento y el alma humana.",
      "Más allá de la literatura, el pensamiento ruso dejó huella profunda en la filosofía (Dostoievski influyó directamente en el existencialismo del siglo XX, desde Nietzsche hasta Sartre) y en disciplinas enteras como el ballet, el ajedrez y la música clásica, donde compositores como Chaikovski o Rachmáninov son referencia mundial.",
    ],
    highlights: [
      "Fiódor Dostoievski — «Crimen y castigo»",
      "Lev Tolstói — «Guerra y paz» y «Anna Karénina»",
      "Antón Chéjov — maestro universal del cuento y el teatro",
      "Alexánder Pushkin — padre de la literatura rusa moderna",
      "Nikolái Gógol — «Almas muertas», raíz de la sátira rusa",
    ],
  },
  {
    id: "intro-5-keyboard-windows",
    icon: "keyboardWindows",
    title: "Prepara tu teclado: Windows",
    body: [
      "No necesitas comprar nada ni pegar letras nuevas en tu teclado físico: Windows te permite agregar el ruso (ЙЦУКЕН) como idioma de escritura en un par de pasos, y alternar entre español y ruso al instante.",
      "Ve a Configuración › Hora e idioma › Idioma y región › Agregar un idioma, busca «Русский» (ruso) e instálalo. Windows agrega automáticamente la distribución de teclado cirílica estándar.",
    ],
    highlights: [
      "Configuración › Hora e idioma › Idioma › Agregar idioma › Русский",
      "Atajo para alternar el idioma: Windows + Barra espaciadora",
      "También puedes usar Alt izquierdo + Shift si así lo tienes configurado",
    ],
  },
  {
    id: "intro-6-keyboard-mac",
    icon: "keyboardMac",
    title: "Prepara tu teclado: Mac",
    body: [
      "En macOS el proceso es igual de sencillo. Ve a Preferencias del Sistema (o Ajustes del Sistema) › Teclado › Fuentes de entrada, pulsa el botón «+» y busca «Russian» (ruso) en la lista de idiomas.",
      "Una vez agregado, verás el ícono de idioma en la barra de menú arriba a la derecha, desde donde puedes cambiar de teclado con el mouse — o con el teclado, usando Control + Barra espaciadora para alternar entre tus fuentes de entrada instaladas.",
    ],
    highlights: [
      "Ajustes del Sistema › Teclado › Fuentes de entrada › «+» › Russian",
      "Atajo para alternar el idioma: Control + Barra espaciadora",
      "Consejo: si escribes mucho a mano, unas calcomanías cirílicas para las teclas (o un teclado virtual en pantalla) ayudan muchísimo al principio",
    ],
  },
  {
    id: "intro-7-consistency",
    icon: "dailyHabit",
    title: "El secreto del éxito: constancia, no maratones",
    body: [
      "La clave del éxito no es la plataforma en sí, sino tu constancia. Quince minutos al día, todos los días, valen mucho más que una sesión de tres horas una vez por semana — el cerebro fija un idioma nuevo con repetición espaciada y frecuente, no con sesiones intensas y esporádicas.",
      "RusoFásil está diseñado para acompañarte a tu ritmo: puedes avanzar, repasar o volver atrás sin presión. Pero la herramienta la ponemos nosotros; el hábito lo pones tú.",
    ],
    highlights: [
      "Mejor 15 minutos diarios que una maratón semanal",
      "La repetición frecuente es lo que fija el idioma en la memoria",
      "Avanza a tu ritmo — no hay carreras ni fechas límite",
    ],
  },
  {
    id: "intro-8-variety",
    icon: "methodMix",
    title: "Combate el desgaste: cambia de método",
    body: [
      "Aprender un idioma nuevo cansa, y está bien: la solución no es forzarte a seguir con lo mismo, sino cambiar de formato para mantener el interés vivo. RusoFásil está pensado precisamente para eso — varias formas distintas de tocar el mismo idioma.",
      "¿Cansado de la gramática? Mira un video o una canción con subtítulos traducidos. ¿Cansado de leer? Escucha uno de los cuentos narrados en voz alta. Alternar formatos «alimenta» tu interés desde varios ángulos a la vez, en vez de agotar siempre el mismo.",
    ],
    highlights: [
      "¿Cansado de la gramática? › mira un video o canción con traducción",
      "¿Cansado de leer? › escucha un cuento narrado en audio",
      "¿Cansado de escuchar? › practica con el vocabulario interactivo",
    ],
  },
  {
    id: "intro-9-platform-tour",
    icon: "interactiveDictionary",
    title: "Un recorrido rápido por RusoFásil",
    body: [
      "El diccionario interactivo está integrado en todo el sitio: cualquier palabra en español que te resulte compleja dentro de una explicación de gramática puede mostrarte al instante su definición, sin salir de la lección.",
      "Los cursos están organizados por niveles (A1 a B2) y cada nivel avanza lección por lección, con gramática, vocabulario y ejercicios de corrección instantánea. En la sección de Cuentos vas a encontrar textos paralelos — ruso y español lado a lado — narrados en voz alta por nivel, ideales para practicar lectura y oído a la vez. Y cada bloque de lecciones cierra con un examen para comprobar de verdad lo que ya dominas.",
    ],
    highlights: [
      "Diccionario interactivo con explicaciones al instante",
      "120 lecciones organizadas por niveles A1–B2",
      "Textos paralelos ruso–español narrados en voz alta, por nivel",
      "Exámenes de repaso después de cada bloque de lecciones",
    ],
  },
  {
    id: "intro-10-community",
    icon: "communityChat",
    title: "Únete al club de conversación",
    body: [
      "RusoFásil no termina en la pantalla: súmate a nuestro canal y grupo de Telegram para recibir novedades, resolver dudas y — sobre todo — practicar conversación real con hablantes nativos de ruso en el club de conversación.",
      "Vas a encontrar el enlace al canal en el botón flotante de Telegram, siempre visible en la esquina de la pantalla, en cualquier página del sitio.",
    ],
    highlights: [
      "Canal y grupo de Telegram con la comunidad de RusoFásil",
      "Club de conversación con hablantes nativos",
      "Botón flotante de Telegram, siempre a un clic de distancia",
    ],
  },
];
