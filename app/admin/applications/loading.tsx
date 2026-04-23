import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/TableSkeleton";

export default function AdminHomeLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <section className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <TableSkeleton columns={4} rows={3} />
      </section>
      <section className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <TableSkeleton columns={6} rows={5} />
      </section>
    </main>
  );
}
