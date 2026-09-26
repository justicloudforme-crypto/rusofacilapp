// СОБРАНО scripts/build-ui-strings.mjs ИЗ src/dictionaries/*.json — НЕ ПРАВИТЬ РУКАМИ.
//
// Долг 23. Интерфейсные строки жили в ДВУХ местах: в словарях и здесь,
// литералами. Теперь место одно — словари, ветка "clientUi", — а этот
// файл её отпечаток для клиентских компонентов, которым словарь целиком
// отдать нельзя (70 КиБ и 94 КиБ на девятнадцать подписей).
//
// Правка руками роняет `npm run check:ui-strings-source`: сторож
// пересобирает файл в памяти и сличает знак в знак.
//
// Пересобрать: npm run ui-strings:build
import type { Locale } from "@/i18n/config";

export interface UiStrings {
  download: {
    button: string;
    measuring: string;
    confirm: string;
    progress: string;
    done: string;
    mark: string;
    cancel: string;
    weightNote: string;
    errorNetwork: string;
    errorSpace: string;
    errorTooBig: string;
    errorClosed: string;
    errorOffline: string;
    errorUnknown: string;
    unknownWeight: string;
    screenTitle: string;
    screenTotal: string;
    screenEmpty: string;
    screenIncomplete: string;
    screenUntitled: string;
    remove: string;
    removeAll: string;
    removeAllConfirm: string;
  };
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
    "download": {
      "button": "Descargar",
      "measuring": "Calculando…",
      "confirm": "Descargar {weight}",
      "progress": "{done} / {total}",
      "done": "Descargado",
      "mark": "Descargado",
      "cancel": "Cancelar",
      "weightNote": "Página y {clips} audios",
      "errorNetwork": "Se cortó la conexión. No se ha descargado nada.",
      "errorSpace": "No hay espacio en el teléfono. No se ha descargado nada.",
      "errorTooBig": "Ya no cabe. Borra algo en «Descargado».",
      "errorClosed": "Este material no está disponible en tu cuenta.",
      "errorOffline": "Sin internet no se puede descargar.",
      "errorUnknown": "No se pudo descargar. Inténtalo de nuevo.",
      "unknownWeight": "peso de {clips} audios sin confirmar",
      "screenTitle": "Descargado",
      "screenTotal": "En total: {weight}",
      "screenEmpty": "Aún no has descargado nada.",
      "screenIncomplete": "Incompleto",
      "screenUntitled": "Material descargado",
      "remove": "Borrar",
      "removeAll": "Borrar todo",
      "removeAllConfirm": "¿Borrar todo lo descargado?"
    },
    "glossary": {
      "listenInRussian": "Escuchar en ruso",
      "introducedIn": "Introducido en",
      "howItWorksInRussian": "Cómo funciona en ruso:",
      "appearsIn": "Aparece en",
      "noDefinitionYet": "Sin definición todavía."
    },
    "videoLesson": {
      "levelLabel": "Nivel",
      "transcriptHeading": "Texto / transcripción",
      "noTranscript": "Esta lección todavía no tiene transcripción.",
      "historicalContextHeading": "Contexto histórico y cultural",
      "keyVocabularyHeading": "Vocabulario clave",
      "quizHeading": "Cuestionario interactivo",
      "quizPartOne": "Parte 1 · Contexto histórico y cultural",
      "quizPartTwo": "Parte 2 · Vocabulario",
      "scoreLabel": "Puntuación:",
      "passedLabel": "Aprobado",
      "failedLabel": "No aprobado",
      "checkButton": "Comprobar",
      "retryButton": "Reintentar",
      "closeLabel": "Cerrar"
    }
  },
  ru: {
    "download": {
      "button": "Скачать",
      "measuring": "Считаем…",
      "confirm": "Скачать {weight}",
      "progress": "{done} из {total}",
      "done": "Скачано",
      "mark": "Скачано",
      "cancel": "Отмена",
      "weightNote": "Страница и {clips} записей",
      "errorNetwork": "Связь оборвалась. Ничего не скачано.",
      "errorSpace": "На телефоне нет места. Ничего не скачано.",
      "errorTooBig": "Больше не влезает. Удалите что-нибудь в «Скачанном».",
      "errorClosed": "Этот материал недоступен в вашей учётной записи.",
      "errorOffline": "Без интернета скачать нельзя.",
      "errorUnknown": "Скачать не удалось. Попробуйте ещё раз.",
      "unknownWeight": "вес {clips} записей не подтверждён",
      "screenTitle": "Скачанное",
      "screenTotal": "Всего: {weight}",
      "screenEmpty": "Вы ещё ничего не скачали.",
      "screenIncomplete": "Не целиком",
      "screenUntitled": "Скачанный материал",
      "remove": "Удалить",
      "removeAll": "Удалить всё",
      "removeAllConfirm": "Удалить всё скачанное?"
    },
    "glossary": {
      "listenInRussian": "Послушать по-русски",
      "introducedIn": "Вводится на уровне",
      "howItWorksInRussian": "Как это устроено в русском:",
      "appearsIn": "Встречается в",
      "noDefinitionYet": "Определения пока нет."
    },
    "videoLesson": {
      "levelLabel": "Уровень",
      "transcriptHeading": "Текст / расшифровка",
      "noTranscript": "У этого урока пока нет расшифровки.",
      "historicalContextHeading": "Исторический и культурный контекст",
      "keyVocabularyHeading": "Ключевая лексика",
      "quizHeading": "Интерактивный тест",
      "quizPartOne": "Часть 1 · Исторический и культурный контекст",
      "quizPartTwo": "Часть 2 · Лексика",
      "scoreLabel": "Результат:",
      "passedLabel": "Зачёт",
      "failedLabel": "Не зачтено",
      "checkButton": "Проверить",
      "retryButton": "Пройти заново",
      "closeLabel": "Закрыть"
    }
  },
};

/** Испанский — запасной для всего, что не известная локаль: на нём
 *  написан продукт, и в него по умолчанию уходит любой маршрут. */
export function uiStrings(lang: string): UiStrings {
  return lang === "ru" ? UI_STRINGS.ru : UI_STRINGS.es;
}
