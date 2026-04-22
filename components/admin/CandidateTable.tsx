"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import type { ApplicationStatus } from "@/lib/types/database";

export interface CandidateRow {
  id: string;
  candidateName: string;
  candidateEmail: string;
  status: ApplicationStatus;
  fitScore: number | null;
  jobTitle: string;
  createdAt: string;
}

const col = createColumnHelper<CandidateRow>();

const columns = [
  col.accessor("candidateName", {
    header: "Candidate",
    cell: (info) => (
      <div>
        <p className="font-medium text-sm">{info.getValue()}</p>
        <p className="text-xs text-muted-foreground">{info.row.original.candidateEmail}</p>
      </div>
    ),
  }),
  col.accessor("jobTitle", { header: "Role" }),
  col.accessor("fitScore", {
    header: "Fit Score",
    cell: (info) => {
      const score = info.getValue();
      if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
      const color = score >= 75 ? "text-green-600" : score >= 55 ? "text-yellow-600" : "text-red-600";
      return <span className={`font-semibold text-sm ${color}`}>{score}</span>;
    },
  }),
  col.accessor("status", {
    header: "Status",
    cell: (info) => <StatusBadge status={info.getValue()} />,
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
    cell: (info) => (
      <a
        href={`/admin/applications/${info.row.original.id}`}
        className="text-xs text-blue-600 hover:underline"
      >
        View →
      </a>
    ),
  }),
];

interface Props {
  data: CandidateRow[];
}

export function CandidateTable({ data }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Search candidates..."
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer select-none"
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
              <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No candidates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {table.getFilteredRowModel().rows.length} candidate
        {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
