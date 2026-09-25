import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EDUCATION_LABELS, ageFrom, type EducationLevel, type Employee } from "@/pages/employees/types";

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
          <Detail
            label="Education"
            value={
              employee.education
                ? (EDUCATION_LABELS[employee.education as EducationLevel] ?? employee.education)
                : null
            }
          />
          <Detail
            label="Experience"
            value={
              employee.experience_years === null
                ? employee.experience
                : [`${employee.experience_years} yr`, employee.experience]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
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
          <div className="flex flex-col gap-3">
            <Detail
              label="Emergency contact"
              value={contactLine(
                employee.emergency_name,
                employee.emergency_relation,
                employee.emergency_phone
              )}
            />
            {(employee.emergency_email || employee.emergency_address) && (
              <p className="text-xs text-muted-foreground">
                {[employee.emergency_email, employee.emergency_address].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {employee.reference_employee ? (
              <div className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground">Reference</p>
                <Link
                  to={`/employees/${employee.reference_employee.id}`}
                  className="text-sm underline-offset-2 hover:underline"
                >
                  {employee.reference_employee.profile.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Employee · {employee.reference_employee.profile.mobile}
                </p>
              </div>
            ) : (
              <Detail
                label="Reference"
                value={contactLine(
                  employee.reference_name,
                  employee.reference_address,
                  employee.reference_phone
                )}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
