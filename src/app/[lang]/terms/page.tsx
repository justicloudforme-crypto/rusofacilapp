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
  const alternates = routeAlternates(lang, "/terms");
  // Found by the live audit of 30.08.2026: this page is not in the sitemap,
  // but robots.txt does not disallow it either, so a crawler that follows
  // the footer link reaches a page announcing itself with the HOME PAGE's
  // title and description. Its own title costs one line.
  if (!isLocale(lang)) return { alternates };
  return {
    title: `${TERMS_CONTENT[lang].title} | RusoFácilapp`,
    description:
      lang === "ru"
        ? "Условия использования RusoFácilapp: что входит в подписку, как работает оплата и возврат, права на материалы курса и правила пользования сайтом."
        : "Términos de servicio de RusoFácilapp: qué incluye la suscripción, cómo funcionan el pago y el reembolso, y las reglas de uso del curso y del sitio.",
    alternates,
  };
}

export default async function TermsPage({ params }: PageProps<"/[lang]/terms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <LegalDocumentView doc={TERMS_CONTENT[lang]} />;
}
