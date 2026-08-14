import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MobileMenu from "./MobileMenu";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/es") }));
vi.mock("next/navigation", () => ({ usePathname }));

const links = [
  { href: "/es", label: "Inicio" },
  { href: "/es/courses", label: "Cursos" },
];

function renderMenu() {
  return render(
    <MobileMenu
      links={links}
      ctaHref="/es/register"
      ctaLabel="Empezar"
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

  it("opens the dropdown panel on toggle click, showing all links and the CTA", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inicio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cursos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Empezar" })).toBeInTheDocument();
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
        links={links}
        ctaHref="/es/register"
        ctaLabel="Empezar"
        openLabel="Abrir menú"
        closeLabel="Cerrar menú"
      />,
    );

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
