"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

export interface NewApplicationRow {
  id: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  createdAt: string;
}

interface Props {
  data: NewApplicationRow[];
  screeningIds: Set<string>;
  onScreenOne: (app: NewApplicationRow) => Promise<void>;
}

const col = createColumnHelper<NewApplicationRow>();

function buildColumns(screeningIds: Set<string>, onScreenOne: (app: NewApplicationRow) => Promise<void>) {
  return [
    col.accessor("candidateName", {
      header: "Candidate",
      cell: (info) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-sm" title={info.getValue()}>
            {info.getValue()}
          </p>
          <p
            className="truncate text-xs text-muted-foreground"
            title={info.row.original.candidateEmail}
          >
            {info.row.original.candidateEmail}
          </p>
        </div>
      ),
    }),
    col.accessor("jobTitle", {
      header: "Role",
      cell: (info) => (
        <span className="block truncate" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor("createdAt", {
      header: "Applied",
      cell: (info) =>
        new Date(info.getValue()).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
    }),
    col.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const app = info.row.original;
        const isScanning = screeningIds.has(app.id);
        return (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onScreenOne(app)}
              disabled={isScanning || screeningIds.size > 0}
              className="min-w-[72px] rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isScanning ? (
                <>
                  <span className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                  Scanning…
                </>
              ) : (
                "Screen"
              )}
            </button>
            <a
              href={`/admin/applications/${app.id}`}
              className="text-xs text-primary hover:underline"
            >
              View →
            </a>
          </div>
        );
      },
    }),
  ];
}

export function NewApplicationsTable({ data, screeningIds, onScreenOne }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = buildColumns(screeningIds, onScreenOne);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-[40%]" />
          <col className="w-[26%]" />
          <col className="w-[14%]" />
          <col className="w-[20%]" />
        </colgroup>
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b bg-muted/50">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer select-none truncate"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`border-b transition-colors ${
                screeningIds.has(row.original.id)
                  ? "bg-primary/5"
                  : "hover:bg-muted/30"
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle truncate">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-8 text-center text-muted-foreground text-sm"
              >
                No new applications.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
