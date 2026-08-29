import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { routeAlternates } from "@/lib/site";

// Simple line-icon badges instead of Apple/Google's official artwork —
// this page ships before either store listing is actually live, so a
// literal "Download on the App Store" badge would be both premature and
// (for Apple's mark specifically) against their brand guidelines to
// display before the app is published. These reuse the same
// rounded-full / border treatment as every other button on the site
// (see PlanCard in the pricing page) rather than imitating store chrome.
function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.463 2.1-1.04 2.83-.628.79-1.68 1.39-2.6 1.32-.12-1.1.44-2.24 1.02-2.95.64-.79 1.76-1.36 2.62-1.2ZM20.5 17.06c-.42.98-.62 1.42-1.16 2.29-.75 1.21-1.81 2.72-3.12 2.73-1.17.02-1.47-.76-3.06-.75-1.58.01-1.92.77-3.09.75-1.31-.02-2.31-1.38-3.06-2.58-2.1-3.35-2.32-7.28-1.02-9.38.92-1.49 2.38-2.36 3.75-2.36 1.4 0 2.28.77 3.44.77 1.12 0 1.8-.77 3.44-.77 1.22 0 2.52.66 3.44 1.81-3.02 1.66-2.53 5.98.44 7.49Z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
      <path d="M4.6 2.4c-.4.4-.6.9-.6 1.5v16.2c0 .6.2 1.1.6 1.5l.1.1L14 12 4.7 2.3l-.1.1Z" />
      <path d="M17.1 14.9 14 12l3.1-3-1.16-.79L11.5 12l4.44 3.79 1.16-.9Z" />
      <path d="M17.1 9.1l-3.7 3.1 3.7 3.1 4.6-2.6c.5-.3.8-.75.8-1.3 0-.55-.3-1-.8-1.3l-4.6-2Z" />
    </svg>
  );
}

function StoreBadge({ icon, storeName, status }: { icon: React.ReactNode; storeName: string; status: string }) {
  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-black/10 px-5 py-3.5 text-foreground/50 dark:border-white/30 sm:w-auto">
      {icon}
      <div className="text-left leading-tight">
        <p className="text-xs">{status}</p>
        <p className="text-sm font-semibold text-foreground/70">{storeName}</p>
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/download">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/download") };
}

export default async function DownloadPage({ params }: PageProps<"/[lang]/download">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  if (!dict?.download) notFound();
  const d = dict.download;

  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-foreground/70 dark:border-white/15">
          {d.badge}
        </span>

        <Image
          src="/icons/icon-512.png"
          alt=""
          width={96}
          height={96}
          className="rounded-[22%] shadow-lg shadow-black/10"
        />

        <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {d.pageTitle}
        </h1>
        <p className="max-w-xl text-lg leading-8 text-foreground/70">{d.pageSubtitle}</p>

        <div className="flex flex-col items-center gap-3 pt-4 sm:flex-row">
          <StoreBadge icon={<AppleGlyph />} storeName={d.iosCta} status={d.comingSoonLabel} />
          <StoreBadge icon={<PlayGlyph />} storeName={d.androidCta} status={d.comingSoonLabel} />
        </div>

        <p className="max-w-lg text-sm text-foreground/60">{d.notifyNote}</p>

        <Link
          href={`/${lang}/courses`}
          className="tap mt-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
        >
          {d.webCta}
        </Link>
      </section>

      <section className="border-t border-black/10 dark:border-white/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">{d.featuresTitle}</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {d.features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-black/10 p-6 dark:border-white/30">
                <h3 className="font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground/70">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
