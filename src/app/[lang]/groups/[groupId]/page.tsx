import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getGroupForMember } from "@/lib/groups";
import { getAvatarLabels } from "@/lib/avatarLabels";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

export default async function GroupDetailPage({
  params,
}: PageProps<"/[lang]/groups/[groupId]">) {
  const { lang, groupId } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/login?redirectTo=/${lang}/groups/${groupId}`);

  const dict = await getDictionary(lang);
  const group = await getGroupForMember(user.id, groupId);
  if (!group) notFound();

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "rusofacilapp.com";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const inviteLink = `${proto}://${host}/${lang}/groups/join?code=${group.inviteCode}`;

  const avatarLabels = getAvatarLabels(dict);

  const isOwner = group.ownerUserId === user.id;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href={`/${lang}/groups`} className="tap text-sm text-foreground/60 hover:text-foreground active:text-foreground">
        {dict.groups.backLink}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{group.name}</h1>

      <div className="mt-4 rounded-2xl border border-black/10 p-4 text-sm dark:border-white/10">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          {dict.groups.inviteLinkLabel}
        </span>
        <p className="mt-1 break-all font-mono text-foreground/70">{inviteLink}</p>
      </div>

      <section className="mt-8">
        <h2 className="font-medium">{dict.groups.leaderboardHeading}</h2>
        <div className="mt-4 flex flex-col gap-2">
          {group.members.map((member, index) => (
            <div
              key={member.userId}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-sm ${
                member.userId === user.id
                  ? "border-brand/40 bg-brand/5"
                  : "border-black/10 dark:border-white/10"
              }`}
            >
              <span className="w-5 flex-shrink-0 text-center text-xs font-semibold text-foreground/40 tabular-nums">
                {index + 1}
              </span>
              <MatryoshkaAvatar id={member.avatarId} size={36} label={avatarLabels[member.avatarId]} premium={member.isPremium} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {member.name?.trim() || dict.groups.anonymousMemberName}
                  {member.isOwner && ` · ${dict.groups.ownerLabel}`}
                </p>
                <p className="text-xs text-foreground/60">
                  {member.currentLevel ? member.currentLevel.toUpperCase() : dict.profile.noLevelStarted}
                </p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-1 tabular-nums text-foreground/70">
                {member.completedLessons > 0 && <span aria-hidden="true">📚</span>}
                {member.completedLessons}
              </span>
            </div>
          ))}
        </div>
      </section>

      <form action={`/api/groups/${group.id}/leave`} method="POST" className="mt-8">
        <input type="hidden" name="lang" value={lang} />
        <button
          type="submit"
          className="tap rounded-full border border-red-500/20 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/5 active:bg-red-500/5 dark:text-red-400"
        >
          {isOwner ? dict.groups.deleteButton : dict.groups.leaveButton}
        </button>
      </form>
    </div>
  );
}
