import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { isLocale, locales, localeNames, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { db } from "@/lib/db";
import {
  getLatestSubscription,
  getSubscriptionHistory,
  getDisplayStatus,
  type DisplayStatus,
} from "@/lib/subscription";
import { getLevelProgress, getLessonProgressDetails } from "@/lib/progress";
import { getUserStreakStats } from "@/lib/streaks";
import { getExamAttempts } from "@/lib/exams/progress";
import { getUserBadgesForDisplay } from "@/lib/badges";
import { getWeeklyWeakTopic } from "@/lib/weak-topic";
import { getReferralStats } from "@/lib/referral";
import { getPublicProfileToggleState } from "@/lib/public-profile";
import CopyReferralLink from "@/components/profile/CopyReferralLink";
import PublicProfileToggle from "@/components/profile/PublicProfileToggle";
import { levelSlugs } from "@/lib/courses";
import { getThemePreference, type ThemePreference } from "@/lib/theme";
import { isAvatarId, DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { getAvatarLabels, getCharacterLabels } from "@/lib/avatarLabels";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import ProfileNameForm from "@/components/profile/ProfileNameForm";
import ThemeSwitcher from "@/components/profile/ThemeSwitcher";
import AvatarPicker from "@/components/profile/AvatarPicker";
import WelcomeOverlay from "@/components/profile/WelcomeOverlay";
import ChangePasswordForm from "@/components/profile/ChangePasswordForm";
import DeleteAccountForm from "@/components/profile/DeleteAccountForm";
import NativeSubscriptionPanel from "@/components/subscription/NativeSubscriptionPanel";
import { TELEGRAM_INVITE_URL } from "@/components/TelegramFloatButton";
import {
  PersonalIcon,
  AppearanceIcon,
  GlobeIcon,
  CrownIcon,
  TrophyIcon,
  GiftIcon,
  LockIcon,
  DevicesIcon,
  TrashIcon,
  ChartIcon,
  ChecklistIcon,
  GraduationCapIcon,
  BookIcon,
} from "@/components/profile/ProfileIcons";
import type { ReactNode } from "react";

// Icon-badge + serif heading, used for every card section on this page so
// the dashboard reads as a real interface (icon + hierarchy per row)
// instead of plain-text labels all sitting at body-text weight.
function SectionHeading({
  icon,
  tone = "brand",
  children,
}: {
  icon: ReactNode;
  tone?: "brand" | "danger";
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          tone === "danger"
            ? "bg-red-500/10 text-red-600 dark:text-red-400"
            : "bg-primary/10 text-primary dark:text-primary-400"
        }`}
      >
        {icon}
      </span>
      <h2
        className={`font-serif text-lg font-semibold ${
          tone === "danger" ? "text-red-600 dark:text-red-400" : "text-foreground"
        }`}
      >
        {children}
      </h2>
    </div>
  );
}

const TAB_ICONS: Record<ProfileTab, ReactNode> = {
  personal: <PersonalIcon className="h-4 w-4" />,
  progress: <ChartIcon className="h-4 w-4" />,
  badges: <TrophyIcon className="h-4 w-4" />,
  referral: <GiftIcon className="h-4 w-4" />,
  subscription: <CrownIcon className="h-4 w-4" />,
  security: <LockIcon className="h-4 w-4" />,
  language: <GlobeIcon className="h-4 w-4" />,
};

const PROFILE_TABS = ["personal", "progress", "badges", "referral", "subscription", "security", "language"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];
// Subscription.plan stores the internal identifier ("monthly"/"annual"/
// "lifetime") shared with Stripe/RevenueCat product mapping — display uses
// the already-localized pricing-card names instead so a plan renders as
// "Premium" here (and its own locale) without renaming that identifier.
function planDisplayLabel(plan: string, dict: Dictionary): string {
  if (plan === "monthly") return dict.pricing.monthly.name;
  if (plan === "annual") return dict.pricing.annual.name;
  if (plan === "lifetime") return dict.pricing.lifetime.name;
  return plan;
}

function isProfileTab(value: string): value is ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(value);
}

const STATUS_BADGE_CLASSES: Record<DisplayStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  trialing: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  past_due: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  canceled: "bg-red-500/10 text-red-600 dark:text-red-400",
  expired: "bg-red-500/10 text-red-600 dark:text-red-400",
  none: "bg-foreground/10 text-foreground/60",
};

export default async function ProfilePage({
  params,
  searchParams,
}: PageProps<"/[lang]/profile">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${lang}/login?redirectTo=/${lang}/profile`);
  }

  const dict = await getDictionary(lang);
  const query = await searchParams;
  const checkout = typeof query.checkout === "string" ? query.checkout : null;
  const justCanceled = query.subscription === "canceled";
  const loggedOutEverywhere = query.loggedOutEverywhere === "1";
  const rawTab = typeof query.tab === "string" ? query.tab : "";
  // Checkout/cancel redirects land here without a `tab` param — default to
  // the subscription tab in that case so the notice and the section it's
  // about are visible together, instead of the notice appearing on
  // whatever tab happens to be default.
  const defaultTab: ProfileTab = checkout || justCanceled ? "subscription" : "personal";
  const activeTab: ProfileTab = isProfileTab(rawTab) ? rawTab : defaultTab;

  // Subscription reads are wrapped defensively: a schema-drift error here
  // (e.g. a column pushed to the Prisma schema but not yet to the prod DB,
  // see the 2026-08-23 incident) must not take down the whole profile page
  // — badges/progress/referral etc. are unrelated and should still render.
  // A failure degrades to "no subscription data" rather than a raw 500.
  const [subscription, subscriptionHistory, progress, lessonResults, examAttempts, wordsLearned, streak, theme, badges, weakTopic, referral, publicProfile, requestHeaders] =
    await Promise.all([
      getLatestSubscription(user.id).catch((error) => {
        console.error("profile: getLatestSubscription failed", error);
        return null;
      }),
      getSubscriptionHistory(user.id).catch((error) => {
        console.error("profile: getSubscriptionHistory failed", error);
        return [];
      }),
      getLevelProgress(user.id),
      getLessonProgressDetails(user.id),
      getExamAttempts(user.id),
      db.flashcardProgress.count({ where: { userId: user.id, known: true } }),
      getUserStreakStats(user.id),
      getThemePreference(),
      getUserBadgesForDisplay(user.id),
      getWeeklyWeakTopic(user.id),
      getReferralStats(user.id),
      getPublicProfileToggleState(user.id),
      headers(),
    ]);
  const earnedBadgeCount = badges.filter((b) => b.earnedAt !== null).length;
  const requestHost = requestHeaders.get("host") ?? "rusofacilapp.com";
  const requestProto = requestHeaders.get("x-forwarded-proto") ?? (requestHost.startsWith("localhost") ? "http" : "https");
  const referralLink = referral ? `${requestProto}://${requestHost}/${lang}/register?ref=${referral.code}` : null;

  const displayStatus = getDisplayStatus(subscription);
  const isActive = displayStatus === "active" || displayStatus === "trialing";
  // Staff/owner accounts have full access regardless of whether they've
  // ever had a paid Subscription row — without this, an owner who never
  // went through checkout would see the same "subscribe now" upsells as a
  // regular unsubscribed student on this page (the lesson/story/exam pages
  // already had this bypass; this page didn't).
  const entitled = isStaff(user.role) || isActive;
  // Drives the gold ring/crown on this page's own avatar (below) and the
  // crown next to the plan name in the Subscription tab — see
  // MatryoshkaAvatar.tsx's `premium` prop / entitlement.ts's isPremiumTier.
  const isPremiumUser = isStaff(user.role) || (isActive && subscription?.plan === "lifetime");
  const dateFormatter = new Intl.DateTimeFormat(lang, { dateStyle: "long" });

  const statusLabels: Record<DisplayStatus, string> = {
    active: dict.profile.statusActive,
    trialing: dict.profile.statusTrialing,
    past_due: dict.profile.statusPastDue,
    canceled: dict.profile.statusCanceled,
    expired: dict.profile.statusIncompleteExpired,
    none: dict.profile.statusNoSubscription,
  };

  // Highest level with at least one completed lesson, in level order —
  // a simple, honest "current level" indicator without inventing a
  // separate CEFR-estimate feature.
  const currentLevel = [...levelSlugs].reverse().find((level) => progress[level].completed > 0);

  const currentAvatarId = isAvatarId(user.avatarId) ? user.avatarId : DEFAULT_AVATAR_ID;
  const avatarLabels = getAvatarLabels(dict);
  const characterLabels = getCharacterLabels(dict);

  const themeOptions: { id: ThemePreference; label: string; description: string; swatch: string }[] = [
    { id: "light", label: dict.profile.themeLightLabel, description: dict.profile.themeLightDescription, swatch: "#fff8ec" },
    { id: "dark", label: dict.profile.themeDarkLabel, description: dict.profile.themeDarkDescription, swatch: "#1b140f" },
    { id: "reading", label: dict.profile.themeReadingLabel, description: dict.profile.themeReadingDescription, swatch: "#f6efdc" },
  ];

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "personal", label: dict.profile.tabPersonal },
    { id: "progress", label: dict.profile.tabProgress },
    { id: "badges", label: dict.profile.tabBadges },
    { id: "referral", label: dict.profile.tabReferral },
    { id: "subscription", label: dict.profile.tabSubscription },
    { id: "security", label: dict.profile.tabSecurity },
    { id: "language", label: dict.profile.tabLanguage },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <WelcomeOverlay
        userId={user.id}
        name={user.name}
        currentStreak={streak.currentStreak}
        greeting={dict.profile.welcomeGreeting}
        subtextActive={dict.profile.welcomeSubtextActive}
        subtextNew={dict.profile.welcomeSubtextNew}
        streakDaysUnit={dict.profile.streakDaysUnit}
        continueLabel={dict.profile.welcomeContinue}
      />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {dict.profile.title}
      </h1>
      <p className="mt-1 text-sm text-foreground/70">{dict.profile.subtitle}</p>

      <nav
        role="tablist"
        aria-label={dict.profile.title}
        className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-black/10 bg-white/60 p-1 dark:border-white/15 dark:bg-white/5"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/${lang}/profile?tab=${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tap flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:text-foreground active:text-foreground"
            }`}
          >
            {TAB_ICONS[tab.id]}
            {tab.label}
          </Link>
        ))}
      </nav>

      {checkout === "mock" && (
        <p className="mt-6 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          {dict.account.checkoutMock}
        </p>
      )}
      {checkout === "success" && (
        <p className="mt-6 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {dict.account.checkoutSuccess}
        </p>
      )}
      {checkout === "oxxo_pending" && (
        <p className="mt-6 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          {dict.account.checkoutOxxoPending}
        </p>
      )}
      {justCanceled && (
        <p className="mt-6 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {dict.profile.canceledNotice}
        </p>
      )}

      {/* Personal data */}
      {activeTab === "personal" && (
        <section className="mt-8 flex flex-col gap-6">
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <MatryoshkaAvatar id={currentAvatarId} size={56} label={avatarLabels[currentAvatarId]} premium={isPremiumUser} />
              <div className="min-w-0">
                <p className="truncate font-medium">{user.name?.trim() || dict.profile.nameEmpty}</p>
                <p className="truncate text-sm text-foreground/60">{user.email}</p>
              </div>
            </div>

            <div className="mt-5 border-t border-black/10 pt-5 dark:border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                {dict.profile.nameLabel}
              </span>
              <ProfileNameForm
                initialName={user.name}
                namePlaceholder={dict.profile.namePlaceholder}
                saveLabel={dict.profile.saveButton}
                savedLabel={dict.profile.savedNotice}
              />
            </div>

            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-black/10 pt-5 text-sm dark:border-white/10">
              <dt className="text-foreground/60">{dict.profile.emailLabel}</dt>
              <dd>{user.email}</dd>
              <dt className="text-foreground/60">{dict.profile.memberSinceLabel}</dt>
              <dd>{dateFormatter.format(user.createdAt)}</dd>
            </dl>
          </div>

          <div className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
            <SectionHeading icon={<PersonalIcon className="h-[18px] w-[18px]" />}>
              {dict.profile.avatarHeading}
            </SectionHeading>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.avatarDescription}</p>
            <div className="mt-4">
              <AvatarPicker
                initialAvatarId={currentAvatarId}
                labels={avatarLabels}
                characterLabels={characterLabels}
                modalTitle={dict.profile.avatarModalTitle}
                changeHint={dict.profile.avatarChangeHint}
                closeLabel={dict.profile.avatarCloseLabel}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
            <SectionHeading icon={<AppearanceIcon className="h-[18px] w-[18px]" />}>
              {dict.profile.appearanceHeading}
            </SectionHeading>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.appearanceDescription}</p>
            <div className="mt-4">
              <ThemeSwitcher initialTheme={theme} options={themeOptions} />
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
            <SectionHeading icon={<GlobeIcon className="h-[18px] w-[18px]" />}>
              {dict.profile.publicProfileHeading}
            </SectionHeading>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.publicProfileDescription}</p>
            <div className="mt-4">
              <PublicProfileToggle
                origin={`${requestProto}://${requestHost}`}
                lang={lang}
                initialEnabled={publicProfile.enabled}
                initialHandle={publicProfile.handle}
                toggleLabel={dict.profile.publicProfileToggleLabel}
                copyLabel={dict.profile.referralCopyButton}
                copiedLabel={dict.profile.referralCopiedNotice}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#24A1DE]/25 bg-[#24A1DE]/5 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#24A1DE] text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.287 5.906c-.778.324-2.334.994-4.666 2.01-.378.15-.577.298-.595.442-.03.243.275.339.69.47l1.75.55c.392.123.845.023 1.136-.26l2.132-2.062c.168-.163.342-.056.246.075l-1.74 1.63c-.237.222-.284.542-.107.755l1.642 1.972c.288.347.79.432 1.177.197l2.25-1.383c.485-.298.796-.867.72-1.442-.078-.598-.62-1.127-1.428-1.447l-5.06-2.11z" />
                </svg>
              </span>
              <h2 className="font-serif text-lg font-semibold text-foreground">{dict.profile.telegramHeading}</h2>
            </div>
            <p className="mt-3 text-sm text-foreground/70">{dict.profile.telegramDescription}</p>
            <a
              href={TELEGRAM_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="tap mt-4 inline-block rounded-full bg-[#24A1DE] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2090c7] active:bg-[#2090c7]"
            >
              {dict.profile.telegramCta}
            </a>
          </div>

          <form action="/api/auth/logout" method="POST">
            <input type="hidden" name="lang" value={lang} />
            <button
              type="submit"
              className="tap w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06] sm:w-auto"
            >
              {dict.auth.logout}
            </button>
          </form>
        </section>
      )}

      {/* Subscription status */}
      {activeTab === "subscription" && (
      <>
      {/* Renders only inside the native app shell (no-op on web, see the
          component's own Capacitor.isNativePlatform() guard) — a separate
          section from the Stripe-driven one below rather than merged into
          it, since a RevenueCat purchase's on-device entitlement state
          (this panel) and the DB-backed Subscription row the Stripe
          section reads are two different sources of truth that only
          converge once /api/webhooks/revenuecat has actually synced a
          purchase server-side (not the case yet for a purely local
          StoreKit Testing purchase with no webhook tunnel configured). */}
      <NativeSubscriptionPanel userId={user.id} dict={dict.profile.nativeSubscription} />
      <section className="mt-8 rounded-2xl border border-primary/15 bg-primary/[0.03] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading icon={<CrownIcon className="h-[18px] w-[18px]" />}>
            {dict.profile.subscriptionHeading}
          </SectionHeading>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[displayStatus]}`}
          >
            {statusLabels[displayStatus]}
          </span>
        </div>

        {subscription && (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-foreground/60">{dict.account.plan}</dt>
            <dd className="flex items-center gap-1.5">
              {subscription.plan === "lifetime" && <span aria-hidden>👑</span>}
              {planDisplayLabel(subscription.plan, dict)}
            </dd>
            <dt className="text-foreground/60">
              {isActive ? dict.profile.expiresLabel : dict.profile.expiredLabel}
            </dt>
            <dd>{dateFormatter.format(subscription.currentPeriodEnd)}</dd>
          </dl>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {isActive ? (
            <form action="/api/subscription/cancel" method="POST">
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="tap w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06] sm:w-auto"
              >
                {dict.profile.cancelButton}
              </button>
            </form>
          ) : isStaff(user.role) ? (
            <p className="text-sm text-foreground/60">{dict.profile.staffAccessNotice}</p>
          ) : (
            <Link
              href={`/${lang}/pricing`}
              className="tap w-full rounded-full bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85 sm:w-auto"
            >
              {displayStatus === "none"
                ? dict.profile.subscribeButton
                : dict.profile.renewButton}
            </Link>
          )}
        </div>

        <div className="mt-6 border-t border-black/10 pt-5 dark:border-white/10">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {dict.profile.paymentHistoryHeading}
          </span>
          {subscriptionHistory.length === 0 ? (
            <p className="mt-2 text-sm text-foreground/60">{dict.profile.paymentHistoryEmpty}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {subscriptionHistory.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[.03] px-3 py-2 text-sm dark:bg-white/[.05]"
                >
                  <span>{planDisplayLabel(row.plan, dict)}</span>
                  <span className="text-foreground/60">{dateFormatter.format(row.createdAt)}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_CLASSES[getDisplayStatus(row)]}`}
                  >
                    {statusLabels[getDisplayStatus(row)]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      </>
      )}

      {/* Badges */}
      {activeTab === "badges" && (
        <section className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionHeading icon={<TrophyIcon className="h-[18px] w-[18px]" />}>
              {dict.profile.badgesHeading}
            </SectionHeading>
            <span className="text-sm tabular-nums text-foreground/60">
              {earnedBadgeCount} / {badges.length} {dict.profile.badgesUnlockedUnit}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground/60">{dict.profile.badgesSubtitle}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges.map(({ def, earnedAt }) => {
              const earned = earnedAt !== null;
              return (
                <div
                  key={def.id}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center ${
                    earned
                      ? "border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5"
                      : "border-black/10 opacity-40 grayscale dark:border-white/10"
                  }`}
                >
                  <span aria-hidden="true" className="text-3xl">
                    {def.icon}
                  </span>
                  <span className="text-sm font-medium">{def.title[lang]}</span>
                  <span className="text-xs text-foreground/60">{def.description[lang]}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
                    {earned
                      ? `${dict.profile.badgesEarnedOnLabel} ${dateFormatter.format(earnedAt)}`
                      : dict.profile.badgesLockedLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Referral */}
      {activeTab === "referral" && (
        <section className="mt-8 flex flex-col gap-6">
          <div className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
            <SectionHeading icon={<GiftIcon className="h-[18px] w-[18px]" />}>
              {dict.profile.referralHeading}
            </SectionHeading>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.referralDescription}</p>

            {referralLink ? (
              <CopyReferralLink
                link={referralLink}
                copyLabel={dict.profile.referralCopyButton}
                copiedLabel={dict.profile.referralCopiedNotice}
              />
            ) : (
              <p className="mt-3 text-sm text-foreground/60">{dict.profile.referralUnavailable}</p>
            )}
          </div>

          {referral && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <p className="text-2xl font-semibold tabular-nums">{referral.referredCount}</p>
                <p className="text-sm text-foreground/60">{dict.profile.referralInvitedLabel}</p>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                <p className="text-2xl font-semibold tabular-nums">{referral.rewardsEarnedCount}</p>
                <p className="text-sm text-foreground/60">{dict.profile.referralRewardsLabel}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Security */}
      {activeTab === "security" && (
        <section className="mt-8 flex flex-col gap-6">
          {loggedOutEverywhere && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              {dict.profile.loggedOutEverywhereNotice}
            </p>
          )}

          <div className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
            <SectionHeading icon={<LockIcon className="h-[18px] w-[18px]" />}>
              {dict.profile.changePasswordHeading}
            </SectionHeading>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.changePasswordDescription}</p>
            <ChangePasswordForm
              currentPasswordLabel={dict.profile.currentPasswordLabel}
              newPasswordLabel={dict.profile.newPasswordLabelShort}
              saveLabel={dict.profile.saveButton}
              savedLabel={dict.profile.passwordChangedNotice}
              invalidCurrentPasswordLabel={dict.profile.invalidCurrentPassword}
              weakPasswordLabel={dict.auth.weakPassword}
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>

          <div className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
            <SectionHeading icon={<DevicesIcon className="h-[18px] w-[18px]" />}>
              {dict.profile.sessionsHeading}
            </SectionHeading>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.sessionsDescription}</p>
            <form action="/api/auth/logout-everywhere" method="POST" className="mt-3">
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="tap rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
              >
                {dict.profile.logoutEverywhereButton}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-red-500/20 p-5 sm:p-6">
            <SectionHeading tone="danger" icon={<TrashIcon className="h-[18px] w-[18px]" />}>
              {dict.profile.deleteAccountHeading}
            </SectionHeading>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.deleteAccountDescription}</p>
            <DeleteAccountForm
              lang={lang}
              warningLabel={dict.profile.deleteAccountWarning}
              passwordLabel={dict.profile.currentPasswordLabel}
              submitLabel={dict.profile.deleteAccountButton}
              sentLabel={dict.profile.deleteAccountEmailSent}
              invalidPasswordLabel={dict.profile.invalidCurrentPassword}
            />
          </div>
        </section>
      )}

      {/* Language */}
      {activeTab === "language" && (
        <section className="mt-8 rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
          <SectionHeading icon={<GlobeIcon className="h-[18px] w-[18px]" />}>
            {dict.profile.languageHeading}
          </SectionHeading>
          <p className="mt-1 text-sm text-foreground/60">{dict.profile.languageDescription}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {locales.map((locale: Locale) => (
              <Link
                key={locale}
                href={`/${locale}/profile?tab=language`}
                aria-current={locale === lang}
                className={`tap rounded-full px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                  locale === lang
                    ? "bg-foreground text-background"
                    : "border border-black/10 hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
                }`}
              >
                {localeNames[locale]}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Progress */}
      {activeTab === "progress" && (
      <>
      <section className="mt-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <p className="text-2xl font-semibold tabular-nums">{wordsLearned}</p>
            <p className="text-sm text-foreground/60">{dict.profile.wordsLearnedLabel}</p>
          </div>
          <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <p className="text-2xl font-semibold tabular-nums">
              {levelSlugs.reduce((sum, level) => sum + progress[level].completed, 0)}
            </p>
            <p className="text-sm text-foreground/60">{dict.profile.lessonsCompleted}</p>
          </div>
          <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <p className="text-2xl font-semibold uppercase">
              {currentLevel ? currentLevel : "—"}
            </p>
            <p className="text-sm text-foreground/60">
              {currentLevel ? dict.profile.currentLevelLabel : dict.profile.noLevelStarted}
            </p>
          </div>
          <div className="rounded-2xl border border-folk-red/15 bg-folk-red/5 p-4">
            <p className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
              {streak.currentStreak > 0 && (
                <span className="flame-flicker inline-block" style={{ width: 14, height: 20 }} aria-hidden>
                  <svg viewBox="0 0 24 32" fill="none" width="100%" height="100%">
                    <path
                      d="M12 0C12 8 4 10 4 19a8 8 0 0016 0C20 12 15 11 15 6c0 4-3 5-3 8a3 3 0 01-3-3c0-4 3-5 3-11z"
                      fill="#d63b2f"
                    />
                    <path d="M12 14c0 3-2 3.5-2 6.5a2.5 2.5 0 005 0c0-2-1.2-2-1.2-4.2" fill="#e0a934" />
                  </svg>
                </span>
              )}
              {streak.currentStreak} {dict.profile.streakDaysUnit}
            </p>
            <p className="text-sm text-foreground/60">{dict.profile.currentStreakLabel}</p>
          </div>
          <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <p className="text-2xl font-semibold tabular-nums">
              {streak.longestStreak} {dict.profile.streakDaysUnit}
            </p>
            <p className="text-sm text-foreground/60">{dict.profile.longestStreakLabel}</p>
          </div>
        </div>

        {streak.currentStreak > 0 ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              streak.activeToday
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}
          >
            {streak.activeToday ? dict.profile.streakActiveTodayNote : dict.profile.streakAtRiskNote}
          </p>
        ) : (
          <p className="mt-3 rounded-lg bg-foreground/5 px-3 py-2 text-sm text-foreground/60">
            {dict.profile.streakNoneNote}
          </p>
        )}
      </section>

      {weakTopic && (
        <section className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 sm:p-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {dict.profile.weakTopicHeading}
          </span>
          <p className="mt-1 font-medium">{weakTopic.title}</p>
          <p className="mt-1 text-sm text-foreground/60">
            {dict.profile.weakTopicScoreLabel}: {weakTopic.percentage}%
          </p>
          <Link
            href={`/${lang}/courses/${weakTopic.level}/exam/${weakTopic.examSlug}`}
            className="tap mt-4 inline-block rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {dict.profile.weakTopicCta}
          </Link>
        </section>
      )}

      <section className="mt-8">
        <SectionHeading icon={<ChartIcon className="h-[18px] w-[18px]" />}>
          {dict.profile.progressHeading}
        </SectionHeading>
        <div className="mt-4 flex flex-col gap-4">
          {levelSlugs.map((level) => {
            const levelDict = dict.courses.levels[level];
            const levelProgress = progress[level];
            return (
              <div key={level}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{levelDict.title}</span>
                  <span className="text-foreground/60">
                    {levelProgress.percent}% · {levelProgress.completed}/
                    {levelProgress.total} {dict.profile.lessonsCompleted}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={levelProgress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={levelDict.title}
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-foreground/10"
                >
                  <div
                    className="h-full rounded-full bg-foreground transition-[width]"
                    style={{ width: `${levelProgress.percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Per-lesson results: status, score, and what to review */}
      <section className="mt-8">
        <SectionHeading icon={<ChecklistIcon className="h-[18px] w-[18px]" />}>
          {dict.profile.resultsHeading}
        </SectionHeading>
        {levelSlugs.every((level) => lessonResults[level].length === 0) ? (
          <p className="mt-2 text-sm text-foreground/60">
            {dict.profile.resultsEmpty}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {levelSlugs.map((level) => {
              const rows = lessonResults[level];
              if (rows.length === 0) return null;
              const levelDict = dict.courses.levels[level];
              return (
                <div key={level} className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                    {levelDict.title}
                  </span>
                  {rows.map((row) => {
                    const lessonTitle =
                      levelDict.lessons[Number(row.lessonSlug) - 1] ??
                      row.lessonSlug;
                    return (
                      <div
                        key={row.lessonSlug}
                        className="flex flex-col gap-1 rounded-2xl border border-black/10 p-4 text-sm dark:border-white/10"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{lessonTitle}</span>
                          <span className="flex items-center gap-2">
                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {dict.profile.lessonPassedLabel}
                            </span>
                            <span className="text-foreground/60">
                              {dict.profile.scoreLabel}: {row.score}%
                            </span>
                          </span>
                        </div>
                        {row.mistakes.length === 0 ? (
                          <p className="text-foreground/60">
                            {dict.profile.noMistakesLabel}
                          </p>
                        ) : (
                          <div className="mt-1 flex flex-col gap-2 border-t border-black/10 pt-2 dark:border-white/10">
                            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                              {dict.profile.examMistakeReviewHeading}
                            </span>
                            {row.mistakes.map((mistake) => (
                              <div
                                key={mistake.exerciseId}
                                className="flex flex-col gap-1 rounded-xl bg-black/[.03] p-3 text-xs dark:bg-white/[.05]"
                              >
                                <p className="font-medium text-foreground/80">
                                  {mistake.prompt}
                                </p>
                                <p className="text-red-600 dark:text-red-400">
                                  {dict.profile.examMistakeYourAnswer}:{" "}
                                  {mistake.yourAnswer}
                                </p>
                                <p className="text-emerald-600 dark:text-emerald-400">
                                  {dict.profile.examMistakeCorrectAnswer}:{" "}
                                  {mistake.correctAnswer}
                                </p>
                                {mistake.explanation && (
                                  <p className="text-foreground/60">
                                    {dict.profile.examMistakeExplanation}:{" "}
                                    {mistake.explanation}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Exam attempts: milestone assessments every 10 lessons */}
      <section className="mt-8">
        <SectionHeading icon={<GraduationCapIcon className="h-[18px] w-[18px]" />}>
          {dict.profile.examResultsHeading}
        </SectionHeading>
        {examAttempts.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/60">
            {dict.profile.examResultsEmpty}
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {examAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 text-sm dark:border-white/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {attempt.level.toUpperCase()} · {attempt.examSlug}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        attempt.passed
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {attempt.passed
                        ? dict.profile.examPassedLabel
                        : dict.profile.examFailedLabel}
                    </span>
                    <span className="text-foreground/60">
                      {attempt.earned}/{attempt.total} ({attempt.percentage}%)
                    </span>
                  </span>
                </div>
                <p className="text-xs text-foreground/50">
                  {dateFormatter.format(attempt.completedAt)}
                </p>
                <p className="text-foreground/60">
                  {dict.profile.examBreakdownLabel}:{" "}
                  {Object.entries(attempt.breakdown)
                    .map(([area, score]) => `${area} ${score.percentage}%`)
                    .join(" · ")}
                </p>
                {Object.entries(attempt.breakdown).some(
                  ([, score]) => score.mistakes.length > 0,
                ) && (
                  <div className="mt-2 flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/10">
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                      {dict.profile.examMistakeReviewHeading}
                    </span>
                    {Object.entries(attempt.breakdown).map(([area, score]) =>
                      score.mistakes.length === 0 ? null : (
                        <div key={area} className="flex flex-col gap-2">
                          <span className="text-xs font-semibold text-foreground/70">
                            {area}
                          </span>
                          {score.mistakes.map((mistake) => (
                            <div
                              key={mistake.exerciseId}
                              className="flex flex-col gap-1 rounded-xl bg-black/[.03] p-3 text-xs dark:bg-white/[.05]"
                            >
                              <p className="font-medium text-foreground/80">
                                {mistake.prompt}
                              </p>
                              <p className="text-red-600 dark:text-red-400">
                                {dict.profile.examMistakeYourAnswer}:{" "}
                                {mistake.yourAnswer}
                              </p>
                              <p className="text-emerald-600 dark:text-emerald-400">
                                {dict.profile.examMistakeCorrectAnswer}:{" "}
                                {mistake.correctAnswer}
                              </p>
                              {mistake.explanation && (
                                <p className="text-foreground/60">
                                  {dict.profile.examMistakeExplanation}:{" "}
                                  {mistake.explanation}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Courses list */}
      <section className="mt-8">
        <SectionHeading icon={<BookIcon className="h-[18px] w-[18px]" />}>
          {dict.profile.coursesHeading}
        </SectionHeading>
        {!entitled && (
          <p className="mt-2 text-sm text-foreground/60">
            {dict.profile.lockedNotice}
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {levelSlugs.map((level) => {
            const levelDict = dict.courses.levels[level];
            const levelProgress = progress[level];
            const ctaLabel =
              levelProgress.percent >= 100
                ? dict.profile.completedButton
                : levelProgress.percent > 0
                  ? dict.profile.continueButton
                  : dict.profile.startButton;

            return (
              <div
                key={level}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-black/10 p-5 dark:border-white/10"
              >
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                    {level}
                  </span>
                  <h3 className="mt-1 font-medium">{levelDict.title}</h3>
                  <p className="mt-1 text-sm text-foreground/60">
                    {levelDict.subtitle}
                  </p>
                </div>
                <Link
                  href={
                    entitled ? `/${lang}/courses/${level}` : `/${lang}/pricing`
                  }
                  className={`tap w-full rounded-full px-4 py-2 text-center text-sm font-medium transition-colors sm:w-fit ${
                    entitled
                      ? "bg-foreground text-background hover:bg-foreground/85 active:bg-foreground/85"
                      : "border border-black/10 hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
                  }`}
                >
                  {entitled ? ctaLabel : dict.account.seePricing}
                </Link>
              </div>
            );
          })}
        </div>
      </section>
      </>
      )}
    </div>
  );
}
