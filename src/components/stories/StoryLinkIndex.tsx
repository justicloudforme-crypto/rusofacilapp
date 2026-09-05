import Link from "next/link";
import { storyLevels } from "@/lib/stories";
import { groupByLevel } from "@/lib/catalog-link-index";

export interface CatalogLinkIndexDict {
  indexTitle: string;
  indexIntro: string;
}

export interface StoryLinkIndexRow {
  id: string;
  title: string;
  level: string;
}

/**
 * Серверный список ссылок на КАЖДЫЙ рассказ, под клиентским каталогом.
 *
 * Тот же приём и по той же причине, что `FreePuzzleIndex` у игровых
 * страниц: каталог — клиентский компонент, его сетка следует состоянию
 * React, поэтому сервер печатает ровно первые 24 карточки. Замер прода
 * 05.09.2026: `<a>` на карточки — 24 на каждой из четырёх страниц, при
 * том что id всех 325 рассказов в отданном HTML уже есть, а кнопка прямо
 * в разметке написана «Cargar más (301 restantes)». Не хватало не данных,
 * а тегов `<a>`.
 *
 * Печатается ссылка, а не карточка. Уровень, автор, бейдж премиума,
 * длительность и прогресс — это витрина, она у каталога выше; здесь нужно
 * ровно одно ребро графа на каждый URL и осмысленный анкор (заголовок
 * рассказа). Разница в цене — в килобайтах на страницу, и она названа
 * числом в PROGRESS.md 7.113.
 *
 * Замороженные рассказы (65 из 325, то есть 130 URL, см. story-pilot.ts)
 * НЕ выделяются и не пропускаются: каждый из них получает ровно одну
 * входящую ссылку — столько же, сколько любой другой. Обращение обязано
 * быть одинаковым для обеих сторон эксперимента и для всех остальных,
 * иначе список сам стал бы вмешательством в замер.
 */
export default function StoryLinkIndex({
  lang,
  stories,
  dict,
}: {
  lang: string;
  stories: readonly StoryLinkIndexRow[];
  dict: CatalogLinkIndexDict;
}) {
  const groups = groupByLevel(stories, storyLevels, lang);
  if (groups.length === 0) return null;

  return (
    <section className="mt-12 border-t border-black/10 pt-8 dark:border-white/30" data-testid="story-link-index">
      <h2 className="text-xl font-semibold tracking-tight">{dict.indexTitle}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/70">{dict.indexIntro}</p>

      <div className="mt-6 flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.level}>
            <h3 className="text-sm font-semibold text-foreground/70">{group.level}</h3>
            {/* Сетка с объявленными дорожками, а не `flex flex-wrap`:
                правило заполнения (scripts/layout-fill.mjs, PROGRESS.md
                7.73/7.74) меряет ряд против контейнера, и незаполненный
                последний ряд объявленной сетки оно пропускает, а у
                переноса — считает дырой. */}
            <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
              {group.items.map((story) => (
                <li key={story.id}>
                  <Link
                    href={`/${lang}/stories/${story.id}`}
                    className="block py-1 text-sm leading-6 text-foreground/80 underline-offset-4 hover:underline"
                  >
                    {story.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
