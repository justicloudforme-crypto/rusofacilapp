"use client";

import { SEARCH_OPEN_EVENT } from "@/lib/search/open-event";

/**
 * «Поиск» как кнопка, а не ссылка, — потому что у поиска на этом сайте нет
 * адреса: `?q=` в строку браузера не пишется намеренно
 * (`src/components/GlobalSearch.tsx`). Кнопка говорит окну поиска в шапке
 * «откройся» событием; разметка шапки при этом не меняется ни на одной
 * странице — `GlobalSearch` только подписывается.
 */
export default function OpenSearchButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      data-testid="not-found-search"
      onClick={() => window.dispatchEvent(new Event(SEARCH_OPEN_EVENT))}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-6 text-sm font-semibold transition-colors hover:border-foreground/40 dark:border-white/15"
    >
      {label}
    </button>
  );
}
