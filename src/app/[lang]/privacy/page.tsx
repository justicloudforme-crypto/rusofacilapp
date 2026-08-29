import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { PRIVACY_CONTENT } from "@/lib/legal/content";
import LegalDocumentView from "@/components/legal/LegalDocumentView";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/privacy") };
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <LegalDocumentView doc={PRIVACY_CONTENT[lang]} />;
}
