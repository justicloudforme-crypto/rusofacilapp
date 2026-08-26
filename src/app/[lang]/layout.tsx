import type { Metadata, Viewport } from "next";
import { PT_Sans, PT_Serif, PT_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { SerwistProvider } from "@serwist/next/react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../globals.css";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import Footer from "@/components/Footer";
import TelegramFloatButton from "@/components/TelegramFloatButton";
import OfflineBanner from "@/components/OfflineBanner";
import DevServiceWorkerCleanup from "@/components/DevServiceWorkerCleanup";
import NativeBackButtonHandler from "@/components/NativeBackButtonHandler";
import NativeNotifications from "@/components/NativeNotifications";
import SerwistRegister from "@/components/SerwistRegister";
import { getThemePreference } from "@/lib/theme";
import { getCurrentUser } from "@/lib/auth";
import { PaywallProvider } from "@/contexts/PaywallContext";
import type { PlanId } from "@/lib/plans";

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

const THEME_COLORS: Record<string, string> = {
  light: "#2d5f8a",
  dark: "#1b140f",
  reading: "#f6efdc",
};

export async function generateViewport(): Promise<Viewport> {
  const theme = await getThemePreference();
  return {
    // Lets fixed/sticky UI (Navbar, StoryText's sticky audio player) read
    // env(safe-area-inset-*) in globals.css instead of sitting under a
    // notch/home-indicator once this runs standalone (PWA/Capacitor).
    viewportFit: "cover",
    // Matches the browser/OS chrome (status bar, task switcher card) to
    // whichever of the three theme modes the user picked — never inferred
    // from the device's color-scheme setting, same as the page itself.
    themeColor: THEME_COLORS[theme],
  };
}

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
  const theme = await getThemePreference();
  const user = await getCurrentUser();

  const paywallPlans: Record<PlanId, { name: string; price: string; period: string; badge?: string; valueNote?: string }> = {
    monthly: { name: dict.pricing.monthly.name, price: dict.pricing.monthly.price, period: dict.pricing.monthly.period },
    annual: {
      name: dict.pricing.annual.name,
      price: dict.pricing.annual.price,
      period: dict.pricing.annual.period,
      badge: dict.pricing.annual.badge,
    },
    lifetime: {
      name: dict.pricing.lifetime.name,
      price: dict.pricing.lifetime.price,
      period: dict.pricing.lifetime.period,
      badge: dict.pricing.lifetime.badge,
      valueNote: dict.pricing.lifetime.valueNote,
    },
  };

  return (
    <html
      lang={lang}
      data-theme={theme}
      className={`${ptSans.variable} ${ptSerif.variable} ${ptMono.variable} h-full antialiased`}
      // Android WebView/Capacitor is known to inject its own attributes
      // onto <html>/<body> before hydration runs — React then reports a
      // mismatch for attributes it never rendered itself. Confirmed no
      // real mismatch exists in this app's own code (theme comes from a
      // server-read cookie with no client override; safe-area insets are
      // applied through static CSS classes, not inline styles) — this
      // only silences the false-positive warning, it doesn't hide an
      // actual content difference.
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== "production"} register={false}>
          <SerwistRegister />
        </SerwistProvider>
        {process.env.NODE_ENV !== "production" && <DevServiceWorkerCleanup />}
        <NativeBackButtonHandler />
        <NativeNotifications />
        <OfflineBanner message={dict.offline.bannerMessage} />
        <PaywallProvider lang={lang} userId={user?.id ?? null} dict={dict.paywall} plans={paywallPlans}>
          <Navbar lang={lang} dict={dict} />
          {/* pb-20 clears BottomNav's own height (~56px content + its own
              pb-safe inset) below sm so page content never sits under it;
              sm:pb-0 since BottomNav itself is sm:hidden. */}
          <main className="flex flex-1 flex-col pb-20 sm:pb-0">{children}</main>
          <Footer dict={dict} lang={lang} />
        </PaywallProvider>
        <BottomNav lang={lang} dict={dict} isLoggedIn={Boolean(user)} />
        {/* Reading mode is meant to minimize distractions — the floating
            Telegram CTA is the one persistent, animated, non-content element
            on every page, so it's the one thing this mode hides. */}
        {theme !== "reading" && <TelegramFloatButton />}
        {/* Both are no-ops until Web Analytics / Speed Insights are turned
            on for this project in the Vercel dashboard — see
            vercel.com/rusofacilappcom/rusofacilapp → Analytics /
            Speed Insights tabs. Safe to ship ahead of that toggle. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
