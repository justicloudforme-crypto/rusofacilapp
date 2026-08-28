import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import SoundToggle from "./SoundToggle";
import MobileMenu from "./MobileMenu";
import MatryoshkaMark from "./MatryoshkaMark";
import ProfileMenu from "./ProfileMenu";
import PracticeMenu from "./PracticeMenu";
import GlobalSearch from "./GlobalSearch";
import Button from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { StreakStats } from "@/lib/streaks";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { isAvatarId, DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { getEntitlementTier, isPremiumTier } from "@/lib/entitlement";
import { getProfileTabs } from "@/lib/profile-tabs";
import {
  HomeIcon,
  GraduationCapIcon,
  BookIcon,
  DictionaryIcon,
  ChecklistIcon,
  PuzzleIcon,
  HeadphonesIcon,
  UsersIcon,
} from "@/components/profile/ProfileIcons";

export default async function Navbar({
  lang,
  dict,
  streak,
}: {
  lang: Locale;
  dict: Dictionary;
  /** Fetched once in layout.tsx (getUserStreakStats is TTL-cached, so this
   * doesn't add a real per-request cost) — null when logged out. */
  streak: StreakStats | null;
}) {
  const user = await getCurrentUser();
  const staff = Boolean(user && isStaff(user.role));
  // Drives the gold ring/crown on the header avatar — see
  // MatryoshkaAvatar.tsx's `premium` prop.
  const isPremiumUser = user ? isPremiumTier(await getEntitlementTier()) : false;

  const iconClass = "h-4 w-4";
  // Single source for the 4 "Практика" destinations — desktop's dropdown
  // and the mobile drawer's grouping both read from this instead of each
  // hand-building their own copy (that duplication is what let "Аудио и
  // видео"/"Игры со словами" and the flat nav row's wrapping bug happen in
  // the first place — see AUDIT.md). Группы is a way to practice with
  // other people, not an account setting, so it lives here too rather than
  // in the profile dropdown, only for a logged-in user.
  const practiceLinks = [
    { href: `/${lang}/stories`, label: dict.nav.stories, icon: <BookIcon className={iconClass} /> },
    { href: `/${lang}/media`, label: dict.nav.media, icon: <HeadphonesIcon className={iconClass} /> },
    { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary, icon: <DictionaryIcon className={iconClass} /> },
    // The glossary had no entry point in the navigation at all until now —
    // reachable only through Cmd+K search and the game landing pages'
    // footer, which measured as 0 crawlable inbound links from the
    // homepage, the course catalog, every level page and all 240 lesson
    // pages (whole-sitemap crawl, 2026-08-28). 182 URLs sat as an island.
    { href: `/${lang}/glossary`, label: dict.nav.glossary, icon: <ChecklistIcon className={iconClass} /> },
    { href: `/${lang}/word-games`, label: dict.nav.wordGames, icon: <PuzzleIcon className={iconClass} /> },
    ...(user ? [{ href: `/${lang}/groups`, label: dict.nav.groups, icon: <UsersIcon className={iconClass} /> }] : []),
  ];

  const ctaHref = user ? `/${lang}/profile` : `/${lang}/login`;
  const ctaLabel = user ? dict.nav.profile : dict.nav.cta;

  // Mobile drawer groups: BottomNav.tsx already covers Рассказы/Курсы/
  // Слова/Игры/Профиль for a logged-in user, so the drawer only needs to
  // carry what's left (Аудио и видео, Группы, Цены) plus the full profile-
  // tab list. Logged out, there's no bottom bar at all — the drawer is the
  // only way to browse, so it carries everything.
  const mobileGroups = user
    ? [
        {
          label: dict.nav.groupPlay,
          links: [
            { href: `/${lang}/media`, label: dict.nav.media, icon: <HeadphonesIcon className={iconClass} /> },
            // Not covered by BottomNav either (it carries Cuentos/Cursos/
            // Vocabulario/Juegos/Perfil), so without this a logged-in
            // visitor on mobile has no path to the glossary at all.
            { href: `/${lang}/glossary`, label: dict.nav.glossary, icon: <ChecklistIcon className={iconClass} /> },
          ],
        },
        {
          label: dict.nav.groupCommunity,
          links: [{ href: `/${lang}/groups`, label: dict.nav.groups, icon: <UsersIcon className={iconClass} /> }],
        },
        { label: dict.nav.pricing, links: [{ href: `/${lang}/pricing`, label: dict.nav.pricing }] },
        ...(staff ? [{ label: dict.admin.title, links: [{ href: `/${lang}/admin`, label: dict.admin.title }] }] : []),
      ]
    : [
        {
          label: dict.nav.groupLearn,
          links: [
            { href: `/${lang}`, label: dict.nav.home, icon: <HomeIcon className={iconClass} /> },
            { href: `/${lang}/courses`, label: dict.nav.courses, icon: <GraduationCapIcon className={iconClass} /> },
            { href: `/${lang}/stories`, label: dict.nav.stories, icon: <BookIcon className={iconClass} /> },
            { href: `/${lang}/vocabulary`, label: dict.nav.vocabulary, icon: <DictionaryIcon className={iconClass} /> },
            { href: `/${lang}/glossary`, label: dict.nav.glossary, icon: <ChecklistIcon className={iconClass} /> },
          ],
        },
        {
          label: dict.nav.groupPlay,
          links: [
            { href: `/${lang}/word-games`, label: dict.nav.wordGames, icon: <PuzzleIcon className={iconClass} /> },
            { href: `/${lang}/media`, label: dict.nav.media, icon: <HeadphonesIcon className={iconClass} /> },
          ],
        },
        { label: dict.nav.pricing, links: [{ href: `/${lang}/pricing`, label: dict.nav.pricing }] },
      ];

  const profileTabs = getProfileTabs(dict);
  const avatarId = user && isAvatarId(user.avatarId) ? user.avatarId : DEFAULT_AVATAR_ID;

  return (
    <header
      // No backdrop-blur — same Android WebView repaint cost as BottomNav
      // (see that file's comment) — and bg-background at near-full opacity
      // doesn't need the blur to look solid. Constant single-row height
      // now (3 top-level items + a dropdown instead of 6 flat links) — no
      // more tablet-width wrap, so nothing downstream needs to guess at a
      // variable header height.
      className="sticky top-0 z-50 border-b border-black/10 bg-background/95 pt-safe dark:border-white/30"
    >
      <div className="relative mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link href={`/${lang}`} className="flex flex-shrink-0 items-center gap-2 font-serif text-base font-bold tracking-tight sm:text-lg">
          <MatryoshkaMark size={26} />
          <span>RusoFácilapp</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link href={`/${lang}/courses`} className="tap hover:text-primary-text active:text-primary-text">
            {dict.nav.courses}
          </Link>
          <PracticeMenu label={dict.nav.practice} links={practiceLinks} />
          <Link href={`/${lang}/pricing`} className="tap hover:text-primary-text active:text-primary-text">
            {dict.nav.pricing}
          </Link>
          {staff && (
            <Link href={`/${lang}/admin`} className="tap hover:text-primary-text active:text-primary-text">
              {dict.admin.title}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <GlobalSearch lang={lang} dict={dict} isLoggedIn={Boolean(user)} />

          <div className="hidden sm:flex">
            <SoundToggle onLabel={dict.nav.soundOnLabel} offLabel={dict.nav.soundOffLabel} />
          </div>

          {user && streak && streak.currentStreak > 0 && (
            <span
              className="hidden items-center gap-1 rounded-full px-2 text-sm font-semibold text-folk-red sm:flex"
              role="img"
              aria-label={dict.nav.streakLabel.replace("{days}", String(streak.currentStreak))}
            >
              <span aria-hidden>🔥</span>
              {streak.currentStreak}
            </span>
          )}

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
            <span className="hidden sm:inline-block">
              <Button href={ctaHref} variant="primary" size="sm">
                {ctaLabel}
              </Button>
            </span>
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
            languageSwitcher={<LanguageSwitcher current={lang} />}
          />
        </div>
      </div>
    </header>
  );
}
