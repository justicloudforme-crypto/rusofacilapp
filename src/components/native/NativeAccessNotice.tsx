import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { NativeAccessCopy } from "@/lib/native-access-copy";

/**
 * То, что видит человек ВНУТРИ ПРИЛОЖЕНИЯ на месте страницы цен
 * (долг 179).
 *
 * Ни цен, ни способов оплаты, ни кнопки покупки, ни витрины магазина —
 * решение владельца 13.09.2026 для первой подачи. Компонент СЕРВЕРНЫЙ и
 * без единой кнопки с обработчиком: единственная ссылка отсюда ведёт
 * внутрь курса. Нерабочая кнопка — дефект сама по себе (часть 2 захода
 * 7.192), поэтому её здесь нет вовсе, а не «есть, но ничего не делает».
 */
export default function NativeAccessNotice({
  lang,
  copy,
  hasAccess,
}: {
  lang: Locale;
  copy: NativeAccessCopy["notice"];
  /** Право доступа, уже активное у учётной записи (его считает сервер,
   *  `getEntitlementTier`): оплата на сайте, код доступа, сотрудник. */
  hasAccess: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {hasAccess ? copy.activeHeading : copy.heading}
      </h1>
      <p className="mt-3 text-base leading-7 text-foreground/70">
        {hasAccess ? copy.activeBody : copy.body}
      </p>

      {!hasAccess && (
        <>
          <section className="mt-8 rounded-2xl border border-black/10 p-5 dark:border-white/30 sm:p-6">
            <h2 className="font-medium">{copy.openHeading}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-6 text-foreground/70">
              {copy.openItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-4 rounded-2xl border border-black/10 p-5 dark:border-white/30 sm:p-6">
            <h2 className="font-medium">{copy.closedHeading}</h2>
            <p className="mt-3 text-sm leading-6 text-foreground/70">{copy.closedBody}</p>
          </section>
        </>
      )}

      <Link
        href={`/${lang}/courses`}
        className="tap mt-8 inline-flex min-h-11 items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
      >
        {copy.backCta}
      </Link>
    </div>
  );
}
