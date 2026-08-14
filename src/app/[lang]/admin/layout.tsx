import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireStaffUser } from "@/lib/admin-auth";
import { isOwner } from "@/lib/roles";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const user = await requireStaffUser(lang);
  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{dict.admin.title}</h1>
      <p className="mt-1 text-sm text-foreground/60">
        {user.email} · {dict.admin.roleLabels[user.role as "owner" | "admin"]}
      </p>
      <AdminNav lang={lang} dict={dict.admin} isOwner={isOwner(user.role)} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
