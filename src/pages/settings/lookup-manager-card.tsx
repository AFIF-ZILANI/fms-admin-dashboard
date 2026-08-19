import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { useGetData, usePostData, usePatchData, useDelete, type Paginated } from "@/lib/api";
import type { LookupRow } from "@/pages/settings/lookup-types";

/** Mirrors server/src/lib/code-gen.ts's generateCode exactly -- cosmetic
 * preview only, the server always recomputes and validates for real. */
function previewCode(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}

/** Filters keystrokes to letters, digits, and spaces -- keeps what's on
 * screen close to what previewCode will produce. Not the source of truth;
 * the server-side regex/uniqueness check is. */
function filterLabelInput(value: string): string {
  return value.replace(/[^a-zA-Z0-9 ]/g, "");
}

type LookupManagerCardProps = {
  title: string;
  singular: string;
  endpoint: string;
  queryKey: string;
  icon: LucideIcon;
};

export function LookupManagerCard({ title, singular, endpoint, queryKey, icon: Icon }: LookupManagerCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<LookupRow | undefined>(undefined);
  const [label, setLabel] = useState("");

  const { data, isLoading } = useGetData<Paginated<LookupRow>>(`${endpoint}?limit=100`, [queryKey]);
  const rows = data?.results ?? [];

  const create = usePostData<LookupRow, { label: string }>(endpoint, [queryKey]);
  const update = usePatchData<LookupRow, { id: string; label: string }>(
    (vars) => `${endpoint}/${vars.id}`,
    [queryKey]
  );
  const deactivate = usePostData<LookupRow, string>((id) => `${endpoint}/${id}/deactivate`, [queryKey]);
  const reactivate = usePostData<LookupRow, string>((id) => `${endpoint}/${id}/reactivate`, [queryKey]);
  const remove = useDelete<null, string>((id) => `${endpoint}/${id}`, [queryKey]);

  const openCreate = () => {
    setEditingRow(undefined);
    setLabel("");
    setFormOpen(true);
  };
  const openEdit = (row: LookupRow) => {
    setEditingRow(row);
    setLabel(row.label);
    setFormOpen(true);
  };

  const onSubmit = () => {
    if (editingRow) {
      update.mutate(
        { id: editingRow.id, label },
        {
          onSuccess: () => {
            toast.success(`${singular} updated`);
            setFormOpen(false);
          },
          onError: (error) => toast.error(error.message),
        }
      );
    } else {
      create.mutate(
        { label },
        {
          onSuccess: () => {
            toast.success(`${singular} added`);
            setFormOpen(false);
          },
          onError: (error) => toast.error(error.message),
        }
      );
    }
  };

  const toggleActive = (row: LookupRow) => {
    const mutation = row.is_active ? deactivate : reactivate;
    mutation.mutate(row.id, {
      onSuccess: () => toast.success(row.is_active ? "Deactivated" : "Reactivated"),
      onError: (error) => toast.error(error.message),
    });
  };

  const onDelete = (row: LookupRow) => {
    if (!confirm(`Delete "${row.label}"? This can't be undone.`)) return;
    remove.mutate(row.id, {
      onSuccess: () => toast.success(`${singular} deleted`),
      onError: (error) => toast.error(error.message),
    });
  };

  const columns: Column<LookupRow>[] = [
    { key: "label", header: "Label", render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "code", header: "Code", render: (r) => <span className="text-xs text-muted-foreground">{r.code}</span> },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const { tone, label: statusLabel } = activeStatus(r.is_active);
        return <StatusBadge tone={tone} label={statusLabel} />;
      },
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.label}`} onClick={() => openEdit(r)}>
            <Pencil />
          </Button>
          <Button
            variant={r.is_active ? "destructive" : "outline"}
            size="sm"
            onClick={() => toggleActive(r)}
            disabled={
              (deactivate.isPending && deactivate.variables === r.id) ||
              (reactivate.isPending && reactivate.variables === r.id)
            }
          >
            {r.is_active ? "Deactivate" : "Reactivate"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${r.label}`}
            onClick={() => onDelete(r)}
            disabled={remove.isPending && remove.variables === r.id}
          >
            <Trash2 />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4" />
          {title}
        </CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          empty={{ icon: Icon, title: `No ${title.toLowerCase()} yet`, description: "Add your first one." }}
        />
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRow ? `Edit ${singular}` : `Add ${singular}`}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lookup-label">Label</Label>
            <Input
              id="lookup-label"
              value={label}
              onChange={(e) => setLabel(filterLabelInput(e.target.value))}
              autoFocus
            />
            {label.trim() && (
              <p className="text-xs text-muted-foreground">Code: {previewCode(label) || "—"}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={!label.trim() || create.isPending || update.isPending}>
              {editingRow ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
