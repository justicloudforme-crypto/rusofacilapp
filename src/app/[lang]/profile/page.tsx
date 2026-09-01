import type { Metadata } from "next";
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
  getSubscriptionsForUser,
  getDisplayStatus,
  pickEffectiveSubscription,
  tierOfSubscriptions,
  type DisplayStatus,
} from "@/lib/subscription";
import { getLevelProgress, getLessonProgressDetails, getFirstIncompleteLessonSlug } from "@/lib/progress";
import { getUserStreakStats, getUserActivityDateKeys, getUserActivityDaySources } from "@/lib/streaks";
import { getRequestTimeZone } from "@/lib/timezone-server";
import { dateKeyIn } from "@/lib/timezone";
import { getExamAttempts, type ExamAttemptSummary } from "@/lib/exams/progress";
import { getUserBadgesForDisplay, type DisplayBadge } from "@/lib/badges";
import type { BadgeDef } from "@/lib/badges/catalog";
import { getWeeklyWeakTopic } from "@/lib/weak-topic";
import { getReferralStats } from "@/lib/referral";
import { getPublicProfileToggleState } from "@/lib/public-profile";
import { getStoryCatalog } from "@/lib/stories-catalog";
import CopyReferralLink from "@/components/profile/CopyReferralLink";
import PublicProfileToggle from "@/components/profile/PublicProfileToggle";
import { levelSlugs } from "@/lib/courses";
import { isPlanId } from "@/lib/plans";
import { SUPPORT_EMAIL } from "@/lib/support";
import {
  CheckoutOutcomeNotice,
  checkoutDeliveredWhatWasPaidFor,
} from "@/components/subscription/CheckoutOutcomeNotice";
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
import { ownerScopeFor } from "@/lib/recordings-owner";
import DeleteAccountForm from "@/components/profile/DeleteAccountForm";
import VoiceRecordingsPanel from "@/components/profile/VoiceRecordingsPanel";
import NativeSubscriptionPanel from "@/components/subscription/NativeSubscriptionPanel";
import LocalDate from "@/components/profile/LocalDate";
import SettingsAccordion from "@/components/profile/SettingsAccordion";
import ActivityCalendar from "@/components/profile/ActivityCalendar";
import StreakExplanation from "@/components/profile/StreakExplanation";
import FirstStepCards, { type FirstStepItem } from "@/components/profile/FirstStepCards";
import { TELEGRAM_INVITE_URL } from "@/components/TelegramFloatButton";
import {
  PersonalIcon,
  AppearanceIcon,
  GlobeIcon,
  CrownIcon,
  TrophyIcon,
  GiftIcon,
  LockIcon,
  TrashIcon,
  CalendarIcon,
  ChartIcon,
  ChecklistIcon,
  GraduationCapIcon,
  BookIcon,
  DictionaryIcon,
} from "@/components/profile/ProfileIcons";
import type { ReactNode } from "react";
import ProgressBar from "@/components/ui/ProgressBar";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getProfileTabs, isProfileTab, type ProfileTab } from "@/lib/profile-tabs";
import Tabs from "@/components/ui/Tabs";
import { routeAlternates } from "@/lib/site";
import { plural } from "@/lib/plural";
import { formatDateKey } from "@/lib/activity-calendar";
import { freezesCoverWholeHistory } from "@/lib/streak-freezes";

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
            : "bg-primary/10 text-primary-text dark:text-primary-400"
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

// Earned badges render gold (the premium token) — they're a non-clickable
// value marker, same rule as the crown/PremiumBadge everywhere else in the
// app. Locked badges show a real fraction toward unlock when one is
// computable from data we already have (streak/vocab/exam-count badges);
// the rest (first-exam, perfect-score, case masters) stay a plain locked
// label rather than a fabricated fraction — see computeBadgeProgress.
function BadgeTile({
  icon,
  title,
  description,
  earned,
  earnedOnText,
  lockedLabel,
  progressLabel,
  compact = false,
}: {
  icon: string;
  title: string;
  description?: string;
  earned: boolean;
  earnedOnText?: ReactNode;
  lockedLabel: string;
  progressLabel: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center ${
        earned
          ? "border-premium-500/25 bg-premium-500/5"
          : "border-black/10 opacity-60 dark:border-white/30"
      }`}
    >
      <span aria-hidden="true" className={`text-3xl ${earned ? "" : "grayscale opacity-70"}`}>
        {icon}
      </span>
      <span className="text-sm font-medium">{title}</span>
      {!compact && description && <span className="text-xs text-foreground/60">{description}</span>}
      <span
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          earned ? "text-premium-700 dark:text-premium-300" : "text-foreground/40"
        }`}
      >
        {earned ? earnedOnText : (progressLabel ?? lockedLabel)}
      </span>
    </div>
  );
}

interface BadgeProgress {
  ratio: number;
  label: string | null;
}

