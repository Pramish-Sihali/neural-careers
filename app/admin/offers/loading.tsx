import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/TableSkeleton";

export default function OffersLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <TableSkeleton columns={5} rows={6} />
    </main>
  );
}
