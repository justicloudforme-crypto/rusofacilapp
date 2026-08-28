/**
 * The 50 stories that carry the "what's in this story" block (see
 * src/lib/story-insights.ts). A pilot, not a rollout: the block is a new
 * shape of page and the point is to measure it on a slice before deciding
 * about the other 600.
 *
 * Selection rule, chosen before looking at any per-story numbers so the
 * pilot can't be cherry-picked:
 *
 *   all A1 stories, ordered by title, first 50 of 65.
 *
 * A1 because Spanish search demand is highest at the beginner end
 * ("cuentos en ruso para principiantes"), and because 49 of these 50 are
 * premium — i.e. exactly the thin, paywalled shape the block is meant to
 * fix. Taking 50 of 65 deliberately leaves **15 A1 stories untouched as a
 * control group**: same level, same page shape, same paywall, no block.
 * If impressions move, the control is what tells us whether the block did
 * it or the whole site drifted.
 *
 * Keyed by title rather than Story.id on purpose. Story.id drifts between
 * dev.db and Turso for most rows (see PROGRESS.md's story-transfer rule
 * and the comment on MediaItem.relatedStories), so an id list captured
 * against one database silently points at the wrong rows in the other.
 * (title, level) is the safe key used everywhere else in this project.
 */

const PILOT_A1_TITLES = new Set([
  "Аквариум в гостиной",
  "Бабочка для праздника",
  "Бумажный кораблик",
  "Бутерброд для Ромы",
  "Воздушный змей на дереве",
  "Воздушный шарик",
  "Гаммы перед ужином",
  "Даша учится плавать",
  "Два одинаковых завтрака",
  "Дедушкин огород",
  "День стирки",
  "Дождливый день",
  "Жаркий день",
  "Завтрак в семье",
  "Занятия гончарным делом по средам",
  "Занятия йогой в парке",
  "Запасной ключ",
  "Заюшкина избушка",
  "Зёрнышко в горшке",
  "Колобок",
  "Копилка Тимура",
  "Кот, петух и лиса",
  "Кружок вязания по вторникам",
  "Кружок оригами по понедельникам",
  "Куда положить бутылку?",
  "Курочка Ряба",
  "Мамина шляпа",
  "Молочный зуб",
  "Мороженое для двоих",
  "Мяч на крыше",
  "Новая девочка в классе",
  "Новая рыбка",
  "Новый сосед",
  "Новый фрукт",
  "Носки из корзины",
  "Очередь в пекарне",
  "Первый гол",
  "Первый снег",
  "Плюшевый заяц",
  "Подарок для мамы",
  "Поход в библиотеку",
  "Поход в зоопарк",
  "Пробежка вдоль реки",
  "Прогулка на велосипеде",
  "Прогулка с собакой",
  "Радуга после дождя",
  "Репка",
  "Рыбалка с дедушкой по выходным",
  "Секрет бабушкиного пирога",
  "Секретный узел",
]);

/**
 * The other 15 A1 stories — the control group. They deliberately have no
 * block, and the point of a control is that nothing else about them
 * changes either, so they must stay out of any later content work until
 * the experiment closes (25.09.2026). Written down here, next to the
 * pilot, so the freeze is machine-checkable rather than a list that only
 * exists in PROGRESS.md: `story-culture.test.ts` asserts against it.
 */
const CONTROL_A1_TITLES = new Set([
  "Сколько тарелок?",
  "Слишком много воды",
  "Слишком солёный суп",
  "Снегурочка",
  "Сортировка мусора дома",
  "Соседский кот",
  "Стол по инструкции",
  "Считаем секунды",
  "Теремок",
  "Три медведя",
  "Трудная задача",
  "Уборка в субботу",
  "Урок рисования",
  "Чтение перед сном",
  "Шнурки на ботинках",
]);

export const STORY_PILOT_SIZE = PILOT_A1_TITLES.size;
export const STORY_CONTROL_SIZE = CONTROL_A1_TITLES.size;

export function isPilotStory(story: { title: string; level: string }): boolean {
  return story.level === "A1" && PILOT_A1_TITLES.has(story.title);
}

export function isControlStory(story: { title: string; level: string }): boolean {
  return story.level === "A1" && CONTROL_A1_TITLES.has(story.title);
}

/** Pilot or control — i.e. off limits to any content change until the
 * experiment closes. Three of the library's classic tales (Три медведя,
 * Теремок, Снегурочка) land in the control group, which is why they get
 * no cultural note. */
export function isFrozenStory(story: { title: string; level: string }): boolean {
  return isPilotStory(story) || isControlStory(story);
}
