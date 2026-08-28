import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { ABOUT_CONTENT } from "@/lib/about-content";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList, organizationJsonLd } from "@/lib/site";

const PAGE_PATH = "/sobre-nosotros";

// Both locales, unlike the ES-only sopa-de-letras landing pages — "who runs
// this and what's inside" is a real question in either language, not a
// Spanish-search-intent page. Same both-locale-same-slug pattern as
// /[lang]/terms and /[lang]/privacy.
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/sobre-nosotros">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const content = ABOUT_CONTENT[lang];
  const url = `${SITE_URL}/${lang}${PAGE_PATH}`;
  return {
    title: `${content.title} | RusoFácilapp`,
    description: content.metaDescription,
    alternates: {
      canonical: url,
      languages: {
        es: `${SITE_URL}/es${PAGE_PATH}`,
        ru: `${SITE_URL}/ru${PAGE_PATH}`,
        "x-default": `${SITE_URL}/es${PAGE_PATH}`,
      },
    },
  };
}

export default async function AboutPage({ params }: PageProps<"/[lang]/sobre-nosotros">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const content = ABOUT_CONTENT[lang];

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <JsonLd data={organizationJsonLd(lang)} />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/${lang}` },
          { name: content.title, url: `${SITE_URL}/${lang}${PAGE_PATH}` },
        ])}
      />

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{content.title}</h1>
      <p className="mt-6 text-foreground/80">{content.intro}</p>

      <div className="mt-10 space-y-8">
        {content.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/75">
              {section.paragraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
