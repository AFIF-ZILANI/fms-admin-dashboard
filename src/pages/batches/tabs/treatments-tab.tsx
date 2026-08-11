import { useState } from "react";
import { Plus, Syringe, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useGetData, type Paginated } from "@/lib/api";
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

  const medicationColumns: Column<Medication>[] = [
    { key: "date", header: "Date", render: (m) => new Date(m.date).toLocaleDateString() },
    { key: "medicine", header: "Medicine", render: (m) => m.medicine_name },
    { key: "dosage", header: "Dosage", render: (m) => m.dosage },
    { key: "cause", header: "Cause", render: (m) => m.cause ?? "—" },
    { key: "remarks", header: "Remarks", render: (m) => m.remarks ?? "—" },
  ];

  const vaccinationColumns: Column<Vaccination>[] = [
    { key: "date", header: "Date", render: (v) => new Date(v.date).toLocaleDateString() },
    { key: "vaccine", header: "Vaccine", render: (v) => v.vaccine_name },
    { key: "dosage", header: "Dosage", render: (v) => v.dosage, numeric: true },
    { key: "cause", header: "Cause", render: (v) => v.cause ?? "—" },
    { key: "remarks", header: "Remarks", render: (v) => v.remarks ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Medications</CardTitle>
          <Button size="sm" onClick={() => setMedicationOpen(true)}>
            <Plus />
            Log medication
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={medicationColumns}
            rows={medications?.results ?? []}
            rowKey={(m) => m.id}
            isLoading={medicationsLoading}
            empty={{ icon: Pill, title: "No medications logged for this batch" }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vaccinations</CardTitle>
          <Button size="sm" onClick={() => setVaccinationOpen(true)}>
            <Plus />
            Log vaccination
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={vaccinationColumns}
            rows={vaccinations?.results ?? []}
            rowKey={(v) => v.id}
            isLoading={vaccinationsLoading}
            empty={{ icon: Syringe, title: "No vaccinations logged for this batch" }}
          />
        </CardContent>
      </Card>

      <MedicationFormDialog open={medicationOpen} onOpenChange={setMedicationOpen} batch={batch} />
      <VaccinationFormDialog open={vaccinationOpen} onOpenChange={setVaccinationOpen} batch={batch} />
    </div>
  );
}
