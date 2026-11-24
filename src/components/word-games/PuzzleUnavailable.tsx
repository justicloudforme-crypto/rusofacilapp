/**
 * На месте пазла, когда база не ответила (заход 7.305, `src/lib/page-read.ts`).
 * Только испанский: игровые лендинги есть только на `/es`.
 *
 * Слов границы ошибок («Algo salió mal») здесь нет намеренно: страница
 * жива — текст, заголовок и ссылки на месте, недоступен один блок.
 * Ссылка «Reintentar» — обычный переход на ту же страницу: страница не
 * кешируется, повтор снова спросит базу.
 */
export default function PuzzleUnavailable({ href, plural = false }: { href: string; plural?: boolean }) {
  return (
    <div
      data-testid="puzzle-unavailable"
      role="status"
      className="rounded-2xl border border-black/10 p-5 text-foreground/70 dark:border-white/30"
    >
      <p className="font-medium text-foreground">
        {plural ? "La lista de puzles no se puede cargar ahora mismo." : "El puzle no se puede cargar ahora mismo."}
      </p>
      <p className="mt-2 text-sm leading-6">
        El resto de la página funciona con normalidad. Vuelve a intentarlo en unos minutos.
      </p>
      <a
        href={href}
        className="tap mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary-text underline-offset-2 hover:underline active:underline dark:text-primary-400"
      >
        Reintentar
      </a>
    </div>
  );
}
