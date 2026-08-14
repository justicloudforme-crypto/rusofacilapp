export const locales = ["es", "ru"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

export const localeNames: Record<Locale, string> = {
  es: "Español",
  ru: "Русский",
};

export const localeFlags: Record<Locale, string> = {
  es: "🇲🇽",
  ru: "🇷🇺",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
