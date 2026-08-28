import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/dictionaries";
import WhyLearnRussianBlurb from "@/components/word-games/WhyLearnRussianBlurb";
import GameLandingLinks from "@/components/word-games/GameLandingLinks";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, breadcrumbList } from "@/lib/site";

const PAGE_PATH = "/juegos-para-aprender-ruso";

// Hub page linking out to the 3 individual game landing pages + the full
// /word-games catalog — from the backlog noted in PROGRESS.md's
// 2026-08-28 entry. ES-only, same Spanish-search-intent reasoning as the
// 3 pages it links to (no Russian-language equivalent query exists).
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/juegos-para-aprender-ruso">): Promise<Metadata> {
  const { lang } = await params;
  if (lang !== "es") return {};
  const url = `${SITE_URL}/es${PAGE_PATH}`;
  return {
    title: "Juegos para aprender ruso, gratis y sin registro | RusoFácilapp",
    description:
      "Sopa de letras, crucigramas y un juego para reconocer el alfabeto cirílico: practica ruso jugando, directamente en el navegador, sin crear cuenta.",
    alternates: {
      canonical: url,
      languages: { es: url, "x-default": url },
    },
  };
}

const GAMES = [
  {
    href: "/es/sopa-de-letras-ruso",
    title: "Sopa de letras en ruso",
    description: "Encuentra palabras rusas básicas escondidas en la cuadrícula, letra por letra en cirílico.",
  },
  {
    href: "/es/crucigramas-ruso-principiantes",
    title: "Crucigrama de ruso para principiantes",
    description: "Pistas en español, respuestas en cirílico — escribe cada letra en lugar de solo reconocerla.",
  },
  {
    href: "/es/sopa-de-letras-alfabeto-cirilico",
    title: "Sopa de letras del alfabeto cirílico",
    description: "22 palabras elegidas para que aparezcan casi todas las letras del alfabeto ruso al menos una vez.",
  },
];

export default async function JuegosParaAprenderRusoPage({
  params,
}: PageProps<"/[lang]/juegos-para-aprender-ruso">) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const dict = await getDictionary("es");

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Juegos para aprender ruso",
          description: "Índice de juegos de palabras en ruso, gratis y sin registro.",
          url: `${SITE_URL}/es${PAGE_PATH}`,
          isAccessibleForFree: true,
        }}
      />
      <JsonLd
        data={breadcrumbList([
          { name: dict.nav.home, url: `${SITE_URL}/es` },
          { name: "Juegos para aprender ruso", url: `${SITE_URL}/es${PAGE_PATH}` },
        ])}
      />

      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Juegos para aprender ruso</h1>
      <p className="mt-3 text-foreground/70">
        Tres formas de practicar ruso jugando, sin necesidad de crear una cuenta. Cada una se abre
        directamente en el navegador y se puede jugar en el momento.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {GAMES.map((game) => (
          <Link
            key={game.href}
            href={game.href}
            className="tap group flex flex-col gap-1 rounded-2xl border border-black/10 p-5 transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
          >
            <h2 className="font-medium">{game.title}</h2>
            <p className="text-sm leading-6 text-foreground/70">{game.description}</p>
            <span className="mt-2 text-sm font-medium text-foreground/80 group-hover:text-foreground group-active:text-foreground">
              Jugar →
            </span>
          </Link>
        ))}
      </div>

      <WhyLearnRussianBlurb />

      <GameLandingLinks />
    </div>
  );
}
