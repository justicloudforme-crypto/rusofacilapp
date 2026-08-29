import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { getGroupPreviewByInviteCode } from "@/lib/groups";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/groups/join">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/groups/join") };
}

export default async function JoinGroupPage({
  params,
  searchParams,
}: PageProps<"/[lang]/groups/join">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const query = await searchParams;
  const code = typeof query.code === "string" ? query.code : "";

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${lang}/login?redirectTo=${encodeURIComponent(`/${lang}/groups/join?code=${code}`)}`);
  }

  const dict = await getDictionary(lang);
  const preview = code ? await getGroupPreviewByInviteCode(code) : null;
  if (!preview) notFound();

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{dict.groups.joinPreviewTitle}</h1>
      <p className="mt-2 text-foreground/70">
        {preview.name} · {preview.memberCount} {dict.groups.membersUnit}
      </p>
      <form action="/api/groups/join" method="POST" className="mt-6">
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="code" value={code} />
        <button
          type="submit"
          className="tap w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
        >
          {dict.groups.joinPreviewButton}
        </button>
      </form>
    </div>
  );
}
