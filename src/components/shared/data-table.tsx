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
import { Checkbox } from "@/components/ui/checkbox";
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
  /** Provide both to render a leading checkbox column. Selection spans the whole set the caller
   * holds; the header checkbox selects/clears just the rows currently rendered here. */
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  empty: { icon: LucideIcon; title: string; description?: string; action?: { label: string; onClick: () => void } };
};

// ponytail: TanStack Table only computes row order here (getSortedRowModel) --
// every cell still renders through the column's own `render`, so this stays a
// thin sorting layer instead of a full column-def rewrite. No pagination UI
// yet; add when a page's row count outgrows the API's default page size.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  onRowClick,
  selectedIds,
  onSelectedIdsChange,
  empty,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const selectable = !!selectedIds && !!onSelectedIdsChange;

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

  const renderedIds = sortedRows.map(rowKey);
  const allSelected = selectable && renderedIds.length > 0 && renderedIds.every((id) => selectedIds!.has(id));
  const someSelected = selectable && !allSelected && renderedIds.some((id) => selectedIds!.has(id));

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedIdsChange!(next);
  };
  const toggleAll = (checked: boolean) => {
    const next = new Set(selectedIds);
    for (const id of renderedIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onSelectedIdsChange!(next);
  };

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(checked) => toggleAll(checked)}
                  aria-label="Select all rows"
                />
              </TableHead>
            )}
            {columns.map((col) => {
              const tanstackCol = table.getColumn(col.key);
              const sortDir = tanstackCol?.getIsSorted();
              return (
                <TableHead key={col.key} className={cn(col.numeric && "text-right", col.className)}>
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (sortDir === "asc") tanstackCol?.toggleSorting(true);
                        else if (sortDir === "desc") tanstackCol?.clearSorting();
                        else tanstackCol?.toggleSorting(false);
                      }}
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
                  {selectable && (
                    <TableCell>
                      <Skeleton className="size-4" />
                    </TableCell>
                  )}
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
                  {selectable && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds!.has(rowKey(row))}
                        onCheckedChange={(checked) => toggleOne(rowKey(row), checked)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  )}
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
