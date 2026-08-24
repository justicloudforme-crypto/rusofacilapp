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
    { href: `/${lang}/word-games`, label: dict.nav.wordGames },
    ...(user ? [{ href: `/${lang}/groups`, label: dict.nav.groups }] : []),
    ...(staff ? [{ href: `/${lang}/admin`, label: dict.admin.title }] : []),
  ];
  const ctaHref = user ? `/${lang}/profile` : `/${lang}/login`;
  const ctaLabel = user ? dict.nav.profile : dict.nav.cta;
  // Mobile bottom sheet groups the same destinations by intent instead of
  // the flat list the desktop bar shows — one glance tells you whether
  // you're going to learn, play, or find people, rather than scanning six
  // undifferentiated rows.
  const mobileGroups = [
    {
      label: dict.nav.groupLearn,
      links: [
        { href: `/${lang}`, label: dict.nav.home },
        { href: `/${lang}/courses`, label: dict.nav.courses },
        { href: `/${lang}/stories`, label: dict.nav.stories },
        { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary },
      ],
    },
    {
      label: dict.nav.groupPlay,
      links: [
        { href: `/${lang}/word-games`, label: dict.nav.wordGames },
        { href: `/${lang}/media`, label: dict.nav.media },
      ],
    },
    ...(user
      ? [{ label: dict.nav.groupCommunity, links: [{ href: `/${lang}/groups`, label: dict.nav.groups }] }]
      : []),
    ...(staff
      ? [{ label: dict.admin.title, links: [{ href: `/${lang}/admin`, label: dict.admin.title }] }]
      : []),
  ];
  const profileTabs = [
    { id: "personal", label: dict.profile.tabPersonal },
    { id: "progress", label: dict.profile.tabProgress },
    { id: "subscription", label: dict.profile.tabSubscription },
    { id: "language", label: dict.profile.tabLanguage },
  ];

  const avatarId = user && isAvatarId(user.avatarId) ? user.avatarId : DEFAULT_AVATAR_ID;

  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-background/80 pt-safe backdrop-blur dark:border-white/10">
      <div className="relative mx-auto flex max-w-5xl items-center px-6 py-4">
        <Link
          href={`/${lang}`}
          className="mr-6 flex flex-shrink-0 items-center gap-2 font-serif text-lg font-bold tracking-tight sm:mr-8"
        >
          <MatryoshkaMark size={26} />
          RusoFácilapp
        </Link>
        {/* min-w-0 lets this shrink below its content's natural width
            instead of forcing the header row wider than the viewport —
            the flex-1 default (min-width: auto) doesn't allow that on its
            own. gap tightens through the tablet-landscape range (~1024px)
            where the full link set plus the logged-in right-side cluster
            (sound/language/profile) doesn't fit at gap-8; found via a
            real Playwright overflow check that only logged-in users hit,
            since the right cluster is much narrower logged out. */}
        <nav className="hidden min-w-0 flex-1 items-center gap-4 text-sm font-medium sm:flex lg:gap-6 xl:gap-8">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-brand">
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
              avatarId={avatarId}
              label={dict.nav.profile}
              tabs={profileTabs}
              logoutLabel={dict.auth.logout}
            />
          ) : (
            <Link
              href={ctaHref}
              className="hidden rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-light sm:inline-block"
            >
              {ctaLabel}
            </Link>
          )}
          <MobileMenu
            lang={lang}
            user={user ? { name: user.name, email: user.email, avatarId } : null}
            groups={mobileGroups}
            loggedOutHref={ctaHref}
            loggedOutLabel={ctaLabel}
            profileLabel={dict.nav.profile}
            profileTabs={profileTabs}
            logoutLabel={dict.auth.logout}
            openLabel={dict.nav.openMenu}
            closeLabel={dict.nav.closeMenu}
          />
        </div>
      </div>
    </header>
  );
}
