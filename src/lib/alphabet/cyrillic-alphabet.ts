/**
 * Данные страницы `/es/alfabeto-cirilico` — 33 буквы, у каждой звук,
 * сопоставление с испанским и слово-пример.
 *
 * ЧЕМ ЭТА СТРАНИЦА ОТЛИЧАЕТСЯ ОТ УЖЕ СУЩЕСТВУЮЩИХ ТРЁХ (замер на живом
 * проде 06.09.2026, полный обход всех 1912 URL карты сайта: про алфавит
 * говорят 29 страниц, и по существу — четыре):
 *
 *   1. `/es/courses/a1/1` — урок. Таблица 33 букв в алфавитном порядке,
 *      сгруппированная «гласные / согласные / знаки». В строке: буква, её
 *      НАЗВАНИЕ (бэ, вэ, эль), транскрипция НАЗВАНИЯ и описание. Слова-
 *      примера у буквы нет ни одного, аудио подгружается клиентом из
 *      `/api/lesson-audio` и в серверном HTML его нет.
 *   2. `/es/gramatica/alfabeto-ruso` — гид. Проза, сгруппированная по
 *      трудности узнавания. Ни таблицы, ни транскрипций, ни аудио.
 *   3. `/es/sopa-de-letras-alfabeto-cirilico` — лендинг игры: два абзаца
 *      про буквы и сетка филворда.
 *   4. Эта страница — как буква звучит ВНУТРИ СЛОВА: у каждой из 33 есть
 *      слово-пример с транскрипцией по РЕАЛЬНОМУ произношению (аканье,
 *      оглушение, ассимиляция — стандарт блока «ЗАКРЫТО #4/#5» в
 *      PROGRESS.md) и со звуком. Ни один из первых трёх не даёт ни
 *      одного слова-примера на букву и ни одной транскрипции слова.
 *
 * Правило PROGRESS.md «гид, который просто повторяет урок, делать нельзя»
 * соблюдено не намерением, а числом: пересечение с уроком — это множество
 * {буква, её название}, 33 строки из 33; всё остальное (звук отдельно от
 * названия, испанское соответствие, слово-пример, его транскрипция, его
 * звук) на уроке отсутствует целиком.
 *
 * ЗВУК. Ни один клип не синтезируется заново: все 66 (33 названия букв +
 * 33 слова-примера) уже лежат в Blob и берутся из таблицы `AudioAsset` по
 * ключу `(contentType="lesson", contentId=<слаг урока>, itemKey)`. Ключ
 * выбран именно такой, потому что `contentId` урока — это его слаг
 * («a1-1»), одинаковый на локальной копии и на проде, в отличие от
 * `contentId` карточек, где это cuid и он между базами расходится
 * (правило №7). Проверено на живом проде 06.09.2026 опросом
 * `/api/lesson-audio` по 20 урокам: 66 из 66 ключей найдены, 66 из 66
 * файлов отдают 200; выдуманный ключ `alphabet-999` не найден, выдуманный
 * файл отдаёт 404.
 */

/** Путь страницы без префикса локали — один литерал на карту сайта,
 * саму страницу и тесты. */
export const ALPHABET_PAGE_PATH = "/alfabeto-cirilico";

export interface CyrillicLetter {
  /** Заглавная и строчная, как их показывает страница. */
  letter: string;
  /** Название буквы по-русски — оно же текст клипа `alphabet-<index>`. */
  name: string;
  /**
   * Позиция буквы в массиве `alphabet` урока a1-1. Это ЕДИНСТВЕННОЕ, чем
   * определяется `itemKey` клипа с названием буквы (`alphabetAudioKey`),
   * поэтому порядок здесь не может разойтись с порядком там молча:
   * `cyrillic-alphabet.test.ts` сверяет обе стороны построчно.
   */
  lessonAlphabetIndex: number;
  /** Звук буквы, а не её название: у «эль» звук [l], а не [el']. */
  sound: string;
  /** Ближайший испанский звук — нейтральный испанский, без мексиканизмов. */
  spanish: string;
  /** Слово-пример. */
  example: {
    ru: string;
    es: string;
    /**
     * Транскрипция по РЕАЛЬНОМУ произношению, а не побуквенная запись —
     * стандарт проекта (PROGRESS.md, блоки «ЗАКРЫТО #4» и «ЗАКРЫТО #5»):
     * аканье (о безударное → a), оглушение конечного согласного,
     * ассимиляция, ударение как в живой речи.
     */
    tr: string;
    /** Урок, чей клип озвучивает это слово, и ключ клипа внутри урока. */
    audio: { lessonId: string; itemKey: string };
  };
}

