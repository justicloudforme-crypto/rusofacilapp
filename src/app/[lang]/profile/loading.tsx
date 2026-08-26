import Skeleton from "@/components/ui/Skeleton";
import Card from "@/components/ui/Card";

// AUDIT.md found no loading state at all on /profile — the page does a
// half-dozen DB reads in one Promise.all before it can render anything.
// This file is picked up automatically by Next.js as the Suspense fallback
// for that async Server Component.
export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <Skeleton variant="text" className="h-8 w-48" />
      <Skeleton variant="text" className="mt-2 h-4 w-64" />

      <div className="mt-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rect" className="h-9 w-24 rounded-full" />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <Card padding="lg">
          <Skeleton variant="text" className="h-5 w-40" />
          <Skeleton variant="rect" className="mt-4 h-11 w-full rounded-full" />
        </Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <Skeleton variant="text" className="h-7 w-12" />
              <Skeleton variant="text" className="mt-2 h-3 w-20" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
