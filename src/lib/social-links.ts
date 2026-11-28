import type { Locale } from "@/i18n/config";

/**
 * Профили бренда в соцсетях — одно объявление на подвал и на `sameAs`
 * разметки организации (заход 7.320, адреса — от владельца 27.11.2026).
 *
 * TikTok и YouTube НЕ добавлены намеренно: TikTok сменит ник после 10.12,
 * адрес YouTube владелец даст позже (PROGRESS.md, раздел 7).
 *
 * В приложении подвала нет вовсе (7.243), поэтому значков там нет; а если
 * такой адрес всё же откроется внутри оболочки, Capacitor отдаст его
 * внешнему браузеру или приложению соцсети: в `allowNavigation` только
 * rusofacilapp.com (`capacitor.config.ts`).
 */
export type SocialNetwork = "instagram" | "facebook";

export const SOCIAL_LINKS: ReadonlyArray<{ network: SocialNetwork; name: string; url: string }> = [
  { network: "instagram", name: "Instagram", url: "https://www.instagram.com/rusofacilapp/" },
  { network: "facebook", name: "Facebook", url: "https://www.facebook.com/share/1BMZLxUe62/" },
];

/** Для `sameAs` организации. */
export const SOCIAL_PROFILE_URLS: readonly string[] = SOCIAL_LINKS.map((link) => link.url);

/** Подпись для экранных чтецов: куда ведёт и что откроется новая вкладка. */
export function socialLinkLabel(lang: Locale, name: string): string {
  return lang === "ru"
    ? `RusoFácilapp в ${name} (откроется в новой вкладке)`
    : `RusoFácilapp en ${name} (se abre en una pestaña nueva)`;
}
