import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Download } from "lucide-react";
import {
  type ColumnDef,
  type SortingState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { useCurrentPageTitle } from "@/components/layout/use-page-title";
import { csvFileName, downloadCsv, nodeText, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
  className?: string;
  /** Provide to make this column's header clickable and sortable (asc -> desc -> none). Omit for columns that shouldn't sort. */
  sortValue?: (row: T) => string | number;
  /** What this column puts in a CSV export. Defaults to the text the cell shows. */
  exportValue?: (row: T) => string | number | null | undefined;
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
  /** Rendered under the table, inside the border -- e.g. "Showing 100 of 340". */
  footer?: ReactNode;
  /** Server-side total when `rows` is only the first page of a capped fetch (limit=100). Adds a
   * "showing N of M" note so a truncated list never passes for the whole set. */
  totalCount?: number;
  /** Set false when the caller pages server-side and renders its own controls. */
  paginate?: boolean;
  /** Adds an "Export CSV" button for the rows held here (all pages, current sort). On by default. */
  exportable?: boolean;
  /** CSV file name stem; defaults to the page title. */
  exportName?: string;
};

/** Action-button columns carry no data worth exporting. */
const isDataColumn = <T,>(col: Column<T>) => col.header !== "" && col.key !== "actions" && col.key !== "action";

const PAGE_SIZES = [10, 20, 50, 100] as const;

// ponytail: TanStack Table only computes row order here (getSortedRowModel) --
// every cell still renders through the column's own `render`, so this stays a
// thin sorting layer instead of a full column-def rewrite. Pagination is
// client-side over the rows the caller holds (sorted first, then sliced);
// server-paged tables pass paginate={false} and bring their own controls.
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  onRowClick,
  selectedIds,
  onSelectedIdsChange,
  empty,
  footer,
  totalCount,
  paginate = true,
  exportable = true,
  exportName,
}: DataTableProps<T>) {
  const pageTitle = useCurrentPageTitle();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[1]);
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

  const allSortedRows = table.getRowModel().rows.map((r) => r.original);
  const paged = paginate && allSortedRows.length > PAGE_SIZES[0];
  const lastPage = Math.max(0, Math.ceil(allSortedRows.length / pageSize) - 1);
  // Clamp rather than reset: a refetch or filter can shrink the set under the current page.
  const safePage = Math.min(page, lastPage);
  const sortedRows = paged ? allSortedRows.slice(safePage * pageSize, (safePage + 1) * pageSize) : allSortedRows;

  const exportCsv = () => {
    const cols = columns.filter(isDataColumn);
    const body = allSortedRows.map((row) =>
      cols.map((col) => (col.exportValue ? col.exportValue(row) : nodeText(col.render(row))) ?? "")
    );
    downloadCsv(csvFileName(exportName ?? pageTitle), toCsv(cols.map((c) => c.header), body));
  };

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
      {totalCount !== undefined && totalCount > rows.length && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Showing the latest {rows.length.toLocaleString()} of {totalCount.toLocaleString()} -- narrow with filters to see the rest.
        </div>
      )}
      {footer && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{footer}</div>
      )}
      {(paged || exportable) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-sm text-muted-foreground">
          <span>
            {paged
              ? `${safePage * pageSize + 1}-${Math.min((safePage + 1) * pageSize, allSortedRows.length)} of ${allSortedRows.length.toLocaleString()}`
              : `${allSortedRows.length.toLocaleString()} ${allSortedRows.length === 1 ? "row" : "rows"}`}
          </span>
          <div className="flex items-center gap-2">
            {paged && (
              <>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
                  <SelectTrigger size="sm" className="w-28" aria-label="Rows per page">
                    <SelectValue>{(v: string) => `${v} / page`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={safePage <= 0} onClick={() => setPage(safePage - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={safePage >= lastPage} onClick={() => setPage(safePage + 1)}>
                  Next
                </Button>
              </>
            )}
            {exportable && (
              <Button variant="ghost" size="sm" disabled={isLoading} onClick={exportCsv}>
                <Download />
                {/* A server-paged table only holds the page on screen. */}
                {paginate ? "Export CSV" : "Export page"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
