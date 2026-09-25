import { useState } from "react";
import { Plus, Syringe, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionHeader } from "@/components/shared/section-header";
import { useGetData, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Batch, Medication, Vaccination } from "@/pages/batches/types";
import { MedicationFormDialog } from "@/pages/batches/tabs/medication-form-dialog";
import { VaccinationFormDialog } from "@/pages/batches/tabs/vaccination-form-dialog";

export function TreatmentsTab({ batch }: { batch: Batch }) {
  const [medicationOpen, setMedicationOpen] = useState(false);
  const [vaccinationOpen, setVaccinationOpen] = useState(false);

  const { data: medications, isLoading: medicationsLoading } = useGetData<Paginated<Medication>>(
    `/medications?batch_id=${batch.id}&limit=100`,
    ["medications", batch.id],
  );
  const { data: vaccinations, isLoading: vaccinationsLoading } = useGetData<Paginated<Vaccination>>(
    `/vaccinations?batch_id=${batch.id}&limit=100`,
    ["vaccinations", batch.id],
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

  const vaccinationColumns: Column<Vaccination>[] = [
    { key: "date", header: "Date", render: (v) => formatDate(v.date), sortValue: (v) => v.date },
    { key: "vaccine", header: "Vaccine", render: (v) => v.vaccine_name },
    { key: "dosage", header: "Dosage", render: (v) => v.dosage, numeric: true },
    { key: "cause", header: "Cause", render: (v) => v.cause ?? "—" },
    { key: "administered_by", header: "Administered by", render: (v) => adminName(v.administered_by_id) },
    { key: "doctor", header: "Doctor", render: (v) => doctorName(v.doctor_id) },
    { key: "remarks", header: "Remarks", render: (v) => v.remarks ?? "—" },
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

      <div className="flex flex-col gap-3">
        <SectionHeader title="Vaccinations" description="Vaccine schedule as actually delivered in the house.">
          <Button size="sm" onClick={() => setVaccinationOpen(true)}>
            <Plus />
            Log vaccination
          </Button>
        </SectionHeader>
        <DataTable
          columns={vaccinationColumns}
          rows={(vaccinations?.results ?? []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
          rowKey={(v) => v.id}
          isLoading={vaccinationsLoading}
          empty={{
            icon: Syringe,
            title: "No vaccinations logged for this batch",
            description: "Record a dose to keep the vaccination history complete.",
            action: { label: "Log vaccination", onClick: () => setVaccinationOpen(true) },
          }}
          footer={
            vaccinations && vaccinations.total > vaccinations.results.length
              ? `Showing the latest ${vaccinations.results.length} of ${vaccinations.total} vaccinations.`
              : undefined
          }
        />
      </div>

      <MedicationFormDialog open={medicationOpen} onOpenChange={setMedicationOpen} batch={batch} />
      <VaccinationFormDialog open={vaccinationOpen} onOpenChange={setVaccinationOpen} batch={batch} />
    </div>
  );
}
