import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";

// /account was superseded by /profile (subscription status + course
// progress + course list in one dashboard). Kept as a redirect so old
// bookmarks/links don't 404.
export default async function AccountRedirectPage({
  params,
  searchParams,
}: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const query = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") search.set(key, value);
  }
  const queryString = search.toString();

  redirect(`/${lang}/profile${queryString ? `?${queryString}` : ""}`);
}
