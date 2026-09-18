"use client";

import { Component, type ReactNode } from "react";

/**
 * ГРАНИЦА ОШИБОК ВОКРУГ ПОДСВЕТКИ. Текст урока обязан остаться на
 * экране, что бы ни случилось с автоссылками.
 *
 * ПОЧЕМУ ЭТОГО НЕ ХВАТАЛО РАНЬШЕ. С 29.08.2026 в `GlossaryText` стоял
 * `try/catch` — но ровно вокруг ОДНОЙ строки, вокруг `new RegExp`. Всё
 * остальное, что подсветка делает, границы не имело: цикл `exec`,
 * разрезание текста на куски и отрисовка `GlossaryTermPopover` у каждого
 * найденного термина. Исключение оттуда поднималось до ближайшей
 * `error.tsx` маршрута — то есть уносило ВСЮ страницу урока, как 29.08.
 *
 * Правило здесь то же, что в PROGRESS.md 7.24 про чтения базы:
 * деградация вместо отказа. Подсветка — украшение, урок — товар. Если
 * украшение упало, человек обязан увидеть текст, а не «Something went
 * wrong».
 *
 * Классовый компонент, потому что перехват ошибок отрисовки в React
 * делается только так — хука для этого нет.
 */
export default class HighlightBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Не `throw` дальше: запись в консоль видно и в Sentry (хлебной
    // крошкой), а страницу это не трогает.
    console.error("[glossary] подсветка терминов упала — текст показан без ссылок", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
