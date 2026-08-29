import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import GlossaryAdminApp from "@/components/admin/GlossaryAdminApp";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/glossary">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/admin/glossary") };
}

export default async function AdminGlossaryPage({ params }: PageProps<"/[lang]/admin/glossary">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <div>
      <h2 className="font-medium">{dict.admin.glossary.title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{dict.admin.glossary.subtitle}</p>
      <div className="mt-6">
        <GlossaryAdminApp dict={dict.admin.glossary} />
      </div>
    </div>
  );
}
