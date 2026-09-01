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
import { plural } from "@/lib/plural";

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
      // (see that file's comment). The background is therefore FULLY
      // opaque, not bg-background/95: every other pinned bar in this app
      // (StoryAudioPlayer, the four flashcard mode bars, ExamView,
      // ExercisesTab, StoriesCatalog, MediaCatalog) pairs that 95% with a
      // backdrop-blur, and the blur is what made the remaining 5% read as
      // "solid". Without it, 5% of a large bold section heading scrolling
      // underneath is plainly legible through the bar — measured on a
      // 610px-wide Android viewport, reported from production: the words
      // "¿Por qué estudiar con nosotros?" sat readable right under the
      // logo. An opaque bar is the fix; padding was never the problem.
      // Enforced by scripts/check-layout-geometry.mjs.
      // Constant single-row height now (3 top-level items + a dropdown
      // instead of 6 flat links) — no more tablet-width wrap, so nothing
      // downstream needs to guess at a variable header height.
      className="sticky top-0 z-50 border-b border-black/10 bg-background pt-safe dark:border-white/30"
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
          {/* Hidden below md since 31.08.2026 (7.71). This fourth link is
              what pushed a staff account's /es/profile 86px past a 640px
              viewport and /ru/profile 115px. Like the streak badge above, it
              renders only inside a `staff` branch, so no other account's
              frame moves a pixel.

              The reason it could not simply be hidden before is that doing
              so left 640–767 with no route to /admin at all: MobileMenu,
              which carries the admin group, is `sm:hidden`. That gap is now
              covered by ProfileMenu's own admin entry (`adminLink` below),
              which is `hidden sm:block` — so the path exists at every width,
              through the mobile menu under 640 and through the profile
              dropdown from 640 up. */}
          {staff && (
            <Link href={`/${lang}/admin`} className="tap hidden md:inline hover:text-primary-text active:text-primary-text">
              {dict.admin.title}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <GlobalSearch lang={lang} dict={dict} isLoggedIn={Boolean(user)} />

          <div className="hidden sm:flex">
            <SoundToggle onLabel={dict.nav.soundOnLabel} offLabel={dict.nav.soundOffLabel} />
          </div>

          {/* Debt 37, fixed 31.08.2026. `sm:flex` put the streak badge on
              screen at 640px, where the row already held the logo, three
              nav links, search, the sound toggle, the language switcher and
              the profile menu — and /es/profile came out 27px wider than
              the viewport, /ru/profile 45px. Measured, not guessed: the
              badge is ~60px with its gap, which covers both.

              `md:flex` is the narrowest possible fix, and narrow is the
              point. This branch renders ONLY for a signed-in learner with a
              live streak, so no anonymous page and no signed-out visitor
              can see a pixel of difference — the frame of every other page
              is untouched, which is the condition this repair was allowed
              under. Nothing is lost: the number is on /profile, and the
              mobile menu carries it below md.

              check:layout still cannot see this: it browses anonymously and
              has no way to log in. The measurement lives in
              e2e/page-width.spec.ts instead, which can. */}
          {user && streak && streak.currentStreak > 0 && (
            <span
              className="hidden items-center gap-1 rounded-full px-2 text-sm font-semibold text-folk-red md:flex"
              role="img"
              aria-label={plural(lang, streak.currentStreak, dict.nav.streakLabel, {
                days: streak.currentStreak,
              })}
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
              adminLink={staff ? { href: `/${lang}/admin`, label: dict.admin.title } : null}
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
