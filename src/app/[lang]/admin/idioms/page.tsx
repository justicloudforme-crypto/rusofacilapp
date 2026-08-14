import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import IdiomAdminApp from "@/components/admin/IdiomAdminApp";

export default async function AdminIdiomsPage({ params }: PageProps<"/[lang]/admin/idioms">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <div>
      <h2 className="font-medium">{dict.admin.idioms.title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{dict.admin.idioms.subtitle}</p>
      <div className="mt-6">
        <IdiomAdminApp dict={dict.admin.idioms} />
      </div>
    </div>
  );
}
