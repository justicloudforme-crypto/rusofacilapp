import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getPublicProfileData } from "@/lib/public-profile";
import { getAvatarLabels } from "@/lib/avatarLabels";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/u/[handle]">): Promise<Metadata> {
  const { lang, handle } = await params;
  return { alternates: routeAlternates(lang, `/u/${encodeURIComponent(handle)}`) };
}

export default async function PublicProfilePage({
  params,
}: PageProps<"/[lang]/u/[handle]">) {
  const { lang, handle } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const profile = await getPublicProfileData(handle);
  if (!profile) notFound();

  const avatarLabels = getAvatarLabels(dict);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <div className="flex items-center gap-4">
        <MatryoshkaAvatar id={profile.avatarId} size={64} label={avatarLabels[profile.avatarId]} premium={profile.isPremium} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile.name?.trim() || dict.publicProfile.anonymousName}
          </h1>
          {profile.currentLevel && (
            <p className="text-sm text-foreground/60">
              {profile.currentLevel.toUpperCase()} · {dict.courses.levels[profile.currentLevel].title}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
          <p className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
            {profile.currentStreak > 0 && <span aria-hidden="true">🔥</span>}
            {profile.currentStreak} {dict.profile.streakDaysUnit}
          </p>
          <p className="text-sm text-foreground/60">{dict.profile.currentStreakLabel}</p>
        </div>
        <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
          <p className="text-2xl font-semibold tabular-nums">
            {profile.longestStreak} {dict.profile.streakDaysUnit}
          </p>
          <p className="text-sm text-foreground/60">{dict.profile.longestStreakLabel}</p>
        </div>
        <div className="rounded-2xl border border-black/10 p-4 dark:border-white/30">
          <p className="text-2xl font-semibold tabular-nums">{profile.earnedBadges.length}</p>
          <p className="text-sm text-foreground/60">{dict.publicProfile.badgeCountLabel}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-medium">{dict.publicProfile.badgesHeading}</h2>
        {profile.earnedBadges.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/60">{dict.publicProfile.noBadgesYet}</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {profile.earnedBadges.map(({ def }) => (
              <div
                key={def.id}
                className="flex flex-col items-center gap-2 rounded-2xl border border-black/10 bg-white/60 p-4 text-center dark:border-white/30 dark:bg-white/5"
              >
                <span aria-hidden="true" className="text-3xl">
                  {def.icon}
                </span>
                <span className="text-sm font-medium">{def.title[lang]}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