export const CYRILLIC_ALPHABET: readonly CyrillicLetter[] = [
  {
    letter: "А а", name: "а", lessonAlphabetIndex: 0, sound: "a",
    spanish: "la «a» de casa, idéntica",
    example: { ru: "мама", es: "mamá", tr: "máma", audio: { lessonId: "a1-1", itemKey: "exercise-listening-11" } },
  },
  {
    letter: "Б б", name: "бэ", lessonAlphabetIndex: 1, sound: "b",
    spanish: "la «b» de boca",
    example: { ru: "бабушка", es: "abuela", tr: "bábushka", audio: { lessonId: "a1-23", itemKey: "vocab-3" } },
  },
  {
    letter: "В в", name: "вэ", lessonAlphabetIndex: 2, sound: "v",
    spanish: "la «v» del inglés van, con los dientes sobre el labio: en español b y v suenan igual, en ruso no",
    example: { ru: "вода", es: "agua", tr: "vadá", audio: { lessonId: "a1-1", itemKey: "reading-4" } },
  },
  {
    letter: "Г г", name: "гэ", lessonAlphabetIndex: 3, sound: "g",
    spanish: "la «g» de gato, nunca la de gente",
    example: { ru: "город", es: "ciudad", tr: "górat", audio: { lessonId: "a1-11", itemKey: "vocab-4" } },
  },
  {
    letter: "Д д", name: "дэ", lessonAlphabetIndex: 4, sound: "d",
    spanish: "la «d» de dedo",
    example: { ru: "дом", es: "casa", tr: "dom", audio: { lessonId: "a1-1", itemKey: "exercise-listening-9" } },
  },
  {
    letter: "Е е", name: "е", lessonAlphabetIndex: 5, sound: "ye",
    spanish: "la «ye» de yeso; detrás de consonante la ablanda",
    example: { ru: "нет", es: "no", tr: "nyet", audio: { lessonId: "a1-1", itemKey: "vocab-7" } },
  },
  {
    letter: "Ё ё", name: "ё", lessonAlphabetIndex: 6, sound: "yo",
    spanish: "la «yo» de yodo; siempre lleva el acento de la palabra",
    example: { ru: "самолёт", es: "avión", tr: "samalyót", audio: { lessonId: "a1-12", itemKey: "reading-6" } },
  },
  {
    letter: "Ж ж", name: "жэ", lessonAlphabetIndex: 7, sound: "zh",
    spanish: "la «y» rioplatense de yo, o la «j» francesa de jour; el español estándar no la tiene",
    example: { ru: "жарко", es: "hace calor", tr: "zhárka", audio: { lessonId: "a2-4", itemKey: "exercise-listening-10" } },
  },
  {
    letter: "З з", name: "зэ", lessonAlphabetIndex: 8, sound: "z",
    spanish: "la «s» sonora de mismo, no la «z» de zapato",
    example: { ru: "зима", es: "invierno", tr: "zimá", audio: { lessonId: "a2-4", itemKey: "reading-0" } },
  },
  {
    letter: "И и", name: "и", lessonAlphabetIndex: 9, sound: "i",
    spanish: "la «i» de sí; además ablanda la consonante anterior",
    example: { ru: "играть", es: "jugar", tr: "igrát'", audio: { lessonId: "a1-27", itemKey: "vocab-20" } },
  },
  {
    letter: "Й й", name: "и краткое", lessonAlphabetIndex: 10, sound: "y",
    spanish: "la «i» breve de hay, nunca sola en una sílaba",
    example: { ru: "май", es: "mayo", tr: "may", audio: { lessonId: "a1-19", itemKey: "reading-4" } },
  },
  {
    letter: "К к", name: "ка", lessonAlphabetIndex: 11, sound: "k",
    spanish: "la «c» de casa",
    example: { ru: "кот", es: "gato", tr: "kot", audio: { lessonId: "a1-1", itemKey: "exercise-listening-10" } },
  },
  {
    letter: "Л л", name: "эль", lessonAlphabetIndex: 12, sound: "l",
    spanish: "la «l» de luna, pero más gruesa, con la lengua más atrás",
    example: { ru: "школа", es: "escuela", tr: "shkóla", audio: { lessonId: "a1-1", itemKey: "reading-5" } },
  },
  {
    letter: "М м", name: "эм", lessonAlphabetIndex: 13, sound: "m",
    spanish: "la «m» de mano",
    example: { ru: "море", es: "mar", tr: "mórye", audio: { lessonId: "a2-15", itemKey: "vocab-7" } },
  },
  {
    letter: "Н н", name: "эн", lessonAlphabetIndex: 14, sound: "n",
    spanish: "la «n» de nada",
    example: { ru: "ночь", es: "noche", tr: "noch'", audio: { lessonId: "a1-18", itemKey: "vocab-4" } },
  },
  {
    letter: "О о", name: "о", lessonAlphabetIndex: 15, sound: "o",
    spanish: "la «o» de solo, pero SOLO cuando lleva el acento; sin acento suena «a»",
    example: { ru: "окно", es: "ventana", tr: "aknó", audio: { lessonId: "a1-3", itemKey: "vocab-2" } },
  },
  {
    letter: "П п", name: "пэ", lessonAlphabetIndex: 16, sound: "p",
    spanish: "la «p» de pan",
    example: { ru: "папа", es: "papá", tr: "pápa", audio: { lessonId: "a1-1", itemKey: "grammar-example-1" } },
  },
  {
    letter: "Р р", name: "эр", lessonAlphabetIndex: 17, sound: "r",
    spanish: "la «r» vibrante de perro, siempre múltiple",
    example: { ru: "рука", es: "mano", tr: "ruká", audio: { lessonId: "a2-8", itemKey: "vocab-1" } },
  },
  {
    letter: "С с", name: "эс", lessonAlphabetIndex: 18, sound: "s",
    spanish: "la «s» de sopa",
    example: { ru: "стол", es: "mesa", tr: "stol", audio: { lessonId: "a1-1", itemKey: "vocab-11" } },
  },
  {
    letter: "Т т", name: "тэ", lessonAlphabetIndex: 19, sound: "t",
    spanish: "la «t» de taza",
    example: { ru: "такси", es: "taxi", tr: "taksí", audio: { lessonId: "a1-12", itemKey: "reading-4" } },
  },
  {
    letter: "У у", name: "у", lessonAlphabetIndex: 20, sound: "u",
    spanish: "la «u» de luna",
    example: { ru: "улица", es: "calle", tr: "úlitsa", audio: { lessonId: "a1-11", itemKey: "reading-5" } },
  },
  {
    letter: "Ф ф", name: "эф", lessonAlphabetIndex: 21, sound: "f",
    spanish: "la «f» de foco",
    example: { ru: "фильм", es: "película", tr: "fil'm", audio: { lessonId: "a1-13", itemKey: "reading-1" } },
  },
  {
    letter: "Х х", name: "ха", lessonAlphabetIndex: 22, sound: "kh",
    spanish: "la «j» de jamón, algo más suave",
    example: { ru: "хлеб", es: "pan", tr: "khlyep", audio: { lessonId: "a1-21", itemKey: "reading-2" } },
  },
  {
    letter: "Ц ц", name: "цэ", lessonAlphabetIndex: 23, sound: "ts",
    spanish: "«ts», como la doble z del italiano pizza; nunca se ablanda",
    example: { ru: "центр", es: "centro", tr: "tsentr", audio: { lessonId: "a2-29", itemKey: "vocab-9" } },
  },
  {
    letter: "Ч ч", name: "че", lessonAlphabetIndex: 24, sound: "ch",
    spanish: "la «ch» de charco; en ruso siempre es blanda",
    example: { ru: "чай", es: "té", tr: "chay", audio: { lessonId: "a1-5", itemKey: "vocab-1" } },
  },
  {
    letter: "Ш ш", name: "ша", lessonAlphabetIndex: 25, sound: "sh",
    spanish: "la «sh» del inglés show, dura; el español no la tiene",
    example: { ru: "шкаф", es: "armario", tr: "shkaf", audio: { lessonId: "a2-6", itemKey: "vocab-12" } },
  },
  {
    letter: "Щ щ", name: "ща", lessonAlphabetIndex: 26, sound: "shch",
    spanish: "una «sh» larga y blanda, la lengua más cerca de los dientes que en ш",
    example: { ru: "площадь", es: "plaza", tr: "plóshchat'", audio: { lessonId: "a1-8", itemKey: "exercise-listening-9" } },
  },
  {
    letter: "Ъ ъ", name: "твёрдый знак", lessonAlphabetIndex: 27, sound: "—",
    spanish: "no suena: separa el prefijo de la vocal que sigue, para que no se peguen",
    example: { ru: "подъезд", es: "portal", tr: "padyést", audio: { lessonId: "a2-6", itemKey: "vocab-8" } },
  },
  {
    letter: "Ы ы", name: "ы", lessonAlphabetIndex: 28, sound: "y",
    spanish: "no existe en español: una «i» con la lengua echada hacia atrás, la boca tensa",
    example: { ru: "музыка", es: "música", tr: "múzyka", audio: { lessonId: "a1-13", itemKey: "exercise-listening-transcription-15" } },
  },
  {
    letter: "Ь ь", name: "мягкий знак", lessonAlphabetIndex: 29, sound: "—",
    spanish: "no suena: ablanda la consonante anterior, algo parecido a la distancia entre n y ñ",
    example: { ru: "мать", es: "madre", tr: "mat'", audio: { lessonId: "a1-1", itemKey: "grammar-example-4" } },
  },
  {
    letter: "Э э", name: "э", lessonAlphabetIndex: 30, sound: "e",
    spanish: "la «e» de mesa, sin la «i» delante que lleva е",
    example: { ru: "этаж", es: "piso, planta", tr: "etásh", audio: { lessonId: "a1-28", itemKey: "vocab-16" } },
  },
  {
    letter: "Ю ю", name: "ю", lessonAlphabetIndex: 31, sound: "yu",
    spanish: "la «yu» de yugo",
    example: { ru: "юбка", es: "falda", tr: "yúpka", audio: { lessonId: "a2-28", itemKey: "vocab-5" } },
  },
  {
    letter: "Я я", name: "я", lessonAlphabetIndex: 32, sound: "ya",
    spanish: "la «ya» de ya",
    example: { ru: "яблоко", es: "manzana", tr: "yáblaka", audio: { lessonId: "a1-22", itemKey: "vocab-14" } },
  },
];

