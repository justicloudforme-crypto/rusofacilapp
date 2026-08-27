import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  HomeIcon,
  ChartIcon,
  TrophyIcon,
  CrownIcon,
  AppearanceIcon,
} from "@/components/profile/ProfileIcons";

/**
 * Single source of truth for the profile tabs — previously duplicated
 * three ways (profile/page.tsx's own PROFILE_TABS/TAB_ICONS, and a
 * separately hand-built 4-item `profileTabs` in Navbar.tsx feeding both
 * ProfileMenu's dropdown and MobileMenu's mini-list), which is exactly how
 * "Значки"/"Пригласить"/"Безопасность" silently became unreachable from
 * the header nav (AUDIT.md §7). Header/mobile-nav and the profile page
 * itself both import from here now — they cannot drift again.
 *
 * Cut from 7 to 5 (2026-08-26 /profile redesign): the old "personal"/
 * "referral"/"security"/"language" tabs collapsed into "overview" (referral
 * card) and "settings" (accordion), since a 7-tab row was clipping on
 * desktop and settings are opened once while progress is checked daily.
 */
export const PROFILE_TABS = ["overview", "progress", "badges", "subscription", "settings"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export function isProfileTab(value: string): value is ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(value);
}

export function getProfileTabs(dict: Dictionary): { id: ProfileTab; label: string; icon: ReactNode }[] {
  const iconClass = "h-4 w-4";
  return [
    { id: "overview", label: dict.profile.tabOverview, icon: <HomeIcon className={iconClass} /> },
    { id: "progress", label: dict.profile.tabProgress, icon: <ChartIcon className={iconClass} /> },
    { id: "badges", label: dict.profile.tabBadges, icon: <TrophyIcon className={iconClass} /> },
    { id: "subscription", label: dict.profile.tabSubscription, icon: <CrownIcon className={iconClass} /> },
    { id: "settings", label: dict.profile.tabSettings, icon: <AppearanceIcon className={iconClass} /> },
  ];
}
