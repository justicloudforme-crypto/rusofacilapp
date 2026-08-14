import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { isOwner } from "@/lib/roles";
import { getDisplayStatus, type DisplayStatus } from "@/lib/subscription";
import { db } from "@/lib/db";

const STATUS_BADGE_CLASSES: Record<DisplayStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  trialing: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  past_due: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  canceled: "bg-red-500/10 text-red-600 dark:text-red-400",
  expired: "bg-red-500/10 text-red-600 dark:text-red-400",
  none: "bg-foreground/10 text-foreground/60",
};

export default async function AdminSubscriptionsPage({
  params,
}: PageProps<"/[lang]/admin/subscriptions">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const actor = await getCurrentUser();
  const ownerView = Boolean(actor && isOwner(actor.role));

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const statusLabels: Record<DisplayStatus, string> = {
    active: dict.profile.statusActive,
    trialing: dict.profile.statusTrialing,
    past_due: dict.profile.statusPastDue,
    canceled: dict.profile.statusCanceled,
    expired: dict.profile.statusIncompleteExpired,
    none: dict.admin.subscriptions.noSubscription,
  };
  const dateFormatter = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });

  return (
    <div>
      <h2 className="font-medium">{dict.admin.subscriptions.title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{dict.admin.subscriptions.subtitle}</p>
      {!ownerView && (
        <p className="mt-3 text-sm text-foreground/60">{dict.admin.subscriptions.readOnlyNotice}</p>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/10">
              <th className="px-4 py-2">{dict.admin.subscriptions.userHeader}</th>
              <th className="px-4 py-2">{dict.admin.subscriptions.statusHeader}</th>
              <th className="px-4 py-2">{dict.admin.subscriptions.planHeader}</th>
              <th className="px-4 py-2">{dict.admin.subscriptions.expiresHeader}</th>
              {ownerView && <th className="px-4 py-2">{dict.admin.subscriptions.actionsHeader}</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const subscription = user.subscriptions[0] ?? null;
              const status = getDisplayStatus(subscription);
              const active = status === "active" || status === "trialing";
              return (
                <tr
                  key={user.id}
                  className="border-b border-black/5 last:border-0 dark:border-white/5"
                >
                  <td className="px-4 py-2.5">{user.email}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}
                    >
                      {statusLabels[status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 capitalize">{subscription?.plan ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {subscription ? dateFormatter.format(subscription.currentPeriodEnd) : "—"}
                  </td>
                  {ownerView && (
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <form action="/api/admin/subscriptions/grant" method="POST">
                          <input type="hidden" name="lang" value={lang} />
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
                          >
                            {dict.admin.subscriptions.grantButton}
                          </button>
                        </form>
                        {active && (
                          <form action="/api/admin/subscriptions/revoke" method="POST">
                            <input type="hidden" name="lang" value={lang} />
                            <input type="hidden" name="userId" value={user.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
                            >
                              {dict.admin.subscriptions.revokeButton}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