/**
 * Восемь букв-ловушек для испаноязычного. Шесть первых — те, что
 * существуют и в латинице, поэтому глаз читает их автоматически и каждый
 * раз ошибается; две последние ловят иначе: ы не читается никак, а ь
 * выглядит необязательным украшением, хотя меняет слово.
 *
 * Порядок — тот же, что в задании владельца (В, Р, С, Н, У, Х, Ы, Ь), а
 * не алфавитный: он идёт от самой частой ошибки к самой тонкой.
 */
export interface AlphabetTrap {
  letter: string;
  /** Что видит глаз, привыкший к латинице. */
  looksLike: string;
  /** Что это на самом деле. */
  reallyIs: string;
  /** Пара слов, на которой ошибка слышна. */
  proof: { ru: string; es: string; tr: string };
}

export const ALPHABET_TRAPS: readonly AlphabetTrap[] = [
  {
    letter: "В в",
    looksLike: "una «b»",
    reallyIs: "«v», con los dientes sobre el labio inferior",
    proof: { ru: "Москва", es: "Moscú", tr: "maskvá" },
  },
  {
    letter: "Р р",
    looksLike: "una «p»",
    reallyIs: "«r» vibrante, la de perro",
    proof: { ru: "ресторан", es: "restaurante", tr: "ryestarán" },
  },
  {
    letter: "С с",
    looksLike: "una «c»",
    reallyIs: "«s», siempre y en cualquier posición",
    proof: { ru: "суп", es: "sopa", tr: "sup" },
  },
  {
    letter: "Н н",
    looksLike: "una «h»",
    reallyIs: "«n»",
    proof: { ru: "нос", es: "nariz", tr: "nos" },
  },
  {
    letter: "У у",
    looksLike: "una «y»",
    reallyIs: "«u»",
    proof: { ru: "утро", es: "mañana", tr: "útra" },
  },
  {
    letter: "Х х",
    looksLike: "una equis",
    reallyIs: "«j» aspirada, la de jamón",
    proof: { ru: "хорошо", es: "bien", tr: "kharashó" },
  },
  {
    letter: "Ы ы",
    looksLike: "una «bl» pegada, o nada reconocible",
    reallyIs: "una vocal propia, entre «i» y «u», que distingue palabras enteras",
    proof: { ru: "быть", es: "ser, estar — frente a бить, golpear", tr: "byt'" },
  },
  {
    letter: "Ь ь",
    looksLike: "un adorno prescindible",
    reallyIs: "la marca de que la consonante anterior se ablanda; quitarla cambia la palabra",
    proof: { ru: "мать", es: "madre — frente a мат, jaque mate", tr: "mat'" },
  },
];
