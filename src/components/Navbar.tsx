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
import { getEntitlementTier, isPremiumTier } from "@/lib/entitlement";
import {
  HomeIcon,
  GraduationCapIcon,
  BookIcon,
  DictionaryIcon,
  PuzzleIcon,
  HeadphonesIcon,
  UsersIcon,
  PersonalIcon,
  ChartIcon,
  CrownIcon,
  GlobeIcon,
} from "@/components/profile/ProfileIcons";

export default async function Navbar({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const user = await getCurrentUser();
  const staff = Boolean(user && isStaff(user.role));
  // Drives the gold ring/crown on the header avatar — see
  // MatryoshkaAvatar.tsx's `premium` prop.
  const isPremiumUser = user ? isPremiumTier(await getEntitlementTier()) : false;

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
  const iconClass = "h-5 w-5";
  const mobileGroups = [
    {
      label: dict.nav.groupLearn,
      links: [
        { href: `/${lang}`, label: dict.nav.home, icon: <HomeIcon className={iconClass} /> },
        { href: `/${lang}/courses`, label: dict.nav.courses, icon: <GraduationCapIcon className={iconClass} /> },
        { href: `/${lang}/stories`, label: dict.nav.stories, icon: <BookIcon className={iconClass} /> },
        { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary, icon: <DictionaryIcon className={iconClass} /> },
      ],
    },
    {
      label: dict.nav.groupPlay,
      links: [
        { href: `/${lang}/word-games`, label: dict.nav.wordGames, icon: <PuzzleIcon className={iconClass} /> },
        { href: `/${lang}/media`, label: dict.nav.media, icon: <HeadphonesIcon className={iconClass} /> },
      ],
    },
    ...(user
      ? [
          {
            label: dict.nav.groupCommunity,
            links: [{ href: `/${lang}/groups`, label: dict.nav.groups, icon: <UsersIcon className={iconClass} /> }],
          },
        ]
      : []),
    ...(staff
      ? [{ label: dict.admin.title, links: [{ href: `/${lang}/admin`, label: dict.admin.title }] }]
      : []),
  ];
  const profileTabs = [
    { id: "personal", label: dict.profile.tabPersonal, icon: <PersonalIcon className={iconClass} /> },
    { id: "progress", label: dict.profile.tabProgress, icon: <ChartIcon className={iconClass} /> },
    { id: "subscription", label: dict.profile.tabSubscription, icon: <CrownIcon className={iconClass} /> },
    { id: "language", label: dict.profile.tabLanguage, icon: <GlobeIcon className={iconClass} /> },
  ];

  const avatarId = user && isAvatarId(user.avatarId) ? user.avatarId : DEFAULT_AVATAR_ID;

  return (
    <header
      // No backdrop-blur here either — same Android WebView repaint cost as
      // BottomNav below, and bg-background at near-full opacity doesn't
      // actually need the blur to look solid.
      className="sticky top-0 z-50 border-b border-black/10 bg-background/95 pt-safe dark:border-white/10"
    >
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
            <Link key={link.href} href={link.href} className="tap hover:text-brand active:text-brand">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 sm:ml-0">
          {/* Both hidden below sm: a real device report found they crowded
              the mobile header (every other header element already
              collapses below this breakpoint — these two didn't). Both
              stay reachable on mobile some other way: sound in the profile
              settings is the next step if the user wants it back there,
              language switching already lives in the personal-cabinet tab. */}
          <div className="hidden sm:flex">
            <SoundToggle onLabel={dict.nav.soundOnLabel} offLabel={dict.nav.soundOffLabel} />
          </div>
          <div className="hidden sm:flex">
            <LanguageSwitcher current={lang} />
          </div>
          {user ? (
            <ProfileMenu
              lang={lang}
              name={user.name}
              email={user.email}
              avatarId={avatarId}
              isPremium={isPremiumUser}
              label={dict.nav.profile}
              tabs={profileTabs}
              logoutLabel={dict.auth.logout}
            />
          ) : (
            <Link
              href={ctaHref}
              className="tap hidden rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-light active:bg-brand-light sm:inline-block"
            >
              {ctaLabel}
            </Link>
          )}
          <MobileMenu
            lang={lang}
            user={user ? { name: user.name, email: user.email, avatarId, isPremium: isPremiumUser } : null}
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
