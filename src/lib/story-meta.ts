import { fixBrandSpelling } from "@/lib/story-author";

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
 * Обрезка до потолка выдачи (`truncateForMeta`) — у вызывающего, как и
 * была.
 */
export function storyMetaDescription(
  story: { description: string | null; descriptionRu: string | null; level: string },
  lang: "es" | "ru",
  title: string,
): string {
  if (lang === "ru") {
    return story.descriptionRu
      ? fixBrandSpelling(story.descriptionRu)
      : `«${title}» — рассказ на русском языке, уровень ${story.level}, в RusoFácilapp.`;
  }
  return story.description
    ? fixBrandSpelling(story.description)
    : `Cuento en ruso, nivel ${story.level}, en RusoFácilapp.`;
}
