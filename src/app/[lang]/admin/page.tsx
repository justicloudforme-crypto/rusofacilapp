import { redirect, notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";

export default async function AdminIndexPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  redirect(`/${lang}/admin/lessons`);
}
