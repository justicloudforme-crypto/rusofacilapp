import type { Locale } from "@/i18n/config";
import { SOCIAL_LINKS, socialLinkLabel, type SocialNetwork } from "@/lib/social-links";

/** Однотонные значки (цвет — от текста подвала, без новых цветов). */
function SocialIcon({ network }: { network: SocialNetwork }) {
  if (network === "instagram") {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.25-1.46 1.5-1.46h1.6V4.46A21 21 0 0 0 14.27 4.3c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.8v3h2.6V21h3.1Z" />
    </svg>
  );
}

/**
 * Значки соцсетей в подвале (заход 7.320). Каждая ссылка — 44×44 (правило
 * касания), открывается в новой вкладке, подпись — для экранных чтецов.
 */
export default function SocialLinks({ lang }: { lang: Locale }) {
  return (
    <ul className="flex items-center justify-center gap-1" data-rf-social-links>
      {SOCIAL_LINKS.map((link) => {
        const label = socialLinkLabel(lang, link.name);
        return (
          <li key={link.network}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              data-rf-social={link.network}
              className="tap inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:text-foreground/80 active:text-foreground/80"
            >
              <SocialIcon network={link.network} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
