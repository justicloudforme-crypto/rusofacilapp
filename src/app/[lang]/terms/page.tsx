import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { TERMS_CONTENT } from "@/lib/legal/content";
import LegalDocumentView from "@/components/legal/LegalDocumentView";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/terms">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/terms") };
}

export default async function TermsPage({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <LegalDocumentView doc={TERMS_CONTENT[lang]} />;
}
