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
  const alternates = routeAlternates(lang, "/privacy");
  // Found by the live audit of 30.08.2026: this page is not in the sitemap,
  // but robots.txt does not disallow it either, so a crawler that follows
  // the footer link reaches a page announcing itself with the HOME PAGE's
  // title and description. Its own title costs one line.
  if (!isLocale(lang)) return { alternates };
  return {
    title: `${PRIVACY_CONTENT[lang].title} | RusoFácilapp`,
    description:
      lang === "ru"
        ? "Политика конфиденциальности RusoFácilapp: какие данные мы храним, зачем они нужны, кому передаются и как удалить аккаунт вместе со всеми записями."
        : "Política de privacidad de RusoFácilapp: qué datos guardamos, para qué sirven, con quién se comparten y cómo borrar tu cuenta con todos sus registros.",
    alternates,
  };
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <LegalDocumentView doc={PRIVACY_CONTENT[lang]} />;
}
