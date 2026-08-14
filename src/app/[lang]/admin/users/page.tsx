import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireOwnerUser } from "@/lib/admin-auth";
import { db } from "@/lib/db";

const ROLE_OPTIONS = ["owner", "admin", "student"] as const;

export default async function AdminUsersPage({
  params,
  searchParams,
}: PageProps<"/[lang]/admin/users">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  // Owner-only: the layout already lets any staff member into /admin, so
  // this page enforces the tighter requirement itself.
  const actor = await requireOwnerUser(lang);

  const dict = await getDictionary(lang);
  const query = await searchParams;
  const hasError = query.error === "last_owner";

  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  const dateFormatter = new Intl.DateTimeFormat(lang, { dateStyle: "medium" });

  return (
    <div>
      <h2 className="font-medium">{dict.admin.users.title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{dict.admin.users.subtitle}</p>

      {hasError && (
        <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {dict.admin.users.lastOwnerNotice}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs font-semibold uppercase tracking-wide text-foreground/50 dark:border-white/10">
              <th className="px-4 py-2">{dict.admin.users.emailHeader}</th>
              <th className="px-4 py-2">{dict.admin.users.createdHeader}</th>
              <th className="px-4 py-2">{dict.admin.users.roleHeader}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-black/5 last:border-0 dark:border-white/5"
              >
                <td className="px-4 py-2.5">
                  {user.email}
                  {user.id === actor.id && (
                    <span className="ml-1.5 text-foreground/40">{dict.admin.users.youLabel}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-foreground/60">
                  {dateFormatter.format(user.createdAt)}
                </td>
                <td colSpan={2} className="px-4 py-2.5">
                  <form
                    action="/api/admin/users/role"
                    method="POST"
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="lang" value={lang} />
                    <input type="hidden" name="userId" value={user.id} />
                    <select
                      name="role"
                      defaultValue={user.role}
                      className="rounded-lg border border-black/15 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-foreground/50 dark:border-white/20"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {dict.admin.roleLabels[role]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
                    >
                      {dict.admin.users.saveButton}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
