import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImageUpload, type UploadedImage } from "@/components/shared/image-upload";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePatchData, usePostData } from "@/lib/api";
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_ROLE_LABELS,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUS_LABELS,
  MARITAL_STATUSES,
  type Employee,
  type EmploymentStatus,
  type MaritalStatus,
} from "@/pages/employees/types";

// Mirrors server/src/validators/employee.validator.ts. Everything docs/employee_hire.md
// marks Mandatory is required; the reference contact is Recommended, so optional.
const employeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(1, "Mobile is required"),
  email: z.string().trim().optional(),
  address: z.string().trim().min(1, "Address is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  marital_status: z.enum(MARITAL_STATUSES, "Select a marital status"),
  nid_number: z.string().trim().min(1, "NID number is required"),

  role: z.enum(EMPLOYEE_ROLES, "Select a role"),
  salary: z.coerce.number().positive("Salary must be positive"),
  joining_date: z.string().min(1, "Joining date is required"),
  employment_status: z.enum(EMPLOYMENT_STATUSES),
  probation_end_date: z.string().optional(),

  education: z.string().trim().min(1, "Educational background is required"),
  experience: z.string().trim().min(1, "Experience is required"),

  emergency_name: z.string().trim().min(1, "Name is required"),
  emergency_relation: z.string().trim().min(1, "Relationship is required"),
  emergency_phone: z.string().trim().min(1, "Phone is required"),

  reference_name: z.string().trim().optional(),
  reference_relation: z.string().trim().optional(),
  reference_phone: z.string().trim().optional(),
});

// z.coerce on salary makes the schema's input type differ from its output type —
// RHF's 3rd generic carries that through (same pattern as ItemFormPage).
type EmployeeFormInput = z.input<typeof employeeSchema>;
type EmployeeFormValues = z.output<typeof employeeSchema>;

function blank(): EmployeeFormInput {
  return {
    name: "",
    mobile: "",
    email: "",
    address: "",
    date_of_birth: "",
    marital_status: undefined as unknown as MaritalStatus,
    nid_number: "",
    role: undefined as unknown as EmployeeFormInput["role"],
    salary: undefined,
    joining_date: new Date().toISOString().slice(0, 10),
    employment_status: "APPOINTED",
    probation_end_date: "",
    education: "",
    experience: "",
    emergency_name: "",
    emergency_relation: "",
    emergency_phone: "",
    reference_name: "",
    reference_relation: "",
    reference_phone: "",
  };
}

function toFormValues(e: Employee): EmployeeFormInput {
  const date = (d: string | null) => (d ? d.slice(0, 10) : "");
  return {
    name: e.profile.name,
    mobile: e.profile.mobile,
    email: e.profile.email ?? "",
    address: e.profile.address ?? "",
    date_of_birth: date(e.date_of_birth),
    marital_status: e.marital_status as MaritalStatus,
    nid_number: e.nid_number ?? "",
    role: e.role,
    salary: e.salary,
    joining_date: date(e.joining_date),
    employment_status: e.employment_status,
    probation_end_date: date(e.probation_end_date),
    education: e.education ?? "",
    experience: e.experience ?? "",
    emergency_name: e.emergency_name ?? "",
    emergency_relation: e.emergency_relation ?? "",
    emergency_phone: e.emergency_phone ?? "",
    reference_name: e.reference_name ?? "",
    reference_relation: e.reference_relation ?? "",
    reference_phone: e.reference_phone ?? "",
  };
}

