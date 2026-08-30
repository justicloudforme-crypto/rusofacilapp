import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Opens whichever logout control the current viewport actually offers, and
 * returns it without clicking.
 *
 * There are two, and they are not the same element. Above Tailwind's `sm`
 * breakpoint the header shows ProfileMenu — a "Mi perfil" button opening a
 * `role="menu"` whose logout is a `role="menuitem"`. Below it that whole
 * nav is `hidden`, and logout lives inside MobileMenu's hamburger sheet as
 * a plain submit `<button>` in a `<form action="/api/auth/logout">`.
 *
 * This existed as a hardcoded "Mi perfil" click in two specs, which was
 * correct for as long as those specs only ever ran on Desktop Chrome. The
 * moment they stopped skipping WebKit they started running at an iPhone
 * 13's 390px, where "Mi perfil" is not rendered at all — a timeout that
 * looks exactly like a broken session but is a viewport difference. Ask the
 * page which control it has rather than assuming.
 */
export async function openLogoutControl(page: Page): Promise<Locator> {
  const profileButton = page.getByRole("button", { name: "Mi perfil" });
  if (await profileButton.isVisible()) {
    await profileButton.click();
    return page.getByRole("menuitem", { name: "Cerrar sesión" });
  }

  const hamburger = page.getByRole("button", { name: /abrir menú|open menu/i });
  await expect(hamburger, "neither the desktop profile menu nor the hamburger is on screen").toBeVisible();
  await hamburger.click();
  return page.locator("nav.sheet-slide-up").getByRole("button", { name: "Cerrar sesión" });
}
