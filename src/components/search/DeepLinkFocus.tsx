"use client";

import { useEffect } from "react";
import { anchorTarget, cardAnchor } from "@/lib/deep-link-anchors";

/**
 * Доводит глубокую ссылку до объекта на серверной странице: прокручивает
 * к нему и подсвечивает.
 *
 * Почему это не делается одним браузером. Браузер к якорю прокручивает,
 * но ставит элемент ВЕРХНЕЙ кромкой под шапку, а на списке из сотни строк
 * «сверху под шапкой» и «в поле зрения» — не одно и то же на всех
 * высотах; и подсветки он не даёт никакой, поэтому человек, пришедший из
 * поиска за одним словом, всё равно ищет его глазами среди соседей.
 * Здесь: `block: "center"` и класс `.deep-link-focus`.
 *
 * `hashchange` слушается намеренно: вторая строка выдачи на той же
 * странице — это смена хеша без перемонтирования, и без слушателя она
 * молча не делала бы ничего.
 */
export default function DeepLinkFocus({ prefix = cardAnchor("") }: { prefix?: string }) {
  useEffect(() => {
    let previous: HTMLElement | null = null;

    function focus() {
      const id = anchorTarget(window.location.hash, prefix);
      if (previous) {
        previous.classList.remove("deep-link-focus");
        previous.removeAttribute("data-deep-link-focus");
        previous = null;
      }
      if (!id) return;
      const element = document.getElementById(`${prefix}${id}`);
      if (!element) return;
      element.scrollIntoView({ block: "center", behavior: "auto" });
      element.classList.add("deep-link-focus");
      // Отдельный атрибут, а не проверка класса: сторож обязан спрашивать
      // «доведено ли до объекта», а не «какой на нём сегодня фон».
      element.setAttribute("data-deep-link-focus", "true");
      previous = element;
    }

    focus();
    window.addEventListener("hashchange", focus);
    return () => {
      window.removeEventListener("hashchange", focus);
      previous?.classList.remove("deep-link-focus");
      previous?.removeAttribute("data-deep-link-focus");
    };
  }, [prefix]);

  return null;
}
