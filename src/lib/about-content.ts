/**
 * "About the project" page content — plain data, same pattern as
 * src/lib/legal/content.ts (long-form text kept out of es.json/ru.json).
 *
 * Written specifically to fix a real problem: searching "rusofacilapp"
 * currently makes Google's AI Overview describe an unrelated App Store
 * app ("Aprender ruso fácil") instead of this site, because there was no
 * page anywhere stating in plain text who RusoFácilapp is, who it's for,
 * and what's actually inside — see the Organization JSON-LD in
 * src/lib/site.ts for the machine-readable half of the same fix.
 *
 * Facts this text is grounded in (keep in sync with the code if either
 * changes — same discipline as legal/content.ts):
 *  - Operator: Vasilii Petrov, an individual (see legal/content.ts).
 *  - RusoFácilapp is a website (rusofacilapp.com), not an app-store app —
 *    neither store listing is live yet (src/app/[lang]/download/page.tsx).
 *  - Levels: A1–B2 (four levels, 30 lessons each — src/lib/courses.ts).
 *  - Content actually shipped: structured lessons with grammar+
 *    vocabulary+listening exercises, reading stories per level, a
 *    glossary of grammar terms, flashcard vocabulary practice, word
 *    games (word search + crossword), and an audio/video media library.
 *  - Free vs. paid: every lesson's grammar explanation, each level's
 *    first lesson in full, most stories' openings, and 80 word-game
 *    puzzles are free without an account; full lessons/stories/media
 *    require a subscription (see src/lib/entitlement.ts).
 */
import type { Locale } from "@/i18n/config";

export interface AboutContent {
  title: string;
  metaDescription: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
}

export const ABOUT_CONTENT: Record<Locale, AboutContent> = {
  es: {
    title: "Sobre RusoFácilapp",
    metaDescription:
      "RusoFácilapp: aprender ruso desde cero si hablas español. Quién lo hace, para quién es, y por qué el curso llega al B2 y el material al C1.",
    intro:
      "RusoFácilapp (rusofacilapp.com) es una plataforma web para aprender ruso pensada específicamente para hispanohablantes. No es una aplicación de App Store o Google Play — es un sitio al que entras directamente desde el navegador, en el celular o la computadora, sin instalar nada.",
    sections: [
      {
        heading: "¿Quién lo hace?",
        paragraphs: [
          "El proyecto lo lleva Vasilii Petrov, una sola persona, no una empresa. Eso significa que el contenido —lecciones, historias, ejercicios, audio— se revisa y se corrige directamente, sin capas intermedias.",
        ],
      },
      {
        heading: "¿Para quién es?",
        paragraphs: [
          "Para cualquier hispanohablante que quiera aprender ruso partiendo de cero o retomando desde un nivel básico: no hace falta conocimiento previo del alfabeto cirílico ni de gramática rusa para empezar por el nivel A1.",
        ],
      },
      {
        heading: "¿Qué hay adentro?",
        paragraphs: [
          "Cuatro niveles completos (A1, A2, B1, B2), con 30 lecciones cada uno: explicación de gramática, vocabulario con audio, y ejercicios de comprensión. Además, historias de lectura graduadas por nivel, un glosario de términos gramaticales, tarjetas de vocabulario para repasar, y juegos de palabras (sopa de letras y crucigramas) para practicar el alfabeto y el vocabulario básico sin necesidad de cuenta.",
          "La explicación de gramática de las 120 lecciones es gratuita y no requiere iniciar sesión, igual que la primera lección completa de cada nivel, buena parte del contenido de las historias, y 80 de los puzzles de palabras. El resto del contenido completo (vocabulario, ejercicios, historias y medios completos) requiere una suscripción, que sostiene el trabajo de mantener y ampliar el curso.",
        ],
      },
      {
        heading: "¿Por qué existe?",
        paragraphs: [
          "La mayoría de los recursos para aprender ruso están pensados para angloparlantes, con explicaciones gramaticales que comparan el ruso con el inglés. RusoFácilapp compara el ruso directamente con el español —tiempos verbales, casos, género gramatical— porque esa comparación suele ser más útil y más directa para quien ya piensa en español.",
        ],
      },
    ],
  },
  ru: {
    title: "О проекте RusoFácilapp",
    metaDescription:
      "RusoFácilapp — сайт для изучения русского языка испаноговорящими: кто его делает, для кого он, и почему курс идёт до B2, а материалы для занятий — до C1.",
    intro:
      "RusoFácilapp (rusofacilapp.com) — веб-платформа для изучения русского языка, созданная специально для испаноговорящих. Это не приложение из App Store или Google Play — сайт открывается прямо в браузере, на телефоне или компьютере, без установки.",
    sections: [
      {
        heading: "Кто это делает",
        paragraphs: [
          "Проект ведёт один человек, Василий Петров, а не компания. Это значит, что весь контент — уроки, рассказы, упражнения, озвучка — проверяется и правится напрямую, без промежуточных звеньев.",
        ],
      },
      {
        heading: "Для кого это",
        paragraphs: [
          "Для любого испаноговорящего человека, который хочет учить русский с нуля или с начального уровня: для старта с уровня A1 не нужно заранее знать кириллицу или русскую грамматику.",
        ],
      },
      {
        heading: "Что внутри",
        paragraphs: [
          "Четыре полных уровня (A1, A2, B1, B2), по 30 уроков в каждом: объяснение грамматики, словарь с озвучкой и упражнения на понимание. Также есть рассказы для чтения по уровням, глоссарий грамматических терминов, карточки для повторения словаря и игры со словами (кроссворды и филворды) для практики алфавита и базовой лексики без регистрации.",
          "Объяснение грамматики всех 120 уроков бесплатно и не требует входа в аккаунт — как и первый полный урок каждого уровня, значительная часть текста рассказов и 80 игровых пазлов. Остальной полный контент (словарь, упражнения, полные рассказы и медиатека) доступен по подписке, которая поддерживает работу над курсом.",
        ],
      },
      {
        heading: "Зачем это нужно",
        paragraphs: [
          "Большинство материалов для изучения русского языка рассчитаны на англоговорящих — грамматика объясняется через сравнение с английским. RusoFácilapp сравнивает русский язык напрямую с испанским — глагольные времена, падежи, грамматический род, — потому что такое сравнение обычно понятнее тому, кто уже думает на испанском.",
        ],
      },
    ],
  },
};
