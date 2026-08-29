import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { routeAlternates } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/admin") };
}

export default async function AdminIndexPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  redirect(`/${lang}/admin/lessons`);
}
