import Skeleton from "@/components/ui/Skeleton";
import Card from "@/components/ui/Card";

// ДОЛГ 212: у каждого блока заглушки высота названа ЧИСЛОМ (`height`), а
// не только классом Tailwind. Замер 15.09.2026 под медленным 3G: вторая
// таблица стилей приезжает через 3645 мс после подвала, и всё это время
// каждый из 17 блоков занимал 0 px — человек видел подвал и нижнюю
// панель над пустотой. Число уезжает в инлайновый `style`, то есть в сам
// документ, и работает с первого байта. Класс остаётся и обязан говорить
// ТО ЖЕ САМОЕ: h-3=12, h-4=16, h-5=20, h-7=28, h-8=32, h-9=36, h-11=44 —
// расхождение ловит `npm run check:skeleton-height`.
//
// AUDIT.md found no loading state at all on /profile — the page does a
// half-dozen DB reads in one Promise.all before it can render anything.
// This file is picked up automatically by Next.js as the Suspense fallback
// for that async Server Component.
export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <Skeleton variant="text" className="h-8 w-48" height={32} />
      <Skeleton variant="text" className="mt-2 h-4 w-64" height={16} />

      <div className="mt-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rect" className="h-9 w-24 rounded-full" height={36} />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <Card padding="lg">
          <Skeleton variant="text" className="h-5 w-40" height={20} />
          <Skeleton variant="rect" className="mt-4 h-11 w-full rounded-full" height={44} />
        </Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton variant="text" className="h-7 w-12" height={28} />
              <Skeleton variant="text" className="mt-2 h-3 w-20" height={12} />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
