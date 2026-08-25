import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getStoryCatalog } from "@/lib/stories-catalog";
import { getEntitlementTier, getStoryAccess } from "@/lib/entitlement";
import StoriesCatalog from "@/components/stories/StoriesCatalog";

export default async function StoriesPage({ params }: PageProps<"/[lang]/stories">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.stories) notFound();

  const [rawStories, tier] = await Promise.all([getStoryCatalog(), getEntitlementTier()]);

  // Sorted (stable) accessible-first, locked-at-the-end — a story this
  // visitor can't open at all right now shouldn't crowd out the ones they
  // can, per the access-tier policy's list-ordering rule. `lockReason`
  // drives the card's badge/paywall-on-click (see StoriesCatalog); `null`
  // means fully accessible.
  const stories = rawStories
    .map((story) => ({ ...story, lockReason: getStoryAccess(tier, story).reason }))
    .sort((a, b) => Number(a.lockReason !== null) - Number(b.lockReason !== null));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dict?.stories?.pageTitle}</h1>
      <p className="mt-3 max-w-xl text-foreground/70">{dict?.stories?.pageSubtitle}</p>

      <div className="mt-10">
        <StoriesCatalog lang={lang} stories={stories} dict={dict.stories} />
      </div>
    </div>
  );
}
