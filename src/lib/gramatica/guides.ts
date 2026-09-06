/**
 * Путь и состав индекса гидов по грамматике — в отдельном модуле, потому
 * что читателей у списка стало двое: сама страница `/es/gramatica` и
 * индекс поиска (src/lib/search/records.ts). Пересказ этого списка вторым
 * местом означал бы, что пятый гид можно завести и не найти поиском, а
 * никто этого не заметит.
 */
export const GRAMMAR_INDEX_PATH = "/gramatica";

export interface GrammarGuide {
  href: string;
  /** Короткое название — то, которым гид назван в индексе `/es/gramatica`. */
  title: string;
  /**
   * Заголовок самой страницы гида (её `<h1>` и `<title>`). Он длиннее и
   * формулируется иначе: индекс говорит «El género de los sustantivos»,
   * страница — «El género de los sustantivos en ruso: cómo reconocerlo».
   *
   * Хранится здесь ради поиска: человек, набравший то, что он видел на
   * странице, обязан её найти — замер 05.09.2026 отдельно называет
   * «El género de los sustantivos en ruso» как строку, дававшую ноль.
   * Совпадение этой строки с настоящим заголовком страницы проверяется
   * тестом (src/lib/gramatica/guides.test.ts), а не обещанием: страницы
   * этот модуль не импортируют, потому что они заморожены до 25.09.
   */
  pageTitle: string;
  description: string;
}

/**
 * Index of the /es/gramatica guides. The first three explain a grammar
 * topic the course assumes you already know: measured across all 120
 * lessons, no lesson has "género", "plural" or "verbos reflexivos" in its
 * title — they only ever appear in passing inside lessons about something
 * else (see PROGRESS.md's coverage audit). The glossary defines the terms;
 * these pages explain how they work.
 *
 * The alphabet guide is the exception and breaks that rule deliberately:
 * A1 lesson 1 IS "El alfabeto cirílico y los sonidos del ruso" and already
 * serves the full 33-letter table anonymously. It is here because the
 * search intent differs, not because the topic was unowned — see the long
 * comment in alfabeto-ruso/page.tsx. Do not use it as precedent for adding
 * a guide that merely repeats a lesson.
 *
 * ES-only, like the sopa-de-letras landing pages: the whole method here
 * is comparison against Spanish, so a Russian-interface copy would be
 * the same Spanish text at a second URL for nobody.
 *
 * Three guides matching the topics the coverage audit found unowned by
 * any lesson title, plus the alphabet guide described above.
 */
export const GRAMMAR_GUIDES: GrammarGuide[] = [
  {
    href: "/es/gramatica/alfabeto-ruso",
    title: "El alfabeto ruso, por dificultad",
    pageTitle: "El alfabeto ruso para hispanohablantes: las 33 letras por dificultad",
    description:
      "Las 33 letras ordenadas por lo que cuesta reconocerlas: las cinco que ya sabes leer, los seis falsos amigos que se leen mal y las nuevas de verdad.",
  },
  {
    href: "/es/gramatica/genero-sustantivos-ruso",
    title: "El género de los sustantivos",
    pageTitle: "El género de los sustantivos en ruso: cómo reconocerlo",
    description:
      "Tres géneros en vez de dos, y una regla que el español no tiene: la última letra de la palabra casi siempre te dice cuál es.",
  },
  {
    href: "/es/gramatica/plural-sustantivos-ruso",
    title: "El plural de los sustantivos",
    pageTitle: "El plural de los sustantivos en ruso: cómo se forma",
    description:
      "Depende del género y, en cuanto aparece un número, también del caso: один стол, два стола, пять столов. Por qué contar lo cambia todo.",
  },
  {
    href: "/es/gramatica/verbos-reflexivos-ruso",
    title: "Los verbos en -ся",
    pageTitle: "Los verbos en -ся en ruso: qué significan de verdad",
    description:
      "El postfijo hace cuatro trabajos distintos, no solo el reflexivo — casi los mismos que el «se» español, y dos que no se le parecen en nada.",
  },
];