// Pure — a real fraction toward unlock only for badge families where the
// underlying count is unambiguous (streak length, vocab count, exams
// passed at a level). Everything else returns ratio 0 / label null rather
// than inventing a number ("how close" to a single 100%-on-any-block
// mastery badge isn't a fraction the data can honestly express).
function computeBadgeProgress(
  def: BadgeDef,
  ctx: { longestStreak: number; wordsLearned: number; examAttempts: ExamAttemptSummary[] },
  dict: Dictionary,
  locale: Locale,
): BadgeProgress {
  if (def.id.startsWith("streak-")) {
    const threshold = Number(def.id.slice("streak-".length));
    const current = Math.min(ctx.longestStreak, threshold);
    return {
      ratio: ctx.longestStreak / threshold,
      label: plural(locale, threshold, dict.profile.badgeProgressStreak, {
        current,
        total: threshold,
      }),
    };
  }
  if (def.id.startsWith("vocab-")) {
    const threshold = Number(def.id.slice("vocab-".length));
    const current = Math.min(ctx.wordsLearned, threshold);
    return {
      ratio: ctx.wordsLearned / threshold,
      label: plural(locale, threshold, dict.profile.badgeProgressVocab, {
        current,
        total: threshold,
      }),
    };
  }
  if (def.id.startsWith("graduate-")) {
    // Every level has exactly 3 exams — same fixed roster badges/index.ts
    // uses to decide the graduate badge itself.
    const level = def.id.slice("graduate-".length);
    const passedSlugs = new Set(
      ctx.examAttempts.filter((a) => a.passed && a.level === level).map((a) => a.examSlug),
    );
    const current = Math.min(passedSlugs.size, 3);
    return {
      ratio: current / 3,
      label: plural(locale, 3, dict.profile.badgeProgressExam, { current, total: 3 }),
    };
  }
  return { ratio: 0, label: null };
}

function buildBadgeDisplay(
  badges: DisplayBadge[],
  ctx: { longestStreak: number; wordsLearned: number; examAttempts: ExamAttemptSummary[] },
  dict: Dictionary,
  locale: Locale,
) {
  const withProgress = badges.map((b) => ({ ...b, ...computeBadgeProgress(b.def, ctx, dict, locale) }));
  const earned = withProgress
    .filter((b) => b.earnedAt !== null)
    .sort((a, b) => (b.earnedAt as Date).getTime() - (a.earnedAt as Date).getTime());
  const locked = withProgress.filter((b) => b.earnedAt === null).sort((a, b) => b.ratio - a.ratio);
  return { sorted: [...earned, ...locked], topLocked: locked.slice(0, 3) };
}

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

