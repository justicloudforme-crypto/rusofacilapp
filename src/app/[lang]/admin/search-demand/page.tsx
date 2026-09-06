import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { routeAlternates } from "@/lib/site";
import { db } from "@/lib/db";
import { summarizeSearchDemand, type SearchDemandRow } from "@/lib/search/demand";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/admin/search-demand">): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: routeAlternates(lang, "/admin/search-demand") };
}

/**
 * Потолок чтения. Сводка считается одним проходом по строкам в памяти, а
 * не группировкой в базе, потому что таблица маленькая и, что важнее,
 * группировка «по строке запроса без учёта регистра» в SQLite для
 * кириллицы не работает (`LOWER` там ASCII-only) — то есть база свела бы
 * «Рассказы» и «рассказы» в две разные строки отчёта. Ограничение
 * названо явно и печатается на странице, чтобы «показано всё» никогда не
 * оказалось молчаливой неправдой.
 */
const MAX_ROWS_READ = 20_000;

export const dynamic = "force-dynamic";

export default async function AdminSearchDemandPage({ params }: PageProps<"/[lang]/admin/search-demand">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const t = dict.admin.searchDemand;

  let rows: SearchDemandRow[] = [];
  let failed = false;
  try {
    rows = await db.searchQuery.findMany({
      select: { query: true, resultCount: true, lang: true, followed: true },
      orderBy: { hourBucket: "desc" },
      take: MAX_ROWS_READ,
    });
  } catch (error) {
    // Та же деградация, что и везде в этом проекте: таблица могла ещё не
    // доехать до боевой базы (её создаёт ensure-schema-sync при сборке).
    // Страница администратора не обязана из-за этого отдавать 500.
    console.error("[admin/search-demand] не удалось прочитать SearchQuery", error);
    failed = true;
  }

  const summary = summarizeSearchDemand(rows);
  const share = (part: number) => (summary.total === 0 ? "—" : `${Math.round((part / summary.total) * 100)}%`);

  return (
    <div>
      <h2 className="font-medium">{t.title}</h2>
      <p className="mt-1 text-sm text-foreground/60">{t.subtitle}</p>

      {failed && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{t.unavailable}</p>}

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t.total, value: String(summary.total) },
          { label: t.distinct, value: String(summary.distinctQueries) },
          { label: t.zeroResult, value: `${summary.zeroResult} · ${share(summary.zeroResult)}` },
          { label: t.followed, value: `${summary.followed} · ${share(summary.followed)}` },
        ].map((cell) => (
          <div key={cell.label} className="rounded-lg border border-black/10 p-3 dark:border-white/20">
            <dt className="text-xs text-foreground/60">{cell.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{cell.value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-8 text-sm font-medium">{t.byLang}</h3>
      <ul className="mt-2 text-sm text-foreground/80">
        {summary.byLang.length === 0 && <li className="text-foreground/50">{t.empty}</li>}
        {summary.byLang.map((row) => (
          <li key={row.lang} className="tabular-nums">
            {row.lang} — {row.total}
          </li>
        ))}
      </ul>

      <h3 className="mt-8 text-sm font-medium">{t.topQueries}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="text-xs text-foreground/60">
            <tr>
              <th className="py-1 pr-3">{t.columnQuery}</th>
              <th className="py-1 pr-3 text-right">{t.columnCount}</th>
              <th className="py-1 pr-3 text-right">{t.columnZero}</th>
              <th className="py-1 text-right">{t.columnFollowed}</th>
            </tr>
          </thead>
          <tbody>
            {summary.topQueries.length === 0 && (
              <tr>
                <td className="py-2 text-foreground/50" colSpan={4}>
                  {t.empty}
                </td>
              </tr>
            )}
            {summary.topQueries.map((row) => (
              <tr key={row.query} className="border-t border-black/5 dark:border-white/10">
                <td className="py-1 pr-3 break-all">{row.query}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{row.total}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{row.zeroResult}</td>
                <td className="py-1 text-right tabular-nums">{row.followed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 text-sm font-medium">{t.topZero}</h3>
      <ul className="mt-2 text-sm text-foreground/80">
        {summary.topZeroResultQueries.length === 0 && <li className="text-foreground/50">{t.empty}</li>}
        {summary.topZeroResultQueries.map((row) => (
          <li key={row.query} className="tabular-nums break-all">
            {row.query} — {row.total}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-foreground/50">{t.privacyNote}</p>
      <p className="mt-1 text-xs text-foreground/50">{t.readCap.replace("{max}", String(MAX_ROWS_READ))}</p>
    </div>
  );
}
