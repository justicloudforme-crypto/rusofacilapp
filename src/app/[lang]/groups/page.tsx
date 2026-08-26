import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getUserGroups } from "@/lib/groups";

const ERROR_KEYS = {
  empty_name: "groupErrorEmptyName",
  too_many_groups: "groupErrorTooManyGroups",
  invalid_code: "groupErrorInvalidCode",
  not_found: "groupErrorNotFound",
  group_full: "groupErrorFull",
  rate_limited: "groupErrorRateLimited",
} as const;

export default async function GroupsPage({
  params,
  searchParams,
}: PageProps<"/[lang]/groups">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/login?redirectTo=/${lang}/groups`);

  const dict = await getDictionary(lang);
  const query = await searchParams;
  const errorCode = typeof query.error === "string" ? query.error : null;
  const errorKey = errorCode && errorCode in ERROR_KEYS ? ERROR_KEYS[errorCode as keyof typeof ERROR_KEYS] : null;

  const groups = await getUserGroups(user.id);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{dict.groups.pageTitle}</h1>
      <p className="mt-1 text-sm text-foreground/70">{dict.groups.pageSubtitle}</p>

      {errorKey && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {dict.groups[errorKey]}
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-medium">{dict.groups.myGroupsHeading}</h2>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/60">{dict.groups.noGroupsYet}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/${lang}/groups/${group.id}`}
                className="tap flex items-center justify-between gap-3 rounded-2xl border border-black/10 p-4 text-sm transition-colors hover:bg-black/[.03] active:bg-black/[.03] dark:border-white/30 dark:hover:bg-white/[.05] dark:active:bg-white/[.05]"
              >
                <span className="font-medium">{group.name}</span>
                <span className="text-foreground/60">
                  {group.memberCount} {dict.groups.membersUnit}
                  {group.isOwner && ` · ${dict.groups.ownerLabel}`}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-black/10 p-5 dark:border-white/30 sm:p-6">
        <h2 className="font-medium">{dict.groups.createHeading}</h2>
        <p className="mt-1 text-sm text-foreground/60">{dict.groups.createDescription}</p>
        <form action="/api/groups" method="POST" className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="lang" value={lang} />
          <input
            type="text"
            name="name"
            required
            maxLength={60}
            placeholder={dict.groups.namePlaceholder}
            className="w-full rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm outline-none focus:border-primary dark:border-white/15 dark:bg-white/10"
          />
          <button
            type="submit"
            className="tap flex-shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {dict.groups.createButton}
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-black/10 p-5 dark:border-white/30 sm:p-6">
        <h2 className="font-medium">{dict.groups.joinHeading}</h2>
        <p className="mt-1 text-sm text-foreground/60">{dict.groups.joinDescription}</p>
        <form action="/api/groups/join" method="POST" className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="lang" value={lang} />
          <input
            type="text"
            name="code"
            required
            maxLength={7}
            placeholder={dict.groups.codePlaceholder}
            className="w-full rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm uppercase outline-none focus:border-primary dark:border-white/15 dark:bg-white/10"
          />
          <button
            type="submit"
            className="tap flex-shrink-0 rounded-full border border-black/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] active:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
          >
            {dict.groups.joinButton}
          </button>
        </form>
      </section>
    </div>
  );
}
