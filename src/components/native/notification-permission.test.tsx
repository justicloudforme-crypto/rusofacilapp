import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NativeNotifications from "@/components/NativeNotifications";
import ReminderSetting from "./ReminderSetting";
import { nativeAccessCopy } from "@/lib/native-access-copy";
import { REMINDER_CHOICE_KEY } from "@/lib/notifications";

// Заход 7.243 (аудит 7.241, Р11): системный вопрос об уведомлениях — только
// когда человек сам включает напоминание; при запуске (первом, втором, после
// отказа) — ни разу.
const box = vi.hoisted(() => ({ permission: "prompt" as "prompt" | "granted" | "denied", answerOnPrompt: "granted" as "granted" | "denied" }));
const plugin = vi.hoisted(() => ({
  requestPermissions: vi.fn(async () => {
    box.permission = box.answerOnPrompt;
    return { display: box.permission };
  }),
  checkPermissions: vi.fn(async () => ({ display: box.permission })),
  schedule: vi.fn(async () => ({})),
  cancel: vi.fn(async () => {}),
  removeAllDeliveredNotifications: vi.fn(async () => {}),
}));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: plugin }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" } }));
vi.mock("@capacitor/app", () => ({ App: { addListener: async () => ({ remove: () => {} }) } }));

const copy = nativeAccessCopy("es").reminder;
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  box.permission = "prompt";
  box.answerOnPrompt = "granted";
  localStorage.clear();
  for (const fn of Object.values(plugin)) fn.mockClear();
});
afterEach(() => cleanup());

describe("уведомления: вопрос не при запуске", () => {
  it("два запуска подряд — системного вопроса 0, расписания 0", async () => {
    render(<NativeNotifications lang="es" userId="u1" />);
    await flush();
    cleanup();
    render(<NativeNotifications lang="es" userId="u1" />);
    await flush();
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(0);
    expect(plugin.checkPermissions).toHaveBeenCalled();
    expect(plugin.schedule).toHaveBeenCalledTimes(0);
  });

  it("разрешение дано раньше — напоминание переставляется при запуске без вопроса", async () => {
    box.permission = "granted";
    render(<NativeNotifications lang="es" userId="u1" />);
    await flush();
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(0);
    expect(plugin.schedule).toHaveBeenCalledTimes(1);
  });

  it("включение напоминания — ровно один системный вопрос и расписание (позитивный контроль)", async () => {
    render(<ReminderSetting lang="es" userId="u1" copy={copy} />);
    await flush();
    expect(screen.getByText(copy.body)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    await flush();
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(1);
    expect(plugin.schedule).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REMINDER_CHOICE_KEY)).toBe("on");
  });

  it("отказ — подсказка, выбор «off», следующий запуск вопроса не задаёт", async () => {
    box.answerOnPrompt = "denied";
    render(<ReminderSetting lang="es" userId="u1" copy={copy} />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox"));
    });
    await flush();
    expect(screen.getByText(copy.denied)).toBeTruthy();
    expect(localStorage.getItem(REMINDER_CHOICE_KEY)).toBe("off");
    cleanup();
    render(<NativeNotifications lang="es" userId="u1" />);
    await flush();
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(1);
  });
});
