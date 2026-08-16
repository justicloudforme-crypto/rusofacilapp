import "server-only";
import { cookies } from "next/headers";

// Site-wide display mode, chosen from the profile page's "Личные данные" tab
// — a cookie (not a DB field) so it applies before any auth check, needs no
// migration, and is read server-side on every request so the very first
// paint already has the right theme (no client-side flash/hydration swap).
export const THEME_VALUES = ["light", "dark", "reading"] as const;
export type ThemePreference = (typeof THEME_VALUES)[number];
export const THEME_COOKIE = "rusofacil-theme";

export function isThemePreference(value: string): value is ThemePreference {
  return (THEME_VALUES as readonly string[]).includes(value);
}

export async function getThemePreference(): Promise<ThemePreference> {
  const store = await cookies();
  const raw = store.get(THEME_COOKIE)?.value ?? "";
  return isThemePreference(raw) ? raw : "light";
}
