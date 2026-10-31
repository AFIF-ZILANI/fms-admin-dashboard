import { useState } from "react";
import { Pencil, Plus, Syringe, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NumericInput } from "@/components/utils/NumaricInput";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGetData, usePatchData, usePostData } from "@/lib/api";
import type { VaccineTemplate } from "@/pages/batches/types";
import { useVaccineItems } from "@/pages/batches/use-vaccine-items";

type DraftRow = { key: string; day: string; item_id: string; purpose: string; method: string; note: string };
type EntryBody = { day: number; item_id: string; purpose: string; method?: string; note?: string };
type TemplateBody = { name: string; entries: EntryBody[] };

const blankRow = (): DraftRow => ({ key: crypto.randomUUID(), day: "", item_id: "", purpose: "", method: "", note: "" });

function TemplateDialog({ template, onOpenChange }: { template?: VaccineTemplate; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState(template?.name ?? "");
  const [rows, setRows] = useState<DraftRow[]>(
    template?.entries.map((e) => ({
      key: e.id,
      day: String(e.day),
      item_id: e.item_id,
      purpose: e.purpose,
      method: e.method ?? "",
      note: e.note ?? "",
    })) ?? [blankRow()]
  );
  const vaccines = useVaccineItems();
  const create = usePostData<VaccineTemplate, TemplateBody>("/vaccine-templates", ["vaccine-templates"]);
  const update = usePatchData<VaccineTemplate, TemplateBody>(`/vaccine-templates/${template?.id}`, ["vaccine-templates"]);
  const saving = create.isPending || update.isPending;

  const patch = (key: string, field: keyof DraftRow, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const submit = () => {
    if (!name.trim()) return toast.error("Give the template a name");
    const entries: EntryBody[] = [];
    for (const r of rows) {
      const day = Number(r.day);
      if (!Number.isInteger(day) || day < 1) return toast.error("Every row needs a day of 1 or later");
      if (!r.item_id) return toast.error("Every row needs a vaccine");
      if (!r.purpose.trim()) return toast.error("Every row needs a purpose");
      entries.push({
        day,
        item_id: r.item_id,
        purpose: r.purpose.trim(),
        ...(r.method.trim() && { method: r.method.trim() }),
        ...(r.note.trim() && { note: r.note.trim() }),
      });
    }
    const body = { name: name.trim(), entries };
    const done = {
      onSuccess: () => {
        toast.success(template ? "Template saved" : "Template created");
        onOpenChange(false);
      },
      onError: (error: Error) => toast.error(error.message),
    };
    return template ? update.mutate(body, done) : create.mutate(body, done);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New vaccine template"}</DialogTitle>
          <DialogDescription>
            Which vaccine goes on which batch day. Batches copy these rows when the template is applied, so
            editing it later won't change batches already running.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-name">Name</Label>
          <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Broiler standard" />
        </div>

        <div className="flex flex-col gap-2">
          <div className="hidden grid-cols-[4.5rem_1fr_1fr_8rem_2rem] gap-2 text-xs text-muted-foreground sm:grid">
            <span>Day</span>
            <span>Vaccine</span>
            <span>Purpose</span>
            <span>Method</span>
            <span />
          </div>
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-2 gap-2 sm:grid-cols-[4.5rem_1fr_1fr_8rem_2rem]">
              <NumericInput aria-label="Day" placeholder="Day" value={r.day} onChange={(e) => patch(r.key, "day", e.target.value)} />
              <Select value={r.item_id} onValueChange={(v) => patch(r.key, "item_id", String(v))}>
                <SelectTrigger aria-label="Vaccine" className="w-full">
                  <SelectValue>{(v: string) => vaccines.find((i) => i.id === v)?.name ?? "Select vaccine"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {vaccines.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input aria-label="Purpose" placeholder="e.g. Newcastle + IB" value={r.purpose} onChange={(e) => patch(r.key, "purpose", e.target.value)} />
              <Input aria-label="Method" placeholder="Eye drop" value={r.method} onChange={(e) => patch(r.key, "method", e.target.value)} />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove row"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {vaccines.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No QR-coded vaccine items in the catalog yet — add one from Inventory first.
            </p>
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setRows((rs) => [...rs, blankRow()])}>
            <Plus />
            Add row
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {template ? "Save" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VaccineTemplatesTab() {
  const [editing, setEditing] = useState<VaccineTemplate | "new" | undefined>(undefined);
  const { data, isLoading } = useGetData<VaccineTemplate[]>("/vaccine-templates", ["vaccine-templates"]);
  const setActive = usePatchData<VaccineTemplate, { id: string; is_active: boolean }>(
    (vars) => `/vaccine-templates/${vars.id}`,
    ["vaccine-templates"]
  );

  const columns: Column<VaccineTemplate>[] = [
    { key: "name", header: "Name", render: (t) => t.name, sortValue: (t) => t.name },
    {
      key: "rows",
      header: "Vaccines",
      render: (t) => (t.entries.length ? t.entries.map((e) => `Day ${e.day}`).join(" · ") : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => <StatusBadge tone={t.is_active ? "success" : "neutral"} label={t.is_active ? "Active" : "Archived"} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (t) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
            <Pencil />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setActive.mutate(
                { id: t.id, is_active: !t.is_active },
                { onError: (error) => toast.error(error.message) }
              )
            }
          >
            {t.is_active ? "Archive" : "Restore"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus />
          New template
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        empty={{
          icon: Syringe,
          title: "No vaccine templates yet",
          description: "Build a timeline once, then apply it to every new batch.",
          action: { label: "New template", onClick: () => setEditing("new") },
        }}
      />
      {editing && (
        <TemplateDialog
          template={editing === "new" ? undefined : editing}
          onOpenChange={(open) => !open && setEditing(undefined)}
        />
      )}
    </div>
  );
}
