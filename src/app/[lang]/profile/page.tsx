import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { isLocale, locales, localeNames, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
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
import { levelSlugs } from "@/lib/courses";
import { getThemePreference, type ThemePreference } from "@/lib/theme";
import { AVATAR_IDS, isAvatarId, DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import ProfileNameForm from "@/components/profile/ProfileNameForm";
import ThemeSwitcher from "@/components/profile/ThemeSwitcher";
import AvatarPicker from "@/components/profile/AvatarPicker";
import ChangePasswordForm from "@/components/profile/ChangePasswordForm";
import DeleteAccountForm from "@/components/profile/DeleteAccountForm";

const PROFILE_TABS = ["personal", "progress", "subscription", "security", "language"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];
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

  const [subscription, subscriptionHistory, progress, lessonResults, examAttempts, wordsLearned, streak, theme] =
    await Promise.all([
      getLatestSubscription(user.id),
      getSubscriptionHistory(user.id),
      getLevelProgress(user.id),
      getLessonProgressDetails(user.id),
      getExamAttempts(user.id),
      db.flashcardProgress.count({ where: { userId: user.id, known: true } }),
      getUserStreakStats(user.id),
      getThemePreference(),
    ]);

  const displayStatus = getDisplayStatus(subscription);
  const isActive = displayStatus === "active" || displayStatus === "trialing";
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
  const avatarLabels = {
    matryoshka_calm: dict.profile.avatarCalm,
    matryoshka_happy: dict.profile.avatarHappy,
    matryoshka_wink: dict.profile.avatarWink,
    matryoshka_surprised: dict.profile.avatarSurprised,
    matryoshka_sleepy: dict.profile.avatarSleepy,
    matryoshka_proud: dict.profile.avatarProud,
    matryoshka_thinking: dict.profile.avatarThinking,
    matryoshka_laughing: dict.profile.avatarLaughing,
  } satisfies Record<(typeof AVATAR_IDS)[number], string>;

  const themeOptions: { id: ThemePreference; label: string; description: string; swatch: string }[] = [
    { id: "light", label: dict.profile.themeLightLabel, description: dict.profile.themeLightDescription, swatch: "#fff8ec" },
    { id: "dark", label: dict.profile.themeDarkLabel, description: dict.profile.themeDarkDescription, swatch: "#1b140f" },
    { id: "reading", label: dict.profile.themeReadingLabel, description: dict.profile.themeReadingDescription, swatch: "#f6efdc" },
  ];

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "personal", label: dict.profile.tabPersonal },
    { id: "progress", label: dict.profile.tabProgress },
    { id: "subscription", label: dict.profile.tabSubscription },
    { id: "security", label: dict.profile.tabSecurity },
    { id: "language", label: dict.profile.tabLanguage },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
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
            className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
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
      {justCanceled && (
        <p className="mt-6 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {dict.profile.canceledNotice}
        </p>
      )}

      {/* Personal data */}
      {activeTab === "personal" && (
        <section className="mt-8 flex flex-col gap-6">
          <div className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
            <div className="flex items-center gap-4">
              <MatryoshkaAvatar id={currentAvatarId} size={56} label={avatarLabels[currentAvatarId]} />
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
            <h2 className="font-medium">{dict.profile.avatarHeading}</h2>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.avatarDescription}</p>
            <div className="mt-4">
              <AvatarPicker initialAvatarId={currentAvatarId} labels={avatarLabels} />
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
            <h2 className="font-medium">{dict.profile.appearanceHeading}</h2>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.appearanceDescription}</p>
            <div className="mt-4">
              <ThemeSwitcher initialTheme={theme} options={themeOptions} />
            </div>
          </div>

          <form action="/api/auth/logout" method="POST">
            <input type="hidden" name="lang" value={lang} />
            <button
              type="submit"
              className="w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] sm:w-auto"
            >
              {dict.auth.logout}
            </button>
          </form>
        </section>
      )}

      {/* Subscription status */}
      {activeTab === "subscription" && (
      <section className="mt-8 rounded-2xl border border-black/10 p-5 dark:border-white/10 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">{dict.profile.subscriptionHeading}</h2>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[displayStatus]}`}
          >
            {statusLabels[displayStatus]}
          </span>
        </div>

        {subscription && (
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-foreground/60">{dict.account.plan}</dt>
            <dd className="capitalize">{subscription.plan}</dd>
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
                className="w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] sm:w-auto"
              >
                {dict.profile.cancelButton}
              </button>
            </form>
          ) : (
            <Link
              href={`/${lang}/pricing`}
              className="w-full rounded-full bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-colors hover:bg-foreground/85 sm:w-auto"
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
                  <span className="capitalize">{row.plan}</span>
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
            <h2 className="font-medium">{dict.profile.changePasswordHeading}</h2>
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
            <h2 className="font-medium">{dict.profile.sessionsHeading}</h2>
            <p className="mt-1 text-sm text-foreground/60">{dict.profile.sessionsDescription}</p>
            <form action="/api/auth/logout-everywhere" method="POST" className="mt-3">
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
              >
                {dict.profile.logoutEverywhereButton}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-red-500/20 p-5 sm:p-6">
            <h2 className="font-medium text-red-600 dark:text-red-400">{dict.profile.deleteAccountHeading}</h2>
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
          <h2 className="font-medium">{dict.profile.languageHeading}</h2>
          <p className="mt-1 text-sm text-foreground/60">{dict.profile.languageDescription}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {locales.map((locale: Locale) => (
              <Link
                key={locale}
                href={`/${locale}/profile?tab=language`}
                aria-current={locale === lang}
                className={`rounded-full px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                  locale === lang
                    ? "bg-foreground text-background"
                    : "border border-black/10 hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
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
          <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <p className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
              {streak.currentStreak > 0 && <span aria-hidden="true">🔥</span>}
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

      <section className="mt-8">
        <h2 className="font-medium">{dict.profile.progressHeading}</h2>
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
        <h2 className="font-medium">{dict.profile.resultsHeading}</h2>
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
        <h2 className="font-medium">{dict.profile.examResultsHeading}</h2>
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
        <h2 className="font-medium">{dict.profile.coursesHeading}</h2>
        {!isActive && (
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
                    isActive ? `/${lang}/courses/${level}` : `/${lang}/pricing`
                  }
                  className={`w-full rounded-full px-4 py-2 text-center text-sm font-medium transition-colors sm:w-fit ${
                    isActive
                      ? "bg-foreground text-background hover:bg-foreground/85"
                      : "border border-black/10 hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
                  }`}
                >
                  {isActive ? ctaLabel : dict.account.seePricing}
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
