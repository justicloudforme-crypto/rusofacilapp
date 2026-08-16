import type { Metadata, Viewport } from "next";
import { PT_Sans, PT_Serif, PT_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { SerwistProvider } from "@serwist/next/react";
import "../globals.css";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TelegramFloatButton from "@/components/TelegramFloatButton";
import OfflineBanner from "@/components/OfflineBanner";
import DevServiceWorkerCleanup from "@/components/DevServiceWorkerCleanup";

// RusoFácilapp's "Городецкая роспись" (Gorodets) type system — PT Sans
// (body/UI), PT Serif (display headings/wordmark), PT Mono (labels/status
// text) — all three by ParaType, a Russian type foundry, so Cyrillic and
// Spanish diacritics render with the same care as Latin. See globals.css
// for the matching color tokens.
const ptSans = PT_Sans({
  variable: "--font-pt-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
});

const ptMono = PT_Mono({
  variable: "--font-pt-mono",
  subsets: ["latin", "cyrillic"],
  weight: "400",
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  // Lets fixed/sticky UI (Navbar, StoryText's sticky audio player) read
  // env(safe-area-inset-*) in globals.css instead of sitting under a
  // notch/home-indicator once this runs standalone (PWA/Capacitor).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2d5f8a" },
    { media: "(prefers-color-scheme: dark)", color: "#5b9bd5" },
  ],
};

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "RusoFácilapp",
    },
  };
}

export default async function LangLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <html
      lang={lang}
      className={`${ptSans.variable} ${ptSerif.variable} ${ptMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== "production"} />
        {process.env.NODE_ENV !== "production" && <DevServiceWorkerCleanup />}
        <OfflineBanner message={dict.offline.bannerMessage} />
        <Navbar lang={lang} dict={dict} />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer dict={dict} />
        <TelegramFloatButton />
      </body>
    </html>
  );
}
