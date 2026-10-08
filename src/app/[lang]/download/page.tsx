import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getPageDictionary } from "@/i18n/page-dictionary";
import { routeAlternates, truncateForMeta } from "@/lib/site";
import { isNativeShellRequest } from "@/lib/native-shell";
import { nativeAccessCopy } from "@/lib/native-access-copy";
import PlayStoreBadge from "@/components/PlayStoreBadge";

// 08.10.2026, заход 7.258: приложение для Android ОПУБЛИКОВАНО в Google
// Play (07.10.2026, сборка 14 / 1.0.13). Самодельные плашки «iPhone /
// Android — Próximamente» и фраза «устанавливать пока нечего» стали
// неправдой у живых посетителей: на эту страницу ведёт «Descargar la app»
// из подвала. Вместо них — официальный бейдж Google Play (`PlayStoreBadge`,
// тот же, что на главной, в ценах и в подвале). Про iPhone страница не
// обещает ничего: ни плашки, ни «скоро», ни даты — только то, что сайт
// работает в браузере.

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/download">): Promise<Metadata> {
  const { lang } = await params;
  const alternates = routeAlternates(lang, "/download");
  // Found by the live audit of 30.08.2026: this page is not in the sitemap,
  // but robots.txt does not disallow it either, so a crawler that follows
  // the footer link reaches a page announcing itself with the HOME PAGE's
  // title and description. Its own title costs one line.
  if (!isLocale(lang)) return { alternates };
  // ДОЛГ 154. Внутри приложения у этой страницы другое содержимое — значит
  // и подпись у неё другая; тот же довод и та же форма, что у страницы цен
  // (долг 179). Веб-подпись не тронута ни знаком: обычный браузер в эту
  // ветку не заходит.
  if (await isNativeShellRequest()) {
    const copy = nativeAccessCopy(lang).download;
    return { title: `${copy.heading} | RusoFácilapp`, description: copy.body, robots: { index: false }, alternates };
  }
  const dict = await getPageDictionary(lang);
  return {
    title: `${dict.download.pageTitle} | RusoFácilapp`,
    description: truncateForMeta(dict.download.pageSubtitle),
    // Индексируется с 08.10.2026 (заход 7.259). С 31.08.2026 здесь стоял
    // `noindex`: страница отвечала «пока нечего ставить», а такой ответ в
    // выдаче зарабатывает клик и разочаровывает. С 07.10.2026 ответ есть —
    // приложение в Google Play, бейдж на странице, — и условие, записанное
    // тогда («убрать в день, когда адрес магазина станет настоящим»),
    // выполнено. Страница в карте сайта; canonical и hreflang — из
    // `routeAlternates`, как у соседей. Ответ ПРИЛОЖЕНИЮ выше остаётся
    // `noindex`: у него другое содержимое, и поисковик его не получает.
    // Сторож — `check:store-seo`.
    alternates,
  };
}

export default async function DownloadPage({ params }: PageProps<"/[lang]/download">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getPageDictionary(lang);
  if (!dict?.download) notFound();
  const d = dict.download;

  /**
   * ДОЛГ 154, заход 7.212: ВИТРИНА ЗНАЕТ, ГДЕ ОНА ОТКРЫТА.
   *
   * Внутри оболочки человеку, который уже в приложении, предлагали
   * установить приложение — двумя плашками «Скоро — iPhone / Android».
   * Apple 2.3.1 называет такое вводящим в заблуждение, Google Play
   * считает уводом из приложения; но главное — это просто неправда для
   * того, кто это читает.
   *
   * Страница не удаляется и молча никуда не переадресовывает (долг 197
   * закрывали ровно от молчаливой переадресации): она отдаёт честный
   * ответ и одну ссылку туда, где есть что делать. Ни цены, ни кнопки
   * покупки, ни ссылки в магазин — за этим следит `check:native-payments`.
   */
  const nativeShell = await isNativeShellRequest();
  if (nativeShell) {
    const copy = nativeAccessCopy(lang).download;
    return (
      <div className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <Image
            src="/icons/icon-512.png"
            alt=""
            width={96}
            height={96}
            className="rounded-[22%] shadow-lg shadow-black/10"
          />
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{copy.heading}</h1>
          <p className="max-w-xl text-lg leading-8 text-foreground/70">{copy.body}</p>
          <Link
            href={`/${lang}/courses`}
            className="tap mt-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {copy.cta}
          </Link>
        </section>
      </div>
    );
  }

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

        <div className="pt-4">
          <PlayStoreBadge lang={lang} nativeShell={nativeShell} placement="download" />
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
