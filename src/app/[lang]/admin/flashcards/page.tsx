import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import FlashcardAdminApp from "@/components/admin/FlashcardAdminApp";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/flashcards">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/admin/flashcards") };
}

export default async function AdminFlashcardsPage({ params }: PageProps<"/[lang]/admin/flashcards">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <div>
      <h2 className="font-medium">{dict.admin.flashcards.title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{dict.admin.flashcards.subtitle}</p>
      <div className="mt-6">
        <FlashcardAdminApp dict={dict.admin.flashcards} />
      </div>
    </div>
  );
}
