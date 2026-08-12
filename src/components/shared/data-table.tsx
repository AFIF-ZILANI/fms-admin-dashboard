import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
  className?: string;
  /** Provide to make this column's header clickable and sortable (asc -> desc -> none). Omit for columns that shouldn't sort. */
  sortValue?: (row: T) => string | number;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  empty: { icon: LucideIcon; title: string; description?: string; action?: { label: string; onClick: () => void } };
};

// ponytail: TanStack Table only computes row order here (getSortedRowModel) --
// every cell still renders through the column's own `render`, so this stays a
// thin sorting layer instead of a full column-def rewrite. No pagination UI
// yet; add when a page's row count outgrows the API's default page size.
export function DataTable<T>({ columns, rows, rowKey, isLoading, onRowClick, empty }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const tanstackColumns = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((col) => ({
        id: col.key,
        accessorFn: col.sortValue ?? (() => null),
        enableSorting: col.sortValue !== undefined,
      })),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: rowKey,
  });

  if (!isLoading && rows.length === 0) {
    return <EmptyState {...empty} />;
  }

  const sortedRows = table.getRowModel().rows.map((r) => r.original);

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const tanstackCol = table.getColumn(col.key);
              const sortDir = tanstackCol?.getIsSorted();
              return (
                <TableHead key={col.key} className={cn(col.numeric && "text-right", col.className)}>
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => tanstackCol?.toggleSorting(sortDir === "asc")}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        col.numeric && "flex-row-reverse"
                      )}
                    >
                      {col.header}
                      {sortDir === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : sortDir === "desc" ? (
                        <ArrowDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 text-muted-foreground/50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : sortedRows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn(col.numeric && "text-right tabular-nums", col.className)}>
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
