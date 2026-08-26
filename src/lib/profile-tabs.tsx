import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import {
  PersonalIcon,
  ChartIcon,
  TrophyIcon,
  GiftIcon,
  CrownIcon,
  LockIcon,
  GlobeIcon,
} from "@/components/profile/ProfileIcons";

/**
 * Single source of truth for the 7 profile tabs — previously duplicated
 * three ways (profile/page.tsx's own PROFILE_TABS/TAB_ICONS, and a
 * separately hand-built 4-item `profileTabs` in Navbar.tsx feeding both
 * ProfileMenu's dropdown and MobileMenu's mini-list), which is exactly how
 * "Значки"/"Пригласить"/"Безопасность" silently became unreachable from
 * the header nav (AUDIT.md §7). Header/mobile-nav and the profile page
 * itself both import from here now — they cannot drift again.
 */
export const PROFILE_TABS = ["personal", "progress", "badges", "referral", "subscription", "security", "language"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

export function isProfileTab(value: string): value is ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(value);
}

export function getProfileTabs(dict: Dictionary): { id: ProfileTab; label: string; icon: ReactNode }[] {
  const iconClass = "h-4 w-4";
  return [
    { id: "personal", label: dict.profile.tabPersonal, icon: <PersonalIcon className={iconClass} /> },
    { id: "progress", label: dict.profile.tabProgress, icon: <ChartIcon className={iconClass} /> },
    { id: "badges", label: dict.profile.tabBadges, icon: <TrophyIcon className={iconClass} /> },
    { id: "referral", label: dict.profile.tabReferral, icon: <GiftIcon className={iconClass} /> },
    { id: "subscription", label: dict.profile.tabSubscription, icon: <CrownIcon className={iconClass} /> },
    { id: "security", label: dict.profile.tabSecurity, icon: <LockIcon className={iconClass} /> },
    { id: "language", label: dict.profile.tabLanguage, icon: <GlobeIcon className={iconClass} /> },
  ];
}
