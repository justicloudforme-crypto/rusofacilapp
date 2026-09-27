/**
 * ПОКА ПРОШЛАЯ ПОПЫТКА НЕ ВОССТАНОВЛЕНА — НЕ ПОКАЗЫВАТЬ ПУСТУЮ ФОРМУ
 * (заход 7.238, задача А2).
 *
 * Видео POCO: при возврате сети живая страница урока около секунды рисовала
 * «Progreso 0/17 respondidos», а потом — «Este es tu intento anterior».
 * Замер в браузере (GET `/api/progress` через 1 с): до правки пустая форма
 * 74 → 1065 мс, после — заглушка столько же и сразу прошлая попытка.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ExercisesTab from "./ExercisesTab";
import type { Exercise } from "@/lib/lessons/types";
import es from "@/dictionaries/es.json";

const dict = es as unknown as {
  lesson: { exercises: Parameters<typeof ExercisesTab>[0]["dict"]; pronunciation: Parameters<typeof ExercisesTab>[0]["pronunciationDict"] };
  celebration: Parameters<typeof ExercisesTab>[0]["celebrationDict"];
};

const exercises: Exercise[] = [
  { id: "e1", type: "multiple-choice", prompt: "¿Cómo se dice «hola» en ruso?", options: ["Привет", "Пока"], correctIndex: 0 },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderTab() {
  const { container } = render(
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
  return container;
}

/** Ответ сервера о прошлой попытке придёт, когда его отпустят. */
function heldServer() {
  let release: (attempt: unknown) => void = () => {};
  const answer = new Promise((resolve) => (release = resolve));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ attempt: await answer }) })),
  );
  return (attempt: unknown) => release(attempt);
}

describe("вкладка упражнений до восстановления попытки (7.238, А2)", () => {
  it("ответа ещё нет: заглушка, а не «Progreso 0/1»; пришла попытка — «Este es tu intento anterior»", async () => {
    const release = heldServer();
    const container = renderTab();
    expect(container.querySelector("[data-rf-exercises-restoring]"), "заглушки нет — видна пустая форма").not.toBeNull();
    expect(container.textContent).not.toMatch(/0\s*\/\s*1/);
    release({ score: 0, passed: false, answers: { e1: 1 } });
    expect(await screen.findByText(/Este es tu intento anterior/)).toBeTruthy();
    expect(container.querySelector("[data-rf-exercises-restoring]")).toBeNull();
  });

  it("позитивный контроль: прошлой попытки нет — после ответа обычная пустая форма", async () => {
    const release = heldServer();
    const container = renderTab();
    release(null);
    expect(await screen.findByText("¿Cómo se dice «hola» en ruso?")).toBeTruthy();
    expect(container.textContent).toMatch(/0\s*\/\s*1/);
  });
});
