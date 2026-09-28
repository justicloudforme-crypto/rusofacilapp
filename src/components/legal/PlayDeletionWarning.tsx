import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { ACCOUNT_DELETION_PATH, accountDeletionCopy, PLAY_SUBSCRIPTIONS_URL } from "@/lib/legal/account-deletion";

/**
 * «СНАЧАЛА ОТМЕНИТЕ ПОДПИСКУ В GOOGLE PLAY» — заход 7.242, долг 344.
 *
 * Удаление аккаунта отменяет только подписки сайта (Stripe); подписку
 * Google Play может отменить лишь Google. Строка стоит в форме удаления
 * («Zona de riesgo») и на странице подтверждения.
 *
 *   * `known` — сервер знает, что у ЭТОЙ учётной записи подписка Google
 *     Play продлевается (`hasRenewingStoreSubscription`): строка твёрдая.
 *   * `unknown` — страница подтверждения открыта без входа (ссылка из
 *     письма часто открывается в браузере): строка условная, правдивая для
 *     любого читателя.
 *
 * Без подписки Google у вошедшего не рисуется ничего — решает вызывающий.
 */
export default function PlayDeletionWarning({
  lang,
  certainty,
  href = PLAY_SUBSCRIPTIONS_URL,
}: {
  lang: Locale;
  certainty: "known" | "unknown";
  href?: string;
}) {
  const copy = accountDeletionCopy(lang);
  return (
    <div
      role={certainty === "known" ? "alert" : undefined}
      data-rf-play-deletion-warning={certainty}
      className={`mt-4 rounded-xl px-4 py-3 text-sm ${
        certainty === "known"
          ? "bg-red-500/10 text-red-700 dark:text-red-300"
          : "bg-black/[.04] text-foreground/75 dark:bg-white/[.06]"
      }`}
    >
      <p>{certainty === "known" ? copy.playWarning : copy.playWarningUnknown}</p>
      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-4">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="tap inline-flex min-h-11 items-center font-medium underline underline-offset-2"
        >
          {copy.playLinkLabel}
        </a>
        <Link
          href={`/${lang}${ACCOUNT_DELETION_PATH}`}
          className="tap inline-flex min-h-11 items-center underline underline-offset-2"
        >
          {copy.pageLinkLabel}
        </Link>
      </div>
    </div>
  );
}
