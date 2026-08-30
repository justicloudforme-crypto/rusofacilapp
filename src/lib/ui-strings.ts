import type { Locale } from "@/i18n/config";

/**
 * Interface strings for client components that cannot reach the server
 * dictionary.
 *
 * The rule on this project is that every interface string lives in
 * `src/dictionaries/{es,ru}.json` and arrives as a prop from a server
 * component. Two places cannot follow it, and both were found holding
 * Spanish literals that a Russian-interface student saw as-is (debt 16 one
 * level down: not a key left untranslated, but a string that never reached
 * the dictionary at all):
 *
 *   - the glossary popover card, at the end of the chain
 *     GrammarTab → SlidesTab → GlossaryText → GlossaryTermPopover →
 *     GlossaryTermCardBody, whose own comment records the decision not to
 *     thread `lang` through all of it (it reads the locale from the URL
 *     instead);
 *   - the video-lesson components, whose page hands them one content
 *     object and nothing else.
 *
 * Importing the JSON dictionaries here instead is not an option: they are
 * 70 KB and 94 KB, `dictionaries.ts` is `server-only`, and a client import
 * would ship both locales to every visitor for the sake of a dozen labels.
 *
 * So this is the same shape the project already uses for locale-keyed data
 * in a lib module (`story-culture.ts`, `word-games/topics.ts`): one object
 * per string, both locales side by side, picked by locale. The parity rules
 * that apply to the dictionaries apply here too and are enforced by
 * src/lib/ui-strings.test.ts — same key set in both locales, Cyrillic
 * required in every Russian value, nothing left as a copy of the Spanish.
 */
export interface UiStrings {
  glossary: {
    listenInRussian: string;
    introducedIn: string;
    howItWorksInRussian: string;
    appearsIn: string;
    noDefinitionYet: string;
  };
  videoLesson: {
    levelLabel: string;
    transcriptHeading: string;
    noTranscript: string;
    historicalContextHeading: string;
    keyVocabularyHeading: string;
    quizHeading: string;
    quizPartOne: string;
    quizPartTwo: string;
    scoreLabel: string;
    passedLabel: string;
    failedLabel: string;
    checkButton: string;
    retryButton: string;
    closeLabel: string;
  };
}

export const UI_STRINGS: Record<Locale, UiStrings> = {
  es: {
    glossary: {
      listenInRussian: "Escuchar en ruso",
      introducedIn: "Introducido en",
      howItWorksInRussian: "Cómo funciona en ruso:",
      appearsIn: "Aparece en",
      noDefinitionYet: "Sin definición todavía.",
    },
    videoLesson: {
      levelLabel: "Nivel",
      transcriptHeading: "Texto / transcripción",
      noTranscript: "Esta lección todavía no tiene transcripción.",
      historicalContextHeading: "Contexto histórico y cultural",
      keyVocabularyHeading: "Vocabulario clave",
      quizHeading: "Cuestionario interactivo",
      quizPartOne: "Parte 1 · Contexto histórico y cultural",
      quizPartTwo: "Parte 2 · Vocabulario",
      scoreLabel: "Puntuación:",
      passedLabel: "Aprobado",
      failedLabel: "No aprobado",
      checkButton: "Comprobar",
      retryButton: "Reintentar",
      closeLabel: "Cerrar",
    },
  },
  ru: {
    glossary: {
      listenInRussian: "Послушать по-русски",
      introducedIn: "Вводится на уровне",
      howItWorksInRussian: "Как это устроено в русском:",
      appearsIn: "Встречается в",
      noDefinitionYet: "Определения пока нет.",
    },
    videoLesson: {
      levelLabel: "Уровень",
      transcriptHeading: "Текст / расшифровка",
      noTranscript: "У этого урока пока нет расшифровки.",
      historicalContextHeading: "Исторический и культурный контекст",
      keyVocabularyHeading: "Ключевая лексика",
      quizHeading: "Интерактивный тест",
      quizPartOne: "Часть 1 · Исторический и культурный контекст",
      quizPartTwo: "Часть 2 · Лексика",
      scoreLabel: "Результат:",
      passedLabel: "Зачёт",
      failedLabel: "Не зачтено",
      checkButton: "Проверить",
      retryButton: "Пройти заново",
      closeLabel: "Закрыть",
    },
  },
};

/** Spanish is the fallback for anything that is not a known locale: it is
 * the language the product is written in, and the one every route defaults
 * to. */
export function uiStrings(lang: string): UiStrings {
  return lang === "ru" ? UI_STRINGS.ru : UI_STRINGS.es;
}
