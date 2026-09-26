import { after } from "next/server";
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
import DevServiceWorkerCleanup from "@/components/DevServiceWorkerCleanup";
import HydrationMarker from "@/components/HydrationMarker";
import NativeBackButtonHandler from "@/components/NativeBackButtonHandler";
import NativeNotifications from "@/components/NativeNotifications";
import SerwistRegister from "@/components/SerwistRegister";
import SentryUser from "@/components/SentryUser";
import NativeShellCookie from "@/components/NativeShellCookie";
import SignedOutCachePurge from "@/components/SignedOutCachePurge";
import OfflineSaveCopy from "@/components/OfflineSaveCopy";
import DownloadsHeal from "@/components/DownloadsHeal";
import { getThemePreference } from "@/lib/theme";
import { getCurrentUserForChrome } from "@/lib/auth";
import { getUserStreakStats, persistFreezeState, type StreakStats } from "@/lib/streaks";
import { getRequestTimeZone } from "@/lib/timezone-server";
import TimeZoneSync from "@/components/TimeZoneSync";
import { PaywallProvider } from "@/contexts/PaywallContext";
import { type PlanId } from "@/lib/plans";
import { getLocalPriceContext } from "@/lib/country-server";
import { basePricesText, marked, priceCopy, withBasePrices } from "@/lib/pricing-display";
import { canBuyInsideShell, isNativeShellRequest } from "@/lib/native-shell";
import { nativeAccessCopy } from "@/lib/native-access-copy";
import NativeStoreIdentity from "@/components/native/NativeStoreIdentity";

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
  // No `alternates` here on purpose. This used to build canonical/hreflang
  // for every route at once from the request's own path (the `x-pathname`
  // header proxy.ts set, read via getRequestPathname). That worked, but it
  // meant this layout's generateMetadata called headers() — and a layout
  // that reads headers() forces every descendant route to render
  // dynamically. Canonical now comes from each route's own params instead
  // (routeAlternates in lib/site.ts); `site.test.ts` asserts the URLs come
  // out identical, and `route-metadata.test.ts` asserts no page route is
  // left without one, since there is no longer a fallback here to cover a
  // route someone forgets.
  //
  // This alone does NOT make the site static: getThemePreference() and
  // getCurrentUser() below are two further cookie reads in this same
  // layout, and both are real product behaviour (server-rendered theme
  // with no flash of the wrong one; the header's logged-in state). See
  // PROGRESS.md's dynamic-render diagnosis for what removing those would
  // cost.
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    // ДОЛГ 83: манифест зависит от локали — испанское описание на русской
    // странице было ровно тем, что человек видел в карточке установки.
    manifest: `/${lang}/manifest.webmanifest`,
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
  // ОТКАЗ ЧТЕНИЯ ЗДЕСЬ СТОИТ ШАПКИ, А НЕ САЙТА — 20.09.2026, заход 7.220.
  // Sentry JAVASCRIPT-NEXTJS-14, 6 событий `BLOCKED: Operation was
  // blocked` на `Layout Server Component (/[lang])`: эта строка роняла
  // ЛЮБУЮ страницу под вошедшим человеком. `getCurrentUserForChrome`
  // отдаёт при отказе `null`, то есть гостя; почему именно здесь это
  // безопасно, а в решении о доступе — нет, написано у неё самой.
  const user = await getCurrentUserForChrome();
  // getUserStreakStats is TTL-cached (60s, see streaks.ts) — calling it
  // here for the header's streak badge doesn't add a real per-request DB
  // cost. null for a logged-out visitor, who never sees the badge anyway.
  // The learner's own midnight, not the server's — see src/lib/timezone.ts.
  const timeZone = await getRequestTimeZone(user?.timezone);
  // Значок серии — украшение шапки, а не её содержимое: 7.220. Отказ
  // чтения обязан стоить значка, а не всей страницы, поэтому здесь своё
  // try/catch, а не общее с чтением человека выше.
  let streak: StreakStats | null = null;
  if (user) {
    try {
      streak = await getUserStreakStats(user.id, timeZone, user);
    } catch (error) {
      console.error("[layout] не удалось прочитать серию дней — шапка рисуется без значка", error);
    }
  }
  // The freeze ledger is derived on read; this only writes the mirror and
  // the epoch back, and only when one of them moved. after() keeps it off
  // the render path — nothing on the page waits for it, and the same page
  // rendered twice still writes at most once (nextFreezeRecord returns null
  // the second time).
  if (user) {
    const userId = user.id;
    const freezeColumns = { streakFreezesLeft: user.streakFreezesLeft, streakFreezesSince: user.streakFreezesSince };
    after(() => persistFreezeState(userId, freezeColumns, timeZone));
  }

  // The paywall modal is the third place a price is shown, and the one
  // where a decision is actually being made — a locked lesson, three plans,
  // a button. It follows the same rule /pricing and the front page follow
  // since 09.09.2026: ONE figure per plan, in the visitor's own currency
  // where there is one to quote, and the peso base price in a single
  // footnote — here, at the foot of the modal, because the modal is the
  // whole surface a reader can see while it is open. In Mexico, in an
  // unlisted or unknown country, and whenever the rate feed stayed silent,
  // `converted` is false and this is the peso copy it always was.
  // ДОЛГ 179. Один-единственный признак оболочки на весь макет: по нему
  // и окно поверх закрытого материала становится замком вместо пейвола,
  // и нижняя панель перестаёт прятаться. Спрошено на СЕРВЕРЕ, чтобы
  // сервер и клиент судили об оболочке одинаково.
  const nativeShell = await isNativeShellRequest();
  // Покупка внутри приложения — заход 7.224. Вопрос задаётся один раз на
  // макет, ровно как признак оболочки выше, и стоит он ноль обращений к
  // базе: ответ целиком в заголовке и куках запроса.
  const nativeCanBuy = nativeShell && (await canBuyInsideShell());

  const localPrice = await getLocalPriceContext();
  const paywallPriceCopy = priceCopy(localPrice, lang, {
    monthly: dict.pricing.monthly.price,
    annual: dict.pricing.annual.price,
    lifetime: dict.pricing.lifetime.price,
    annualPerMonth: dict.pricing.annual.perMonthPrice,
  });

  const paywallPlans: Record<
    PlanId,
    { name: string; price: string; period: string; badge?: string; valueNote?: string }
  > = {
    monthly: {
      name: dict.pricing.monthly.name,
      price: marked(paywallPriceCopy.monthly, paywallPriceCopy),
      period: dict.pricing.monthly.period,
    },
    annual: {
      name: dict.pricing.annual.name,
      price: marked(paywallPriceCopy.annual, paywallPriceCopy),
      period: dict.pricing.annual.period,
      badge: dict.pricing.annual.badge,
    },
    lifetime: {
      name: dict.pricing.lifetime.name,
      price: marked(paywallPriceCopy.lifetime, paywallPriceCopy),
      period: dict.pricing.lifetime.period,
      badge: dict.pricing.lifetime.badge,
      valueNote: dict.pricing.lifetime.valueNote,
    },
  };
  const paywallPriceNote = paywallPriceCopy.converted
    ? withBasePrices(dict.pricing.approxNote, basePricesText(lang))
    : undefined;

  return (
    <html
      lang={lang}
      data-theme={theme}
      // Removed by HydrationMarker the instant hydration finishes (see its
      // own comment) — globals.css uses this to dim/disable plain buttons
      // site-wide until then, instead of gating each one individually.
      data-hydrating="true"
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
      <body
        // Отступ под нижнюю панель стоит ЗДЕСЬ, а не на <main>: конец
        // прокручиваемой области — это конец ДОКУМЕНТА, а <main>
        // кончается в его середине, подвал идёт после него. Замер
        // 13.09.2026 при отступе на <main>: на 360×780 под панелью
        // лежали ШЕСТЬ ссылок подвала из шести, последняя («Политика
        // конфиденциальности», 756..776) — целиком внутри полосы
        // панели 716..780. Величина берётся из общего учёта прижатых
        // слоёв (--pinned-inset-bottom, см. src/lib/pinned-layers.ts);
        // `sm:pb-0` — потому что сама панель `sm:hidden`.
        // `sm:pb-safe`, а не `sm:pb-0`, и `pb-safe` вместо пустоты для
        // вышедшего — долг 180. Панель `sm:hidden` и логгед-аутному не
        // рисуется вовсе, но полоса системных кнопок Android в обоих этих
        // случаях никуда не девается: замер владельца — последние строки
        // обычных страниц срезаны ею.
        // ДОЛГ 192: внутри оболочки панель есть и у гостя, значит отступ
        // под неё нужен и гостю. Условие теперь ровно то же, по которому
        // BottomNav решает рисоваться, — иначе низ последней карточки
        // снова уехал бы под панель, ровно как в долге 161.
        className={`flex min-h-full flex-col ${user || nativeShell ? "pb-pinned sm:pb-safe" : "pb-safe"}`}
        suppressHydrationWarning
      >
        <HydrationMarker />
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== "production"} register={false}>
          <SerwistRegister />
        </SerwistProvider>
        <SentryUser userId={user?.id ?? null} />
        <TimeZoneSync storedTimeZone={user?.timezone ?? null} />
        {process.env.NODE_ENV !== "production" && <DevServiceWorkerCleanup />}
        <NativeBackButtonHandler />
        <NativeNotifications lang={lang} userId={user?.id ?? null} />
        <NativeShellCookie />
        {/* Личные копии страниц вышедшего человека — из кеша воркера
            (заход 7.198, часть 1). Ничего не делает ни на одной странице,
            кроме первой после выхода. */}
        <SignedOutCachePurge />
        {/* Страница кладёт свою копию на телефон сама — заход 7.230,
            строка 309: в оболочке навигацию обслуживает java-посредник
            Capacitor, воркер её не видит и в кеш не кладёт ничего. */}
        <OfflineSaveCopy />
        {/* Скачанное долечивается при заходе с сетью — заход 7.235:
            копия без своих листов стилей не переживала выкат сайта. */}
        <DownloadsHeal />
        {/* Плашка «нет соединения» переехала ВНУТРЬ шапки (долг 180).
            Здесь, первым элементом потока, она стояла ВЫШЕ шапки и
            забирала себе полосу под строкой состояния: в оболочке на
            Android 16 окно рисуется во весь экран, и время с батареей
            оказывались поверх её текста. Резерв под строку состояния в
            этом макете ровно один — `pt-safe` на шапке, — поэтому и
            плашка теперь под ним, а не рядом с ним. */}
        <PaywallProvider
          lang={lang}
          dict={dict.paywall}
          plans={paywallPlans}
          priceNote={paywallPriceNote}
          nativeLock={nativeShell ? nativeAccessCopy(lang).lock : null}
          nativePurchase={
            nativeCanBuy ? { copy: nativeAccessCopy(lang).purchase, userId: user?.id ?? null } : null
          }
        >
          {nativeCanBuy ? <NativeStoreIdentity userId={user?.id ?? null} /> : null}
          <Navbar lang={lang} dict={dict} streak={streak} offlineMessage={dict.offline.bannerMessage} />
          {/* Отступ под BottomNav переехал на <body> (см. комментарий там):
              он обязан стоять в конце ПРОКРУЧИВАЕМОЙ ОБЛАСТИ, а конец
              <main> — это середина документа. Долг 161. */}
          <main className="flex flex-1 flex-col">{children}</main>
          <Footer dict={dict} lang={lang} nativeShell={nativeShell} />
        </PaywallProvider>
        <BottomNav lang={lang} dict={dict} isLoggedIn={Boolean(user)} nativeShell={nativeShell} />
        {/* Reading mode is meant to minimize distractions — the floating
            Telegram CTA is the one persistent, animated, non-content element
            on every page, so it's the one thing this mode hides. */}
        {theme !== "reading" && <TelegramFloatButton label={dict.profile.telegramCta} />}
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
