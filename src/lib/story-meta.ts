/**
 * МЕТА-ОПИСАНИЕ СТРАНИЦЫ РАССКАЗА — ДОЛГ 205, ЗАХОД 7.274.
 *
 * До 7.274 на `/ru/stories/…` в `<meta name="description">` стояло
 * испанское описание: подстраховка «нет русского — дать испанское», а
 * `descriptionRu` пуст у 325 рассказов из 325 (долг 204). Каталог тем же
 * правилом вылечен ещё в 7.196 («на `/ru` только русское описание или
 * ничего»); страницу рассказа держала заморозка 330 URL — `description`
 * был одним из сличаемых полей. Заморозка снята 08.10.2026 (7.258).
 *
 * Правило теперь одно на обе локали: описание — только на языке
 * страницы. На `/ru` — русская аннотация, когда она появится (долг 204),
 * а пока её нет — русская строка с названием рассказа и уровнем: своя у
 * каждой страницы, и ничего не утверждает сверх того, что на странице
 * есть. На `/es` не изменилось ничего: испанское описание, без него —
 * прежняя испанская строка.
 *
 * Починка написания имени проекта (`fixBrandSpelling`) и обрезка до
 * потолка выдачи (`truncateForMeta`) — у вызывающего, как и были: их
 * место на странице держит `check:brand` (7.239).
 */
export function storyMetaDescription(
  story: { description: string | null; descriptionRu: string | null; level: string },
  lang: "es" | "ru",
  title: string,
): string {
  if (lang === "ru") {
    return story.descriptionRu
      ? story.descriptionRu
      : `«${title}» — рассказ на русском языке, уровень ${story.level}, в RusoFácilapp.`;
  }
  return story.description
    ? story.description
    : `Cuento en ruso, nivel ${story.level}, en RusoFácilapp.`;
}

/**
 * ВИДИМОЕ ОПИСАНИЕ ПОД ЗАГОЛОВКОМ РАССКАЗА — ДОЛГ 204, ЗАХОД 7.275.
 *
 * Решение владельца 18.10.2026 (вариант «а»): на `/ru` испанская аннотация
 * под русским заголовком не печатается — так же, как в каталоге
 * `/ru/stories` с 7.196. Абзац появится сам, когда у рассказа будет
 * `descriptionRu` (сейчас пуст у 325 из 325 — долг 204, работа по
 * содержимому). На `/es` — испанская аннотация, как и была.
 */
export function storyVisibleDescription(
  story: { description: string | null; descriptionRu: string | null },
  lang: "es" | "ru",
): string | null {
  return (lang === "ru" ? story.descriptionRu : story.description) || null;
}

/**
 * ОПИСАНИЕ В РАЗМЕТКЕ `Article` (application/ld+json) — ОСТАТОК ДОЛГА 205,
 * ЗАХОД 7.275.
 *
 * После 7.274 мета-описание `/ru` стало русским, а `description` в
 * ld+json той же страницы остался испанским («Nastia lava la ropa como
 * cada…» на «День стирки» — нашёл владелец). Теперь на `/ru` это та же
 * строка, что в `<meta name="description">` (`storyMetaDescription`): одна
 * страница — одно описание. На `/es` — испанская аннотация, а без неё
 * поля нет, как и было.
 */
export function storyArticleDescription(
  story: { description: string | null; descriptionRu: string | null; level: string },
  lang: "es" | "ru",
  title: string,
): string | null {
  return lang === "ru" ? storyMetaDescription(story, lang, title) : story.description || null;
}