/** Label + field + error, the shape every field on this page repeats. */
function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  usePageTitle(isEdit ? "Edit employee" : "Hire employee");

  const { data: employee } = useGetData<Employee>(`/employees/${id}`, ["employees", id ?? ""], {
    enabled: isEdit,
  });

  const [photo, setPhoto] = useState<UploadedImage | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormInput, unknown, EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: blank(),
  });

  // Loads the employee into the form once it arrives. Adjusted during render
  // rather than in an effect, per React's "reset state on prop change" pattern —
  // this component doesn't remount between /employees/new and /employees/:id/edit.
  const resetKey = isEdit ? (employee ? employee.id : null) : "__new__";
  const [lastResetKey, setLastResetKey] = useState<string | null>(null);
  if (resetKey && resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    reset(employee ? toFormValues(employee) : blank());
    setPhoto(
      employee?.profile.avatar
        ? {
            public_id: employee.profile.avatar.public_id,
            image_url: employee.profile.avatar.image_url,
          }
        : null
    );
  }

  const employmentStatus = useWatch({ control, name: "employment_status" });

  const createEmployee = usePostData<Employee, object>("/employees", ["employees"]);
  const updateEmployee = usePatchData<Employee, object>(() => `/employees/${id}`, ["employees"]);

  const onSubmit = (values: EmployeeFormValues) => {
    // The photo is mandatory and lives outside RHF, so it's checked here rather
    // than in the resolver.
    if (!photo) {
      setPhotoError("A photo is required.");
      return;
    }
    setPhotoError(null);

    const blankToUndefined = (v: string | undefined) => (v && v.trim() ? v : undefined);
    const payload = {
      ...values,
      email: blankToUndefined(values.email),
      probation_end_date:
        values.employment_status === "PROBATION"
          ? blankToUndefined(values.probation_end_date)
          : undefined,
      reference_name: blankToUndefined(values.reference_name),
      reference_relation: blankToUndefined(values.reference_relation),
      reference_phone: blankToUndefined(values.reference_phone),
      // Only send the photo when it changed — an unchanged edit shouldn't write a new Avatars row.
      ...(photo.public_id !== employee?.profile.avatar?.public_id ? { avatar: photo } : {}),
      // joining_date isn't accepted on update — the server keeps the original.
      ...(isEdit ? { joining_date: undefined } : {}),
    };

    const mutation = isEdit ? updateEmployee : createEmployee;
    mutation.mutate(payload, {
      onSuccess: (saved) => {
        toast.success(isEdit ? "Employee updated" : `${values.name} hired`);
        navigate(`/employees/${saved.id}`);
      },
      onError: (error) => {
        toast.error(error.fieldError("mobile") ?? error.fieldError("salary") ?? error.message);
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/employees")}>
        <ArrowLeft />
        Back to employees
      </Button>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identity</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-5">
              <div className="flex flex-col gap-1.5">
                <ImageUpload
                  value={photo}
                  onChange={(img) => {
                    setPhoto(img);
                    if (img) setPhotoError(null);
                  }}
                  label="Photo"
                  invalid={!!photoError}
                />
                {photoError && <p className="max-w-28 text-xs text-destructive">{photoError}</p>}
              </div>

              <div className="grid flex-1 grid-cols-2 gap-4">
                <Field id="name" label="Name" error={errors.name?.message}>
                  <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
                </Field>
                <Field id="mobile" label="Mobile" error={errors.mobile?.message}>
                  <Input id="mobile" {...register("mobile")} aria-invalid={!!errors.mobile} />
                </Field>
                <Field id="date_of_birth" label="Date of birth" error={errors.date_of_birth?.message}>
                  <Input
                    id="date_of_birth"
                    type="date"
                    {...register("date_of_birth")}
                    aria-invalid={!!errors.date_of_birth}
                  />
                </Field>
                <Field id="marital_status" label="Marital status" error={errors.marital_status?.message}>
                  <Controller
                    control={control}
                    name="marital_status"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger id="marital_status" className="w-full" aria-invalid={!!errors.marital_status}>
                          <SelectValue>
                            {(v: string) =>
                              v ? v.charAt(0) + v.slice(1).toLowerCase() : "Select status"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {MARITAL_STATUSES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m.charAt(0) + m.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field id="nid_number" label="NID number" error={errors.nid_number?.message}>
                  <Input id="nid_number" {...register("nid_number")} aria-invalid={!!errors.nid_number} />
                </Field>
                <Field id="email" label="Email" hint="(optional)">
                  <Input id="email" type="email" {...register("email")} />
                </Field>
                <Field id="address" label="Address" error={errors.address?.message} className="col-span-2">
                  <Input id="address" {...register("address")} aria-invalid={!!errors.address} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employment</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field id="role" label="Role" error={errors.role?.message}>
                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="role" className="w-full" aria-invalid={!!errors.role}>
                        <SelectValue>
                          {(v: string) =>
                            v ? EMPLOYEE_ROLE_LABELS[v as keyof typeof EMPLOYEE_ROLE_LABELS] : "Select role"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYEE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {EMPLOYEE_ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field id="salary" label="Monthly salary" error={errors.salary?.message}>
                <Input
                  id="salary"
                  type="number"
                  step="0.01"
                  {...register("salary")}
                  aria-invalid={!!errors.salary}
                />
              </Field>
              <Field id="joining_date" label="Joining date" error={errors.joining_date?.message}>
                <Input
                  id="joining_date"
                  type="date"
                  disabled={isEdit}
                  {...register("joining_date")}
                  aria-invalid={!!errors.joining_date}
                />
              </Field>
              <Field id="employment_status" label="Status" error={errors.employment_status?.message}>
                <Controller
                  control={control}
                  name="employment_status"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger id="employment_status" className="w-full">
                        <SelectValue>
                          {(v: string) =>
                            v ? EMPLOYMENT_STATUS_LABELS[v as EmploymentStatus] : "Select status"
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {EMPLOYMENT_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              {employmentStatus === "PROBATION" && (
                <Field
                  id="probation_end_date"
                  label="Probation ends"
                  hint="(optional)"
                  className="col-span-2"
                >
                  <Input id="probation_end_date" type="date" {...register("probation_end_date")} />
                </Field>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Background</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4">
              <Field
                id="education"
                label="Educational background"
                hint="highest level completed"
                error={errors.education?.message}
              >
                <Input id="education" {...register("education")} aria-invalid={!!errors.education} />
              </Field>
              <Field
                id="experience"
                label="Experience"
                hint="prior relevant work"
                error={errors.experience?.message}
              >
                <Input id="experience" {...register("experience")} aria-invalid={!!errors.experience} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emergency contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-4">
                <Field id="emergency_name" label="Name" error={errors.emergency_name?.message}>
                  <Input
                    id="emergency_name"
                    {...register("emergency_name")}
                    aria-invalid={!!errors.emergency_name}
                  />
                </Field>
                <Field id="emergency_relation" label="Relationship" error={errors.emergency_relation?.message}>
                  <Input
                    id="emergency_relation"
                    placeholder="father, spouse…"
                    {...register("emergency_relation")}
                    aria-invalid={!!errors.emergency_relation}
                  />
                </Field>
                <Field id="emergency_phone" label="Phone" error={errors.emergency_phone?.message}>
                  <Input
                    id="emergency_phone"
                    {...register("emergency_phone")}
                    aria-invalid={!!errors.emergency_phone}
                  />
                </Field>
              </div>

              <Separator />

              <div>
                <p className="mb-3 text-sm font-medium">
                  Reference
                  <span className="ml-1 font-normal text-muted-foreground">
                    (recommended — a previous employer or a known local person)
                  </span>
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <Field id="reference_name" label="Name">
                    <Input id="reference_name" {...register("reference_name")} />
                  </Field>
                  <Field id="reference_relation" label="Relationship">
                    <Input id="reference_relation" {...register("reference_relation")} />
                  </Field>
                  <Field id="reference_phone" label="Phone">
                    <Input id="reference_phone" {...register("reference_phone")} />
                  </Field>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/employees")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isEdit ? "Save changes" : "Hire employee"}
          </Button>
        </div>
      </form>
    </div>
  );
}
