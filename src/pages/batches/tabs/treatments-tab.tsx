import { useState } from "react";
import { Plus, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Batch, Medication } from "@/pages/batches/types";
import { MedicationFormDialog } from "@/pages/batches/tabs/medication-form-dialog";

export function TreatmentsTab({ batch }: { batch: Batch }) {
  const [medicationOpen, setMedicationOpen] = useState(false);

  const { data: medications, isLoading: medicationsLoading } = useGetData<Paginated<Medication>>(
    `/medications?batch_id=${batch.id}&limit=100`,
    ["medications", batch.id],
  );

  const { data: admins } = useGetData<Paginated<{ id: string; profile: { id: string; name: string } }>>(
    "/admins?limit=100",
    ["admins"],
  );
  const { data: doctors } = useGetData<Paginated<{ id: string; profile: { id: string; name: string } }>>(
    "/doctors?limit=100",
    ["doctors"],
  );

  const adminName = (profileId: string) =>
    admins?.results.find((a) => a.profile.id === profileId)?.profile.name ?? "—";
  const doctorName = (doctorId: string | null) =>
    doctorId ? (doctors?.results.find((d) => d.id === doctorId)?.profile.name ?? "—") : "—";

  const medicationColumns: Column<Medication>[] = [
    { key: "date", header: "Date", render: (m) => formatDate(m.date), sortValue: (m) => m.date },
    { key: "medicine", header: "Medicine", render: (m) => m.medicine_name },
    { key: "dosage", header: "Dosage", render: (m) => m.dosage },
    { key: "cause", header: "Cause", render: (m) => m.cause ?? "—" },
    { key: "administered_by", header: "Administered by", render: (m) => adminName(m.administered_by_id) },
    { key: "doctor", header: "Doctor", render: (m) => doctorName(m.doctor_id) },
    { key: "remarks", header: "Remarks", render: (m) => m.remarks ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <SectionHeader title="Medications" description="Treatments given to this batch, and who administered them.">
          <Button size="sm" onClick={() => setMedicationOpen(true)}>
            <Plus />
            Log medication
          </Button>
        </SectionHeader>
        <DataTable
          columns={medicationColumns}
          rows={(medications?.results ?? []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
          rowKey={(m) => m.id}
          isLoading={medicationsLoading}
          empty={{
            icon: Pill,
            title: "No medications logged for this batch",
            description: "Record a treatment to keep the health history complete.",
            action: { label: "Log medication", onClick: () => setMedicationOpen(true) },
          }}
          footer={
            medications && medications.total > medications.results.length
              ? `Showing the latest ${medications.results.length} of ${medications.total} medications.`
              : undefined
          }
        />
      </div>

      <MedicationFormDialog open={medicationOpen} onOpenChange={setMedicationOpen} batch={batch} />
    </div>
  );
}