const STATUS_BADGE_CLASSES: Record<DisplayStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  trialing: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  past_due: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  canceled: "bg-red-500/10 text-red-600 dark:text-red-400",
  expired: "bg-red-500/10 text-red-600 dark:text-red-400",
  none: "bg-foreground/10 text-foreground/60",
};

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/profile">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/profile") };
}

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
  // What the buyer just paid for, carried back from Stripe by
  // /api/checkout's success_url. Anything else (including it being absent,
  // which is what a bookmarked ?checkout=success looks like) is read as
  // "some paid plan", whose promise is simply an active subscription.
  const paidPlan = typeof query.plan === "string" && isPlanId(query.plan) ? query.plan : null;
  const voucherUnavailable = query.voucher === "unavailable";
  const justCanceled = query.subscription === "canceled";
  const loggedOutEverywhere = query.loggedOutEverywhere === "1";
  const rawTab = typeof query.tab === "string" ? query.tab : "";
  // Checkout/cancel redirects land here without a `tab` param — default to
  // the subscription tab in that case so the notice and the section it's
  // about are visible together, instead of the notice appearing on
  // whatever tab happens to be default.
  const defaultTab: ProfileTab = checkout || justCanceled ? "subscription" : "overview";
  const activeTab: ProfileTab = isProfileTab(rawTab) ? rawTab : defaultTab;

  // Subscription reads are wrapped defensively: a schema-drift error here
  // (e.g. a column pushed to the Prisma schema but not yet to the prod DB,
  // see the 2026-08-23 incident) must not take down the whole profile page
  // — badges/progress/referral etc. are unrelated and should still render.
  // A failure degrades to "no subscription data" rather than a raw 500.
  // The learner's own midnight, not the server's — see src/lib/timezone.ts.
  // Resolved before the batch below because both the streak and the
  // activity heatmap have to be derived in the same zone.
  const timeZone = await getRequestTimeZone(user.timezone);

  // Both derived here, in the learner's zone, and handed to the calendar as
  // strings. The calendar is a client component and must not build a second
  // notion of "today" from the browser's clock: the streak, the freeze
  // ledger and the grid have to be one calendar or the whole picture shifts
  // by a day for anyone whose device disagrees with their account.
  const todayKey = dateKeyIn(new Date(), timeZone);
  // The one sentence that keeps "nine flames" and "racha actual: 2 días"
  // from reading as a contradiction. Built once; the Overview tiles and the
  // Progress tab show the same line, because they show the same number.
  const streakExplanationDict = {
    sinceBreak: dict.profile.streakSinceBreakNote,
    neverBroken: dict.profile.streakNeverBrokenNote,
    none: dict.profile.streakNoneNote,
    monthsInDate: dict.profile.calendarMonthsInDate,
    datePattern: dict.profile.calendarDatePattern,
  };
  const registeredDateKey = dateKeyIn(user.createdAt, timeZone);

  const [
    subscriptionHistory,
    progress,
    lessonResults,
    examAttempts,
    wordsLearned,
    streak,
    activityDateKeys,
    activityDaySources,
    theme,
    badges,
    weakTopic,
    referral,
    publicProfile,
    storyCatalog,
    requestHeaders,
  ] = await Promise.all([
    getSubscriptionsForUser(user.id).catch((error) => {
      console.error("profile: getSubscriptionsForUser failed", error);
      return [];
    }),
    getLevelProgress(user.id),
    getLessonProgressDetails(user.id),
    getExamAttempts(user.id),
    db.flashcardProgress.count({ where: { userId: user.id, known: true } }),
    getUserStreakStats(user.id, timeZone, user),
    getUserActivityDateKeys(user.id, timeZone),
    getUserActivityDaySources(user.id, timeZone),
    getThemePreference(),
    getUserBadgesForDisplay(user.id),
    getWeeklyWeakTopic(user.id),
    getReferralStats(user.id),
    getPublicProfileToggleState(user.id),
    getStoryCatalog().catch(() => []),
    headers(),
  ]);
  const earnedBadgeCount = badges.filter((b) => b.earnedAt !== null).length;
  // "Freezes apply from <date>" — printed only when there is history the
  // freeze rule was never allowed to touch, i.e. when the epoch is later than
  // the learner's first day. An account that registered after freezes shipped
  // gets no such sentence, because for them the plain rule IS the whole truth.
  //
  // This is the half that was missing on 01.09.2026 (PROGRESS.md 7.72): the
  // rule spends a freeze on a single missed day and paints that square icy,
  // exactly as promised — but only from the epoch onward, and the page never
  // said so. Three separate gaps before the epoch with both freezes untouched
  // read as a dead feature.
  const freezeSinceNote = !freezesCoverWholeHistory(streak.freezesSince, registeredDateKey)
    ? dict.profile.streakFreezeSinceNote.replace(
        "{date}",
        formatDateKey(
          streak.freezesSince,
          dict.profile.calendarDatePattern,
          dict.profile.calendarMonthsInDate,
        ),
      )
    : null;

  const requestHost = requestHeaders.get("host") ?? "rusofacilapp.com";
  const requestProto = requestHeaders.get("x-forwarded-proto") ?? (requestHost.startsWith("localhost") ? "http" : "https");
  const referralLink = referral ? `${requestProto}://${requestHost}/${lang}/register?ref=${referral.code}` : null;

  // One row to describe, but every row to decide by. The two used to be
  // the same read (the newest row), and that is exactly what let a Premium
  // purchase made on top of a monthly plan disappear from this page the
  // moment the monthly plan renewed. See pickEffectiveSubscription and
  // tierOfSubscriptions in src/lib/subscription.ts.
  const subscription = pickEffectiveSubscription(subscriptionHistory);
  const tier = tierOfSubscriptions(subscriptionHistory);
  const displayStatus = getDisplayStatus(subscription);
  const isActive = tier !== "free";
  // Staff/owner accounts have full access regardless of whether they've
  // ever had a paid Subscription row — without this, an owner who never
  // went through checkout would see the same "subscribe now" upsells as a
  // regular unsubscribed student on this page (the lesson/story/exam pages
  // already had this bypass; this page didn't).
  const entitled = isStaff(user.role) || isActive;
  // Drives the gold ring/crown on this page's own avatar (below) and the
  // crown next to the plan name in the Subscription tab — see
  // MatryoshkaAvatar.tsx's `premium` prop / entitlement.ts's isPremiumTier.
  const isPremiumUser = isStaff(user.role) || tier === "premium";

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

  const tabs = getProfileTabs(dict);

  // --- Empty-state logic (Problem 1) ------------------------------------
  const totalLessonsCompleted = levelSlugs.reduce((sum, level) => sum + progress[level].completed, 0);
  const hasAnyProgress = wordsLearned > 0 || totalLessonsCompleted > 0 || streak.longestStreak > 0;
  // "Early" = something's there, but not enough to be worth 9 stat tiles
  // yet — both thresholds grow quickly from normal use (one flashcard
  // category clears the vocab one; 3 lessons is roughly one week), so this
  // window is short by design, not a permanent second empty state.
  const isEarlyProgress = hasAnyProgress && wordsLearned < 20 && totalLessonsCompleted < 3;
  const progressState: "zero" | "early" | "normal" = !hasAnyProgress ? "zero" : isEarlyProgress ? "early" : "normal";
  const allLevelsZero = levelSlugs.every((level) => progress[level].completed === 0);

  // --- "Continue" card target (Overview) ---------------------------------
  let continueTarget: { href: string; title: string; cta: string } | null = null;
  if (currentLevel) {
    const nextSlug = await getFirstIncompleteLessonSlug(user.id, currentLevel);
    if (nextSlug) {
      const lessonTitle = dict.courses.levels[currentLevel].lessons[Number(nextSlug) - 1] ?? nextSlug;
      continueTarget = {
        href: `/${lang}/courses/${currentLevel}/${nextSlug}`,
        title: lessonTitle,
        cta: dict.profile.continueButton,
      };
    } else {
      const nextLevel = levelSlugs[levelSlugs.indexOf(currentLevel) + 1];
      if (nextLevel) {
        continueTarget = {
          href: `/${lang}/courses/${nextLevel}/1`,
          title: dict.courses.levels[nextLevel].title,
          cta: dict.profile.continueNextLevelCta,
        };
      }
    }
  }

  // --- "First step" / "What's next" cards (Overview + Progress) ----------
  const firstFreeStory = storyCatalog.find(
    (row) => row.level === "A1" && !row.isPremium && !row.premiumOnly,
  );
  const lessonItem: FirstStepItem = {
    key: "lesson",
    icon: <GraduationCapIcon className="h-[18px] w-[18px]" />,
    title: dict.profile.firstStepLessonTitle,
    description: dict.profile.firstStepLessonDescription,
    href: `/${lang}/courses/a1/1`,
    cta: dict.profile.startButton,
  };
  const vocabItem: FirstStepItem = {
    key: "vocab",
    icon: <DictionaryIcon className="h-[18px] w-[18px]" />,
    title: dict.profile.firstStepVocabTitle,
    description: dict.profile.firstStepVocabDescription,
    href: `/${lang}/vocabulary`,
    cta: dict.profile.startButton,
  };
  const storyItem: FirstStepItem | null = firstFreeStory
    ? {
        key: "story",
        icon: <BookIcon className="h-[18px] w-[18px]" />,
        title: dict.profile.firstStepStoryTitle,
        description: dict.profile.firstStepStoryDescription,
        href: `/${lang}/stories/${firstFreeStory.id}`,
        cta: dict.profile.startButton,
      }
    : null;
  const zeroStepItems: FirstStepItem[] = [lessonItem, vocabItem, ...(storyItem ? [storyItem] : [])];
  const whatsNextItems: FirstStepItem[] = [
    ...(totalLessonsCompleted === 0 ? [lessonItem] : []),
    ...(wordsLearned === 0 ? [vocabItem] : []),
    ...(storyItem ? [storyItem] : []),
  ].slice(0, 3);

  // --- Badges (Problem 4) -------------------------------------------------
  const badgeDisplay = buildBadgeDisplay(
    badges,
    { longestStreak: streak.longestStreak, wordsLearned, examAttempts },
    dict,
    lang,
  );

  // Split around {date} instead of dateFormatter.format()-ing it into the
  // string, so the date itself can render as <LocalDate> (browser-timezone
  // aware) rather than baking in the server's UTC value — see LocalDate.tsx.
  // Per-plan template (not a single generic "Pro" label, which named a tier
  // that doesn't exist on /pricing — a real device report caught it): the
  // lifetime plan has no renewal date at all, so its template carries no
  // {date} placeholder to split on.
  const subscriptionCompactTemplate =
    subscription?.plan === "monthly"
      ? dict.profile.subscriptionCompactMonthly
      : subscription?.plan === "annual"
        ? dict.profile.subscriptionCompactAnnual
        : null;
  const subscriptionCompactParts =
    subscription && isActive && subscriptionCompactTemplate ? subscriptionCompactTemplate.split("{date}") : null;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <WelcomeOverlay
        userId={user.id}
        name={user.name}
        currentStreak={streak.currentStreak}
        greeting={dict.profile.welcomeGreeting}
        subtextActive={dict.profile.welcomeSubtextActive}
        subtextNew={dict.profile.welcomeSubtextNew}
        locale={lang}
        streakDaysUnit={dict.profile.streakDaysUnit}
        continueLabel={dict.profile.welcomeContinue}
      />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {dict.profile.title}
      </h1>
      <p className="mt-1 text-sm text-foreground/70">{dict.profile.subtitle}</p>

      <Tabs
        className="mt-6"
        label={dict.profile.title}
        activeId={activeTab}
        items={tabs}
        hrefBase={`/${lang}/profile`}
      />

      {checkout === "mock" && (
        <p className="mt-6 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          {dict.account.checkoutMock}
        </p>
      )}
      {checkout === "success" && (
        <CheckoutOutcomeNotice
          // The banner states a fact about the account, so it is decided
          // by the account: "your subscription is active" is only printed
          // when it is.
          granted={checkoutDeliveredWhatWasPaidFor(paidPlan, tier)}
          strings={{
            success: dict.account.checkoutSuccess,
            verifying: dict.account.checkoutVerifying,
            notApplied: dict.account.checkoutNotApplied,
            supportEmail: SUPPORT_EMAIL,
            supportEmailLabel: dict.account.checkoutSupportEmailLabel,
          }}
        />
      )}
      {checkout === "oxxo_pending" && (
        <div className="mt-6 flex flex-col gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          <p>{voucherUnavailable ? dict.account.checkoutOxxoVoucherUnavailable : dict.account.checkoutOxxoPending}</p>
          {!voucherUnavailable && (
            <a
              href={`/api/subscription/oxxo-voucher?lang=${lang}`}
              className="tap inline-flex w-fit min-h-9 items-center rounded-full bg-amber-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-amber-700 active:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 dark:active:bg-amber-600"
            >
              {dict.account.openOxxoVoucher}
            </a>
          )}
        </div>
      )}
      {justCanceled && (
        <p className="mt-6 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {dict.profile.canceledNotice}
        </p>
      )}

      {/* Overview */}
      {activeTab === "overview" && (
        <section className="mt-8 flex flex-col gap-6">
          {continueTarget && (
            <Card tone="primary" padding="lg" shadow>
              <SectionHeading icon={<BookIcon className="h-[18px] w-[18px]" />}>
                {dict.profile.continueHeading}
              </SectionHeading>
              <p className="mt-3 text-lg font-medium">{continueTarget.title}</p>
              <Button href={continueTarget.href} size="lg" fullWidth className="mt-4">
                {continueTarget.cta}
              </Button>
            </Card>
          )}

          {progressState !== "zero" && (
            /* Two columns from `md` up: the calendar on the left, the stat
               tiles, the streak sentence and the freeze balance on the
               right. Below `md` this is one column in the same order it has
               always been — the wrapper is `contents` there, so the stack
               is byte-for-byte the page that shipped.

               Measured before the change, on all four tablet widths and in
               both locales: the calendar was 384px inside a 720px container
               (53.3%, 336px of bare page to its right) at 768, 820, 834 and
               1024 alike, and the freeze box was a 720px-wide band under it.
               The page had one column of content and a second column of
               nothing. */
            <div className="contents md:grid md:grid-cols-2 md:items-start md:gap-6">
              <section>
                <SectionHeading icon={<CalendarIcon className="h-[18px] w-[18px]" />}>
                  {dict.profile.activityCalendarHeading}
                </SectionHeading>
                {/* A real month grid, not the 30-day strip it replaced. The
                    strip showed the same four facts in a shape that could
                    not say which Tuesday a day was, and keeping both would
                    have drawn one history twice in two visual languages.
                    Every day it can show is already in hand here; paging
                    months costs no request. */}
                <div className="mt-3">
                  <ActivityCalendar
                    activeDateKeys={activityDateKeys}
                    frozenDateKeys={streak.frozenDateKeys}
                    daySources={activityDaySources}
                    todayKey={todayKey}
                    firstDateKey={registeredDateKey}
                    dict={{
                      prevMonth: dict.profile.calendarPrevMonth,
                      nextMonth: dict.profile.calendarNextMonth,
                      legendActive: dict.profile.calendarLegendActive,
                      legendFrozen: dict.profile.calendarLegendFrozen,
                      legendMissed: dict.profile.calendarLegendMissed,
                      legendBeforeStart: dict.profile.calendarLegendBeforeStart,
                      legendFuture: dict.profile.calendarLegendFuture,
                      legendToday: dict.profile.calendarLegendToday,
                      months: dict.profile.calendarMonths,
                      monthsInDate: dict.profile.calendarMonthsInDate,
                      datePattern: dict.profile.calendarDatePattern,
                      weekdays: dict.profile.calendarWeekdays,
                      weekdaysFull: dict.profile.calendarWeekdaysFull,
                      summaryStudied: dict.profile.calendarSummaryStudied,
                      summarySaved: dict.profile.calendarSummarySaved,
                      dayOpenLabel: dict.profile.calendarDayOpenLabel,
                      dayCloseLabel: dict.profile.calendarDayCloseLabel,
                      dayDetailHeading: dict.profile.calendarDayDetailHeading,
                      sourceLabels: {
                        lesson: dict.profile.calendarSourceLesson,
                        story: dict.profile.calendarSourceStory,
                        flashcards: dict.profile.calendarSourceFlashcards,
                        "word-game": dict.profile.calendarSourceWordGame,
                        exam: dict.profile.calendarSourceExam,
                        media: dict.profile.calendarSourceMedia,
                      },
                    }}
                  />
                </div>
              </section>

              {/* The right column. `contents` below `md` again: with no
                  wrapper box of its own the three blocks stay direct
                  children of the page's own column stack and keep the
                  spacing they had. */}
              <div className="contents md:flex md:flex-col md:gap-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-2">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
                  <p className="text-2xl font-semibold tabular-nums">{wordsLearned}</p>
                  <p className="text-sm text-foreground/60">
                    {plural(lang, wordsLearned, dict.profile.wordsLearnedLabel)}
                  </p>
                </div>
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
                  <p className="text-2xl font-semibold tabular-nums">{totalLessonsCompleted}</p>
                  <p className="text-sm text-foreground/60">
                    {plural(lang, totalLessonsCompleted, dict.profile.lessonsCompleted)}
                  </p>
                </div>
                <div className="rounded-2xl border border-folk-red/15 bg-folk-red/5 p-4">
                  <p className="text-2xl font-semibold tabular-nums">
                    {streak.currentStreak} {plural(lang, streak.currentStreak, dict.profile.streakDaysUnit)}
                  </p>
                  <p className="text-sm text-foreground/60">{dict.profile.currentStreakLabel}</p>
                </div>
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
                  <p className="text-2xl font-semibold uppercase">{currentLevel ?? "—"}</p>
                  <p className="text-sm text-foreground/60">
                    {currentLevel ? dict.profile.currentLevelLabel : dict.profile.noLevelStarted}
                  </p>
                </div>
              </div>

              {/* Directly under the streak tile, because this is where the
                  calendar above and the number in the tile stop agreeing to
                  the eye. */}
              <StreakExplanation
                currentStreak={streak.currentStreak}
                chainStartedOn={streak.chainStartedOn}
                brokenOn={streak.brokenOn}
                dict={streakExplanationDict}
                className="-mt-1 md:mt-0"
              />

              {/* The freeze balance. Shown always, including at zero: "none
                  left" is exactly the number that changes what tomorrow
                  costs.

                  It is a BOX, not a third grey line, and it carries the only
                  ❄️ on the page. The month summary under the calendar counts
                  days on that grid and wears the grid's own swatches; this
                  counts a stock that has nothing to do with the month on
                  screen. Until 01.09.2026 both were small grey lines with a
                  snowflake each, and the difference between "saved 0" and "2
                  left" was not readable at a glance.

                  It sat directly under the calendar until 02.09.2026 and now
                  sits at the foot of the right-hand column, which is where
                  the streak numbers it belongs to already are. It is also
                  sized by its content: it used to be a full-width band —
                  720 of 720px at every tablet width — around one short line
                  and a number, and a box that wide reads as a section rather
                  than as the one small fact it carries. `max-w-full` keeps
                  it inside a narrow phone column, where the epoch note below
                  it does wrap. */}
              <div className="flex w-fit max-w-full flex-col gap-1 rounded-2xl border border-sky-500/20 bg-sky-400/5 px-4 py-3">
                <p className="flex items-center gap-2 text-sm">
                  <span aria-hidden className="text-base leading-none">
                    ❄️
                  </span>
                  <span className="text-foreground/70">{dict.profile.streakFreezesLeftLabel}:</span>
                  <b className="text-lg tabular-nums">{streak.freezesLeft}</b>
                </p>
                {freezeSinceNote && <p className="text-xs text-foreground/60">{freezeSinceNote}</p>}
              </div>
              </div>
            </div>
          )}

          {progressState === "zero" && (
            <FirstStepCards heading={dict.profile.firstStepHeading} items={zeroStepItems} />
          )}
          {progressState === "early" && (
            <FirstStepCards heading={dict.profile.whatNextHeading} items={whatsNextItems} />
          )}

          {progressState !== "zero" && badgeDisplay.topLocked.length > 0 && (
            <section>
              <SectionHeading icon={<TrophyIcon className="h-[18px] w-[18px]" />}>
                {dict.profile.upcomingBadgesHeading}
              </SectionHeading>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {badgeDisplay.topLocked.map((b) => (
                  <BadgeTile
                    key={b.def.id}
                    icon={b.def.icon}
                    title={b.def.title[lang]}
                    earned={false}
                    lockedLabel={dict.profile.badgesLockedLabel}
                    progressLabel={b.label}
                    compact
                  />
                ))}
              </div>
            </section>
          )}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeading icon={<CrownIcon className="h-[18px] w-[18px]" />}>
                {dict.profile.subscriptionHeading}
              </SectionHeading>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[displayStatus]}`}>
                {subscription && isActive && subscription.plan === "lifetime" ? (
                  dict.profile.subscriptionCompactLifetime
                ) : subscriptionCompactParts && subscription ? (
                  <>
                    {subscriptionCompactParts[0]}
                    <LocalDate iso={subscription.currentPeriodEnd.toISOString()} locale={lang} />
                    {subscriptionCompactParts[1]}
                  </>
                ) : (
                  dict.profile.subscriptionCompactFree
                )}
              </span>
            </div>
            {/* Per-plan upsell, same card, no separate banner — free shows
                the existing full CTA (nothing to compare against yet, so
                a clear "unlock everything" button is warranted); monthly/
                annual show a small text link instead, sized like a
                ContinueStrip tile rather than a full button, since this is
                a nudge for someone who's already paying, not a hard sell.
                Nothing renders for lifetime — there's nowhere left to
                upgrade to. Never touches checkout: both links only point
                at /pricing (annual is pre-selected there by default;
                premium is highlighted via ?highlight=premium), the actual
                plan change still goes through the real checkout flow. */}
            {!isActive ? (
              <Link
                href={`/${lang}/pricing`}
                className="tap mt-4 inline-block rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
              >
                {dict.profile.profileUpsellFree}
              </Link>
            ) : subscription?.plan === "monthly" ? (
              <Link
                href={`/${lang}/pricing`}
                className="tap mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text"
              >
                {dict.profile.profileUpsellToAnnual} →
              </Link>
            ) : subscription?.plan === "annual" ? (
              <Link
                href={`/${lang}/pricing?highlight=premium#premium`}
                className="tap mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text"
              >
                {dict.profile.profileUpsellToPremium} →
              </Link>
            ) : null}
          </Card>

          <Card>
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
            {referral && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
                  <p className="text-2xl font-semibold tabular-nums">{referral.referredCount}</p>
                  <p className="text-sm text-foreground/60">
                    {plural(lang, referral.referredCount, dict.profile.referralInvitedLabel)}
                  </p>
                </div>
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
                  <p className="text-2xl font-semibold tabular-nums">{referral.rewardsEarnedCount}</p>
                  <p className="text-sm text-foreground/60">
                    {plural(lang, referral.rewardsEarnedCount, dict.profile.referralRewardsLabel)}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* Settings */}
      {activeTab === "settings" && (
        <section className="mt-8">
          <SettingsAccordion
            defaultOpenId="personal"
            sections={[
              {
                id: "personal",
                icon: <PersonalIcon className="h-4 w-4" />,
                heading: dict.profile.tabPersonal,
                content: (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <MatryoshkaAvatar id={currentAvatarId} size={56} label={avatarLabels[currentAvatarId]} premium={isPremiumUser} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user.name?.trim() || dict.profile.nameEmpty}</p>
                        <p className="truncate text-sm text-foreground/60">{user.email}</p>
                      </div>
                    </div>
                    <div>
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
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-black/10 pt-5 text-sm dark:border-white/30">
                      <dt className="text-foreground/60">{dict.profile.emailLabel}</dt>
                      <dd>{user.email}</dd>
                      <dt className="text-foreground/60">{dict.profile.memberSinceLabel}</dt>
                      <dd>
                        <LocalDate iso={user.createdAt.toISOString()} locale={lang} />
                      </dd>
                    </dl>
                    <div className="border-t border-black/10 pt-5 dark:border-white/30">
                      <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                        {dict.profile.publicProfileHeading}
                      </span>
                      <p className="mt-1 text-sm text-foreground/60">{dict.profile.publicProfileDescription}</p>
                      <div className="mt-3">
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
                  </div>
                ),
              },
              {
                id: "avatar",
                icon: <PersonalIcon className="h-4 w-4" />,
                heading: dict.profile.avatarHeading,
                content: (
                  <div>
                    <p className="text-sm text-foreground/60">{dict.profile.avatarDescription}</p>
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
                ),
              },
              {
                id: "appearance",
                icon: <AppearanceIcon className="h-4 w-4" />,
                heading: dict.profile.appearanceHeading,
                content: (
                  <div>
                    <p className="text-sm text-foreground/60">{dict.profile.appearanceDescription}</p>
                    <div className="mt-4">
                      <ThemeSwitcher initialTheme={theme} options={themeOptions} />
                    </div>
                  </div>
                ),
              },
              {
                id: "language",
                icon: <GlobeIcon className="h-4 w-4" />,
                heading: dict.profile.languageHeading,
                content: (
                  <div>
                    <p className="text-sm text-foreground/60">{dict.profile.languageDescription}</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      {locales.map((locale: Locale) => (
                        <Link
                          key={locale}
                          href={`/${locale}/profile?tab=settings`}
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
                  </div>
                ),
              },
              {
                id: "security",
                icon: <LockIcon className="h-4 w-4" />,
                heading: dict.profile.tabSecurity,
                content: (
                  <div className="flex flex-col gap-6">
                    {loggedOutEverywhere && (
                      <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                        {dict.profile.loggedOutEverywhereNotice}
                      </p>
                    )}
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                        {dict.profile.changePasswordHeading}
                      </span>
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
                    <div className="border-t border-black/10 pt-5 dark:border-white/30">
                      <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                        {dict.profile.sessionsHeading}
                      </span>
                      <p className="mt-1 text-sm text-foreground/60">{dict.profile.sessionsDescription}</p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <form action="/api/auth/logout-everywhere" method="POST">
                          <input type="hidden" name="lang" value={lang} />
                          <button
                            type="submit"
                            className="tap rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
                          >
                            {dict.profile.logoutEverywhereButton}
                          </button>
                        </form>
                        <form action="/api/auth/logout" method="POST">
                          <input type="hidden" name="lang" value={lang} />
                          <button
                            type="submit"
                            className="tap rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
                          >
                            {dict.auth.logout}
                          </button>
                        </form>
                      </div>
                    </div>
                    <VoiceRecordingsPanel
                      ownerScope={ownerScopeFor(user.id)}
                      locale={lang}
                      heading={dict.profile.voiceRecordingsHeading}
                      description={dict.profile.voiceRecordingsDescription}
                      deviceNote={dict.profile.voiceRecordingsDeviceNote}
                      usageLabel={dict.profile.voiceRecordingsUsage}
                      emptyLabel={dict.profile.voiceRecordingsEmpty}
                      deleteLabel={dict.profile.voiceRecordingsDelete}
                      deletedLabel={dict.profile.voiceRecordingsDeleted}
                      unavailableLabel={dict.profile.voiceRecordingsUnavailable}
                    />
                    <details className="rounded-2xl border border-red-500/20 p-5">
                      <summary className="tap flex min-h-11 cursor-pointer items-center gap-2.5 [&::-webkit-details-marker]:hidden">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                          <TrashIcon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="font-serif text-lg font-semibold text-red-600 dark:text-red-400">
                          {dict.profile.dangerZoneHeading}
                        </span>
                      </summary>
                      <div className="mt-4">
                        <p className="text-sm text-foreground/60">{dict.profile.deleteAccountDescription}</p>
                        <DeleteAccountForm
                          lang={lang}
                          warningLabel={dict.profile.deleteAccountWarning}
                          passwordLabel={dict.profile.currentPasswordLabel}
                          submitLabel={dict.profile.deleteAccountButton}
                          sentLabel={dict.profile.deleteAccountEmailSent}
                          invalidPasswordLabel={dict.profile.invalidCurrentPassword}
                        />
                      </div>
                    </details>
                  </div>
                ),
              },
            ]}
          />

          <div className="mt-6 rounded-2xl border border-[#24A1DE]/25 bg-[#24A1DE]/5 p-5 sm:p-6">
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
            <dd><LocalDate iso={subscription.currentPeriodEnd.toISOString()} locale={lang} /></dd>
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

        <div className="mt-6 border-t border-black/10 pt-5 dark:border-white/30">
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
                  <span className="text-foreground/60">
                    <LocalDate iso={row.createdAt.toISOString()} locale={lang} />
                  </span>
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
              {earnedBadgeCount} / {badges.length} {plural(lang, badges.length, dict.profile.badgesUnlockedUnit)}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground/60">{dict.profile.badgesSubtitle}</p>

          {badgeDisplay.topLocked.length > 0 && (
            <div className="mt-5">
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                {dict.profile.upcomingBadgesHeading}
              </span>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {badgeDisplay.topLocked.map((b) => (
                  <BadgeTile
                    key={b.def.id}
                    icon={b.def.icon}
                    title={b.def.title[lang]}
                    earned={false}
                    lockedLabel={dict.profile.badgesLockedLabel}
                    progressLabel={b.label}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badgeDisplay.sorted.map((b) => (
              <BadgeTile
                key={b.def.id}
                icon={b.def.icon}
                title={b.def.title[lang]}
                description={b.def.description[lang]}
                earned={b.earnedAt !== null}
                earnedOnText={
                  b.earnedAt ? (
                    <>
                      {dict.profile.badgesEarnedOnLabel} <LocalDate iso={b.earnedAt.toISOString()} locale={lang} />
                    </>
                  ) : undefined
                }
                lockedLabel={dict.profile.badgesLockedLabel}
                progressLabel={b.label}
              />
            ))}
          </div>
        </section>
      )}

      {/* Progress */}
      {activeTab === "progress" && (
      <>
      <section className="mt-8">
        {progressState === "zero" ? (
          <FirstStepCards heading={dict.profile.firstStepHeading} items={zeroStepItems} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
                <p className="text-2xl font-semibold tabular-nums">{wordsLearned}</p>
                <p className="text-sm text-foreground/60">
                  {plural(lang, wordsLearned, dict.profile.wordsLearnedLabel)}
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
                <p className="text-2xl font-semibold tabular-nums">{totalLessonsCompleted}</p>
                <p className="text-sm text-foreground/60">
                  {plural(lang, totalLessonsCompleted, dict.profile.lessonsCompleted)}
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
                <p className="text-2xl font-semibold uppercase">
                  {currentLevel ? currentLevel : "—"}
                </p>
                <p className="text-sm text-foreground/60">
                  {currentLevel ? dict.profile.currentLevelLabel : dict.profile.noLevelStarted}
                </p>
                {!currentLevel && (
                  <Button href={`/${lang}/courses/a1`} size="sm" variant="outline" className="mt-3">
                    {dict.profile.startButton}
                  </Button>
                )}
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
                  {streak.currentStreak} {plural(lang, streak.currentStreak, dict.profile.streakDaysUnit)}
                </p>
                <p className="text-sm text-foreground/60">{dict.profile.currentStreakLabel}</p>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
                <p className="text-2xl font-semibold tabular-nums">
                  {streak.longestStreak} {plural(lang, streak.longestStreak, dict.profile.streakDaysUnit)}
                </p>
                <p className="text-sm text-foreground/60">{dict.profile.longestStreakLabel}</p>
              </div>
              {/* The freeze balance is shown unconditionally, including at
                  zero: "you have none left" is the number that changes what
                  the learner does tomorrow. */}
              <div className="rounded-2xl border border-sky-500/20 bg-sky-400/5 p-4">
                <p className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
                  <span aria-hidden>❄️</span>
                  {streak.freezesLeft}
                </p>
                <p className="text-sm text-foreground/60">{dict.profile.streakFreezesLeftLabel}</p>
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

            {/* Only when there IS a chain: the zero case is already spelled
                out by streakNoneNote in the box just above, and printing it
                twice in a row reads as a stutter. On the Overview tab, where
                that box does not exist, the component prints it itself. */}
            {streak.currentStreak > 0 && (
              <StreakExplanation
                currentStreak={streak.currentStreak}
                chainStartedOn={streak.chainStartedOn}
                brokenOn={streak.brokenOn}
                dict={streakExplanationDict}
                className="mt-2"
              />
            )}

            <p className="mt-2 text-sm text-foreground/60">
              {dict.profile.streakFreezeExplainer}
              {freezeSinceNote ? ` ${freezeSinceNote}` : ""}
            </p>

            {progressState === "early" && (
              <div className="mt-8">
                <FirstStepCards heading={dict.profile.whatNextHeading} items={whatsNextItems} />
              </div>
            )}
          </>
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

      {progressState !== "zero" && (
      <section className="mt-8">
        <SectionHeading icon={<ChartIcon className="h-[18px] w-[18px]" />}>
          {dict.profile.progressHeading}
        </SectionHeading>
        {allLevelsZero ? (
          <p className="mt-4 text-sm text-foreground/60">
            {dict.profile.coursesNotStartedNotice}{" "}
            <Link href={`/${lang}/courses/a1`} className="font-medium text-primary-text underline underline-offset-2">
              {dict.profile.coursesNotStartedCta}
            </Link>
          </p>
        ) : (
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
                      {levelProgress.total} {plural(lang, levelProgress.total, dict.profile.lessonsCompleted)}
                    </span>
                  </div>
                  <ProgressBar
                    percent={levelProgress.percent}
                    tone="success"
                    size="md"
                    className="mt-2 w-full"
                    ariaLabel={levelDict.title}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

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
                        className="flex flex-col gap-1 rounded-2xl border border-black/10 p-4 text-sm dark:border-white/30"
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
                          <div className="mt-1 flex flex-col gap-2 border-t border-black/10 pt-2 dark:border-white/30">
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
                className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 text-sm dark:border-white/30"
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
                  <LocalDate iso={attempt.completedAt.toISOString()} locale={lang} />
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
                  <div className="mt-2 flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/30">
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
                className="flex flex-col justify-between gap-4 rounded-2xl border border-black/10 p-5 dark:border-white/30"
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
