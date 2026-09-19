import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { isOwner } from "@/lib/roles";
import { accessCodeState, listAccessCodes, type AccessCodeState } from "@/lib/access-code";
import { routeAlternates } from "@/lib/site";

/**
 * ЭКРАН ОТЗЫВА КОДОВ ДОСТУПА — ОСТАТОК ДОЛГА 89 (заход 7.216).
 *
 * Строка долга дословно: «Остаток: экрана отзыва в `/admin`
 * по-прежнему нет, и `revokeAccessCode` в библиотеке всё ещё принимает
 * `null` исполнителем — это нужно сценарию [A10]. Чинить экраном в
 * `/admin`, который передаст идентификатор администратора».
 *
 * Таблицу `AccessCode` эта страница НЕ читает: строки приносит
 * `listAccessCodes()` из `src/lib/access-code.ts` — правило 1 сторожа
 * `check:access-code-path` («таблицу кодов читает только этот файл»)
 * действует и на административные экраны.
 *
 * Состояние кода тоже считает библиотека (`accessCodeState`), а не эта
 * страница: пересказ правила «отозван раньше или погашен раньше» своими
 * словами разошёлся бы с настоящим ответом `revokeAccessCode` молча.
 *
 * Кнопка отзыва — только владельцу, как и у подписок: отзыв это
 * действие, которое нельзя отменить, и роль `admin` его не получает.
 */
export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/access-codes">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/admin/access-codes") };
}

const STATE_BADGE_CLASSES: Record<AccessCodeState, string> = {
  open: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  redeemed: "bg-foreground/10 text-foreground/60",
  revoked: "bg-red-500/10 text-red-600 dark:text-red-400",
  expired: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export default async function AdminAccessCodesPage({
  params,
}: PageProps<"/[lang]/admin/access-codes">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const copy = dict.admin.accessCodes;
  const actor = await getCurrentUser();
  const ownerView = Boolean(actor && isOwner(actor.role));

  const rows = await listAccessCodes();
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });
  const stateLabels: Record<AccessCodeState, string> = {
    open: copy.stateOpen,
    redeemed: copy.stateRedeemed,
    revoked: copy.stateRevoked,
    expired: copy.stateExpired,
  };

  return (
    <div>
      <h2 className="font-medium">{copy.title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{copy.subtitle}</p>
      {!ownerView && <p className="mt-3 text-sm text-foreground/60">{copy.readOnlyNotice}</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/30">
              <th className="px-4 py-2">{copy.codeHeader}</th>
              <th className="px-4 py-2">{copy.stateHeader}</th>
              <th className="px-4 py-2">{copy.batchHeader}</th>
              <th className="px-4 py-2">{copy.daysHeader}</th>
              <th className="px-4 py-2">{copy.expiresHeader}</th>
              {ownerView && <th className="px-4 py-2">{copy.actionsHeader}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const state = accessCodeState(row, now);
              return (
                <tr key={row.code} className="border-b border-black/5 last:border-0 dark:border-white/5">
                  <td className="px-4 py-2.5 font-mono">{row.code}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_BADGE_CLASSES[state]}`}>
                      {stateLabels[state]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{row.batch ?? "—"}</td>
                  <td className="px-4 py-2.5">{row.durationDays}</td>
                  <td className="px-4 py-2.5">{row.expiresAt ? dateFormatter.format(row.expiresAt) : "—"}</td>
                  {ownerView && (
                    <td className="px-4 py-2.5">
                      {/* Кнопка стоит только там, где отзыв вообще возможен:
                          погашенный код отозвать нельзя, и это продуктовое
                          правило, а не ограничение экрана. */}
                      {state === "open" || state === "expired" ? (
                        <form action="/api/admin/access-codes/revoke" method="POST">
                          <input type="hidden" name="lang" value={lang} />
                          <input type="hidden" name="code" value={row.code} />
                          <button
                            type="submit"
                            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
                          >
                            {copy.revokeButton}
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-foreground/50">—</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-foreground/60" colSpan={ownerView ? 6 : 5}>
                  {copy.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
