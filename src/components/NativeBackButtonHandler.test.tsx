import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import NativeBackButtonHandler from "./NativeBackButtonHandler";
import MobileMenu from "./MobileMenu";
import Modal from "./ui/Modal";

/**
 * «НАЗАД» ANDROID — заход 7.242, долг 347 (аудит 7.241, Р6). Замер 7.241:
 * меню «≡» на первой странице + «Назад» → приложение закрылось; лист замка
 * + «Назад» → ушли на прошлую страницу, лист остался. Здесь — настоящие
 * меню и настоящий общий `Modal` (им рисуется лист замка), настоящий
 * обработчик; подменён только мост Capacitor.
 */
const { listeners, exitApp } = vi.hoisted(() => ({
  listeners: {} as Record<string, (e: { canGoBack: boolean }) => void>,
  exitApp: vi.fn(() => Promise.resolve()),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/app", () => ({
  App: {
    addListener: (event: string, cb: (e: { canGoBack: boolean }) => void) => {
      listeners[event] = cb;
      return Promise.resolve({ remove: () => {} });
    },
    exitApp,
  },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/es" }));

function press(canGoBack: boolean) {
  act(() => listeners.backButton({ canGoBack }));
}

function Menu() {
  return (
    <MobileMenu
      lang="es"
      user={null}
      groups={[{ label: "Aprender", links: [{ href: "/es", label: "Inicio" }] }]}
      loggedOutHref="/es/register"
      loggedOutLabel="Empezar"
      profileLabel="Mi perfil"
      profileTabs={[]}
      logoutLabel="Cerrar sesión"
      openLabel="Abrir menú"
      closeLabel="Cerrar menú"
      languageSwitcher={null}
    />
  );
}

function Sheet() {
  const [open, setOpen] = useState(true);
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Este material está cerrado" closeLabel="Cerrar">
      <p>hoja</p>
    </Modal>
  );
}

describe("кнопка «Назад» Android", () => {
  let back: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    exitApp.mockClear();
  });
  afterEach(() => back.mockRestore());

  it("меню «≡» на первой странице: «Назад» закрывает меню, а не приложение", async () => {
    render(
      <>
        <NativeBackButtonHandler />
        <Menu />
      </>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.getByRole("navigation")).toBeInTheDocument();

    press(false);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(exitApp).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();

    // Меню закрыто — следующее «Назад» на первой странице закрывает приложение.
    press(false);
    expect(exitApp).toHaveBeenCalledTimes(1);
  });

  it("лист замка: «Назад» закрывает лист и НЕ уходит на прошлую страницу", () => {
    render(
      <>
        <NativeBackButtonHandler />
        <Sheet />
      </>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    press(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(back).not.toHaveBeenCalled();

    press(true);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("два слоя: закрывается верхний, потом нижний, потом история", async () => {
    render(
      <>
        <NativeBackButtonHandler />
        <Menu />
      </>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Abrir menú" }));
    const { unmount } = render(<Sheet />);
    press(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    press(true);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(back).not.toHaveBeenCalled();
    press(true);
    expect(back).toHaveBeenCalledTimes(1);
    unmount();
  });
});
