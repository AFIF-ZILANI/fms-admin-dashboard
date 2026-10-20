import { useState } from "react";
import { CheckCircle2, Plus, Stethoscope, Syringe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KPICard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { activeStatus } from "@/components/shared/status-tone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, type Paginated } from "@/lib/api";
import type { Doctor } from "@/pages/batches/doctor-types";
import { DoctorFormDialog } from "@/pages/doctors/doctor-form-dialog";

const treatments = (d: Doctor) => d._count.medications + d._count.vaccinations;

export function DoctorsListPage() {
  usePageTitle("Doctors");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | undefined>(undefined);

  // limit=100 (the API max) doubles as "fetch everything": a farm works with a handful of vets.
  const { data, isLoading } = useGetData<Paginated<Doctor>>("/doctors?limit=100", ["doctors"]);
  const doctors = data?.results ?? [];
  const active = doctors.filter((d) => d.profile.is_active).length;
  const totalTreatments = doctors.reduce((sum, d) => sum + treatments(d), 0);

  const open = (doctor?: Doctor) => {
    setEditing(doctor);
    setFormOpen(true);
  };

  const columns: Column<Doctor>[] = [
    {
      key: "name",
      header: "Name",
      render: (d) => <span className="font-medium">{d.profile.name}</span>,
      sortValue: (d) => d.profile.name,
    },
    {
      key: "specialty",
      header: "Specialty",
      render: (d) => d.specialty ?? "—",
    },
    {
      key: "institution",
      header: "Institution",
      render: (d) => d.institution ?? "—",
    },
    {
      key: "degrees",
      header: "Degrees",
      render: (d) => (d.degrees.length ? d.degrees.join(", ") : "—"),
    },
    { key: "mobile", header: "Mobile", render: (d) => d.profile.mobile },
    {
      key: "treatments",
      header: "Treatments",
      render: (d) => treatments(d).toLocaleString(),
      sortValue: treatments,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      render: (d) => {
        const { tone, label } = activeStatus(d.profile.is_active);
        return <StatusBadge tone={tone} label={label} />;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KPICard label="Doctors" value={data?.total ?? doctors.length} icon={Stethoscope} isLoading={isLoading} />
        <KPICard label="Active" value={active} icon={CheckCircle2} isLoading={isLoading} />
        <KPICard label="Treatments recorded" value={totalTreatments} icon={Syringe} isLoading={isLoading} />
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={() => open()}>
          <Plus />
          Add doctor
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={doctors}
        totalCount={data?.total}
        rowKey={(d) => d.id}
        isLoading={isLoading}
        onRowClick={open}
        empty={{
          icon: Stethoscope,
          title: "No doctors yet",
          description: "Add the vets who prescribe medicine and vaccines for your batches.",
          action: { label: "Add doctor", onClick: () => open() },
        }}
      />

      <DoctorFormDialog open={formOpen} onOpenChange={setFormOpen} doctor={editing} />
    </div>
  );
}
