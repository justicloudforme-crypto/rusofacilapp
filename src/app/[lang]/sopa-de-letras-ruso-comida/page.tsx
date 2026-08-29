import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TopicLandingPage from "@/components/word-games/TopicLandingPage";
import { getTopicLanding, landingPath } from "@/lib/word-games/topic-landings";
import { SITE_URL } from "@/lib/site";

// One of the six themed sopa-de-letras landings. All content — prose,
// title, description — lives in TOPIC_LANDINGS; this file only binds the
// route to its entry. ES-only, same reasoning as the other game landings:
// the page answers a Spanish search intent ("sopa de letras de comida en
// ruso") that has no Russian-language equivalent, so /ru 404s rather than
// serving the same Spanish text at a second URL.
const LANDING = getTopicLanding("comida")!;

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/sopa-de-letras-ruso-comida">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${landingPath(LANDING)}`;
  return {
    title: LANDING.metaTitle,
    description: LANDING.metaDescription,
    alternates: { canonical: url, languages: { es: url, "x-default": url } },
  };
}

export default async function Page({
  params,
}: PageProps<"/[lang]/sopa-de-letras-ruso-comida">) {
  const { lang } = await params;
  if (lang !== "es") notFound();
  return <TopicLandingPage landing={LANDING} />;
}
