import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import SoundToggle from "./SoundToggle";
import MobileMenu from "./MobileMenu";
import MatryoshkaMark from "./MatryoshkaMark";
import ProfileMenu from "./ProfileMenu";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { isAvatarId, DEFAULT_AVATAR_ID } from "@/lib/avatars";

export default async function Navbar({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const user = await getCurrentUser();
  const staff = Boolean(user && isStaff(user.role));

  const navLinks = [
    { href: `/${lang}`, label: dict.nav.home },
    { href: `/${lang}/courses`, label: dict.nav.courses },
    { href: `/${lang}/stories`, label: dict.nav.stories },
    { href: `/${lang}/media`, label: dict.nav.media },
    { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary },
    ...(user ? [{ href: `/${lang}/groups`, label: dict.nav.groups }] : []),
    ...(staff ? [{ href: `/${lang}/admin`, label: dict.admin.title }] : []),
  ];
  const ctaHref = user ? `/${lang}/profile` : `/${lang}/login`;
  // The desktop header shows a proper profile dropdown (ProfileMenu) instead
  // of this label when logged in — ctaLabel/ctaHref here now only feed the
  // mobile menu's CTA link, which stays a plain link (no dropdown at that
  // width).
  const ctaLabel = user ? dict.nav.profile : dict.nav.cta;
  const profileTabs = [
    { id: "personal", label: dict.profile.tabPersonal },
    { id: "progress", label: dict.profile.tabProgress },
    { id: "subscription", label: dict.profile.tabSubscription },
    { id: "language", label: dict.profile.tabLanguage },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-background/80 pt-safe backdrop-blur dark:border-white/10">
      <div className="relative mx-auto flex max-w-5xl items-center px-6 py-4">
        <Link
          href={`/${lang}`}
          className="mr-8 flex flex-shrink-0 items-center gap-2 font-serif text-lg font-bold tracking-tight sm:mr-12"
        >
          <MatryoshkaMark size={26} />
          RusoFácilapp
        </Link>
        <nav className="hidden flex-1 items-center gap-8 text-sm font-medium sm:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground/70">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 sm:ml-0">
          <SoundToggle onLabel={dict.nav.soundOnLabel} offLabel={dict.nav.soundOffLabel} />
          <LanguageSwitcher current={lang} />
          {user ? (
            <ProfileMenu
              lang={lang}
              name={user.name}
              email={user.email}
              avatarId={isAvatarId(user.avatarId) ? user.avatarId : DEFAULT_AVATAR_ID}
              label={dict.nav.profile}
              tabs={profileTabs}
              logoutLabel={dict.auth.logout}
            />
          ) : (
            <Link
              href={ctaHref}
              className="hidden rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 sm:inline-block"
            >
              {ctaLabel}
            </Link>
          )}
          <MobileMenu
            links={navLinks}
            ctaHref={ctaHref}
            ctaLabel={ctaLabel}
            openLabel={dict.nav.openMenu}
            closeLabel={dict.nav.closeMenu}
          />
        </div>
      </div>
    </header>
  );
}
