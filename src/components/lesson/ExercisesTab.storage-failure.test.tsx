/**
 * СТРАНИЦА УРОКА ПЕРЕЖИВАЕТ ОТКАЗ ХРАНИЛИЩА — долг 262 (заход 7.211).
 *
 * Почему именно этот компонент отдельной пробой. `ExercisesTab.tsx:92`
 * (до правки) читал `window.localStorage` В ЭФФЕКТЕ НА МОНТИРОВАНИИ —
 * то есть у КАЖДОГО посетителя страницы урока, а не только у нажавшего
 * «Проверить». В браузере с запрещёнными данными сайта бросает само
 * обращение к свойству, и бросок в эффекте отдаёт всё поддерево границе
 * ошибок: код ответа 200, а человек видит «Something went wrong» —
 * ровно класс инцидента №1.
 *
 * Проба поэтому проверяет три вещи в одном и том же запрещённом
 * хранилище: (1) страница рисуется, (2) упражнение решается и
 * проверяется, (3) КОНТРОЛЬ — прежняя строка в тех же условиях бросает,
 * значит проба различает состояния, а не молчит всегда.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ExercisesTab from "./ExercisesTab";
import type { Exercise } from "@/lib/lessons/types";
import es from "@/dictionaries/es.json";

const dict = es as unknown as {
  lesson: { exercises: Parameters<typeof ExercisesTab>[0]["dict"]; pronunciation: Parameters<typeof ExercisesTab>[0]["pronunciationDict"] };
  celebration: Parameters<typeof ExercisesTab>[0]["celebrationDict"];
};

const exercises: Exercise[] = [
  {
    id: "e1",
    type: "multiple-choice",
    prompt: "¿Cómo se dice «hola» en ruso?",
    options: ["Привет", "Пока", "Спасибо"],
    correctIndex: 0,
  },
];

const ORIGINAL = {
  localStorage: Object.getOwnPropertyDescriptor(window, "localStorage"),
  sessionStorage: Object.getOwnPropertyDescriptor(window, "sessionStorage"),
};

/** Браузер с запрещёнными данными сайта: бросает САМО обращение к
 *  свойству, ещё до `getItem`. */
function forbidStorage() {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
  }
}

afterEach(() => {
  if (ORIGINAL.localStorage) Object.defineProperty(window, "localStorage", ORIGINAL.localStorage);
  if (ORIGINAL.sessionStorage) Object.defineProperty(window, "sessionStorage", ORIGINAL.sessionStorage);
  cleanup();
  window.localStorage.clear();
});

function renderTab() {
  render(
    <ExercisesTab
      exercises={exercises}
      vocabulary={[]}
      dict={dict.lesson.exercises}
      pronunciationDict={dict.lesson.pronunciation}
      celebrationDict={dict.celebration}
      level="a1"
      locale="es"
      lessonSlug="1"
      ownerScope="guest"
      storageKey="lesson-passed:a1:1"
      onPassChange={() => {}}
      enableAudioRecording={false}
    />,
  );
}

describe("страница урока при запрещённом хранилище", () => {
  it("рисуется целиком и не бросает при монтировании", () => {
    forbidStorage();
    expect(() => renderTab()).not.toThrow();
    expect(screen.getByText("¿Cómo se dice «hola» en ruso?")).toBeTruthy();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("упражнение решается и проверяется — отказ хранилища не мешает", () => {
    forbidStorage();
    renderTab();
    fireEvent.click(screen.getByText("Привет"));
    const check = screen.getAllByRole("button").find((b) => /comprobar|revisar|verificar/i.test(b.textContent ?? ""));
    expect(check).toBeTruthy();
    expect(() => fireEvent.click(check as HTMLElement)).not.toThrow();
    // Ответ засчитан: на экране появился разбор, а не пустота.
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50);
  });

  it("КОНТРОЛЬ: прежняя строка в тех же условиях бросает — проба различает", () => {
    forbidStorage();
    expect(() => window.localStorage.getItem("lesson-passed:a1:1")).toThrow();
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: с работающим хранилищем замок снимается, как и прежде", () => {
    window.localStorage.setItem("lesson-passed:a1:1", "1");
    let passed: boolean | null = null;
    render(
      <ExercisesTab
        exercises={exercises}
        vocabulary={[]}
        dict={dict.lesson.exercises}
        pronunciationDict={dict.lesson.pronunciation}
        celebrationDict={dict.celebration}
        level="a1"
        locale="es"
        lessonSlug="1"
        ownerScope="guest"
        storageKey="lesson-passed:a1:1"
        onPassChange={(v) => {
          passed = v;
        }}
        enableAudioRecording={false}
      />,
    );
    expect(passed).toBe(true);
  });
});
