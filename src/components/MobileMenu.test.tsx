import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MobileMenu from "./MobileMenu";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/es") }));
vi.mock("next/navigation", () => ({ usePathname }));

const groups = [
  { label: "Aprender", links: [{ href: "/es", label: "Inicio" }, { href: "/es/courses", label: "Cursos" }] },
];

function renderMenu(user: { name: string | null; email: string; avatarId: "matryoshka_calm" } | null = null) {
  return render(
    <MobileMenu
      lang="es"
      user={user}
      groups={groups}
      loggedOutHref="/es/register"
      loggedOutLabel="Empezar"
      profileLabel="Mi perfil"
      profileTabs={[{ id: "personal", label: "Datos personales" }]}
      logoutLabel="Cerrar sesión"
      openLabel="Abrir menú"
      closeLabel="Cerrar menú"
    />,
  );
}

describe("MobileMenu", () => {
  it("starts closed, with only the toggle button visible", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("opens the sheet on toggle click, showing all links and the logged-out CTA", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cursos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Empezar" })).toBeInTheDocument();
  });

  it("shows the profile row and logout button when logged in", async () => {
    const user = userEvent.setup();
    renderMenu({ name: "Ana", email: "ana@example.com", avatarId: "matryoshka_calm" });

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(screen.getByRole("navigation")).toBeInTheDocument();

    // Once open, both the toggle button (now labeled "Cerrar menú") and the
    // dedicated backdrop button share that label — the backdrop is the
    // second one in document order.
    const closeButtons = screen.getAllByRole("button", { name: "Cerrar menú" });
    await user.click(closeButtons[1]!);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("closes when the pathname changes (navigation)", () => {
    usePathname.mockReturnValue("/es");
    const { rerender } = renderMenu();

    usePathname.mockReturnValue("/es/courses");
    rerender(
      <MobileMenu
        lang="es"
        user={null}
        groups={groups}
        loggedOutHref="/es/register"
        loggedOutLabel="Empezar"
        profileLabel="Mi perfil"
        profileTabs={[{ id: "personal", label: "Datos personales" }]}
        logoutLabel="Cerrar sesión"
        openLabel="Abrir menú"
        closeLabel="Cerrar menú"
      />,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
