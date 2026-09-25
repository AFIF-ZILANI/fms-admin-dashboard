import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ageFrom, type Employee } from "@/pages/employees/types";

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

/**
 * The hire profile from docs/employee_hire.md. Every field is nullable: rows
 * created before the hire-profile migration have none of it, so this reads
 * as a list of gaps to fill rather than an error state.
 */
export function EmployeeProfileCard({ employee }: { employee: Employee }) {
  const age = ageFrom(employee.date_of_birth);
  const dob = employee.date_of_birth ? new Date(employee.date_of_birth).toLocaleDateString() : null;
  const title = (s: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : null);

  const contactLine = (name: string | null, relation: string | null, phone: string | null) =>
    name ? [name, relation, phone].filter(Boolean).join(" · ") : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Detail label="Date of birth" value={dob && age !== null ? `${dob} (${age})` : dob} />
          <Detail label="Marital status" value={title(employee.marital_status)} />
          <Detail label="NID number" value={employee.nid_number} />
          <Detail label="Address" value={employee.profile.address} />
          <Detail label="Education" value={employee.education} />
          <Detail label="Experience" value={employee.experience} />
          <Detail label="Joined" value={new Date(employee.joining_date).toLocaleDateString()} />
          <Detail
            label="Probation ends"
            value={
              employee.probation_end_date
                ? new Date(employee.probation_end_date).toLocaleDateString()
                : null
            }
          />
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Detail
            label="Emergency contact"
            value={contactLine(
              employee.emergency_name,
              employee.emergency_relation,
              employee.emergency_phone
            )}
          />
          <Detail
            label="Reference"
            value={contactLine(
              employee.reference_name,
              employee.reference_relation,
              employee.reference_phone
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
