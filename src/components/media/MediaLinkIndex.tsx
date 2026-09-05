import Link from "next/link";
import { mediaLevels } from "@/lib/media/types";
import { groupByLevel } from "@/lib/catalog-link-index";
import type { CatalogLinkIndexDict } from "@/components/stories/StoryLinkIndex";

export type { CatalogLinkIndexDict };

export interface MediaLinkIndexRow {
  id: string;
  title: string;
  level: string;
}

/**
 * Серверный список ссылок на КАЖДЫЙ элемент медиатеки, под клиентским
 * каталогом. Пара к `StoryLinkIndex` — см. его комментарий про механизм и
 * про то, почему печатается ссылка, а не карточка.
 *
 * Один содержательный разрыв с каталогом выше, и он намеренный: каталог
 * прячет элементы с `embedStatus === "blocked"` (лучше пропажа карточки,
 * чем мёртвый плеер у живого человека), а этот список печатает их тоже.
 * Причина числом: заблокированный на проде 05.09.2026 ровно один —
 * `song-ty-uydyosh`, — и он стоит и в карте сайта (все 275 элементов
 * там), и в базовой линии заморозки (docs/frozen-baseline-2026-08-30.json,
 * обе локали). Отфильтруй его здесь — и 329 замороженных URL получили бы
 * по одной новой входящей ссылке, а один ноль: неодинаковое обращение
 * внутри измеряемой группы. Страница у него при этом настоящая — текст,
 * лексика, упражнения, — и краулер к ней и так зван картой сайта.
 */
export default function MediaLinkIndex({
  lang,
  items,
  dict,
}: {
  lang: string;
  items: readonly MediaLinkIndexRow[];
  dict: CatalogLinkIndexDict;
}) {
  const groups = groupByLevel(items, mediaLevels, lang);
  if (groups.length === 0) return null;

  return (
    <section className="mt-12 border-t border-black/10 pt-8 dark:border-white/30" data-testid="media-link-index">
      <h2 className="text-xl font-semibold tracking-tight">{dict.indexTitle}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-foreground/70">{dict.indexIntro}</p>

      <div className="mt-6 flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.level}>
            <h3 className="text-sm font-semibold text-foreground/70">{group.level}</h3>
            <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
              {group.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/${lang}/media/${item.id}`}
                    className="block py-1 text-sm leading-6 text-foreground/80 underline-offset-4 hover:underline"
                  >
                    {item.title}
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
