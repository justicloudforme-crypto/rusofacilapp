import type { ElementType } from "react";
import type { StoryTitleView } from "@/lib/story-title";

/**
 * Название рассказа так, как его показывают читателю: испанское крупно,
 * русский оригинал под ним мельче. Правило, КОГДА второй строки нет, —
 * не здесь, а в `src/lib/story-title.ts`; сюда приходит уже готовая пара.
 *
 * Почему кегль второй строки задан в `em`, а не в `text-sm`. Этот
 * компонент стоит и в `<h1>` на 30px, и в карточке каталога на 18px, и в
 * строке списка на 14px. Фиксированный класс сделал бы «мельче» правдой
 * ровно в одном из трёх мест, а в списке — ещё и крупнее основной строки.
 * Тот же урок, что 7.136: кнопка была задана в rem, а её полоса — в
 * пикселях, и при корневом кегле 18–20px раскладка ломалась.
 */
export default function StoryTitle({
  titles,
  as: Tag = "span" as ElementType,
  className,
}: {
  titles: StoryTitleView;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag className={className} data-testid="story-title">
      <span data-testid="story-title-primary">{titles.primary}</span>
      {titles.secondary !== null && (
        <span
          lang="ru"
          data-testid="story-title-original"
          className="block text-[0.72em] font-normal leading-snug tracking-normal text-foreground/55"
        >
          {titles.secondary}
        </span>
      )}
    </Tag>
  );
}
