import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getThemePreference } from "@/lib/theme";
import StyleguideClient from "@/components/styleguide/StyleguideClient";
import { routeAlternates } from "@/lib/site";

// Internal dev tool, not app content — no dictionary/translation needed
// (the typography section deliberately shows RU and ES side by side
// regardless of the URL locale). noindex/nofollow so it never surfaces in
// search even though the route stays reachable at any deployed URL for
// review purposes.
// This was a static `export const metadata` until 28.08.2026; it had to
// become a function because canonical now depends on the route's own
// params, and Next refuses to accept both exports from one file.
// noindex/nofollow and the title are unchanged.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/styleguide">): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: "Style guide — RusoFácilapp (internal)",
    robots: { index: false, follow: false },
    alternates: routeAlternates(lang, "/styleguide"),
  };
}

export default async function StyleguidePage({ params }: PageProps<"/[lang]/styleguide">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Server-read, same as layout.tsx does for the real site theme — avoids
  // a hydration mismatch from trying to detect the current data-theme
  // attribute client-side after mount (that path either flashes or trips
  // the react-hooks/set-state-in-effect lint rule; see Toast.tsx's comment
  // for the same class of problem solved differently).
  const initialTheme = await getThemePreference();

  return <StyleguideClient initialTheme={initialTheme === "dark" ? "dark" : "light"} />;
}
