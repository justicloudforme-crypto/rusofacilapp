import type { Dictionary } from "@/i18n/dictionaries";
import type { WordGamePlayerDict } from "@/components/word-games/WordGamePlayer";

/**
 * Словарь плеера пазлов — собранный в ОДНОМ месте, потому что собирают
 * его пять страниц (страница пазла, три игровых лендинга и тематический
 * лендинг), и разъехаться они обязаны все сразу или никак.
 *
 * Строка «выучено N из M» берётся из раздела `vocabulary`, а не
 * копируется в `wordGames`: предложение то же самое, что под панелью
 * результата в режимах словаря (PROGRESS 7.75, 7.76), и вторая копия
 * текста разошлась бы с первой при первой же правке — включая
 * знаменатель, который для не-Premium обязан считать только доступные
 * слова.
 */
export function wordGamePlayerDict(dict: Dictionary): WordGamePlayerDict {
  return {
    ...dict.wordGames,
    learnedProgressLabel: dict.vocabulary.learnedProgressLabel,
    learnedProgressAvailableLabel: dict.vocabulary.learnedProgressAvailableLabel,
  };
}
