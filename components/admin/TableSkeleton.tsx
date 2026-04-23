import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 5 }: Props) {
  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-2.5">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b last:border-b-0">
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <Skeleton className="h-4 w-full max-w-[80%]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
