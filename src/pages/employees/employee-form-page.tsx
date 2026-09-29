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
import { Checkbox } from "@/components/ui/checkbox";
import { NumericInput } from "@/components/utils/NumaricInput";
import { ImageUpload, type UploadedImage } from "@/components/shared/image-upload";
import { PhoneInput } from "@/components/shared/phone-input";
import { toE164, toLocalDigits } from "@/lib/phone";
import { usePageTitle } from "@/components/layout/use-page-title";
import { useGetData, usePatchData, usePostData, type Paginated } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import {
  EDUCATION_LABELS,
  EDUCATION_LEVELS,
  EMPLOYEE_ROLE_LABELS,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUS_LABELS,
  FIXED_WAGE_RATIO,
  MARITAL_STATUSES,
  RELATIONSHIPS,
  RELATIONSHIP_OTHER,
  type EducationLevel,
  type Employee,
  type EmployeeRole,
  type EmployeeRoleConfig,
  type EmploymentStatus,
  type MaritalStatus,
} from "@/pages/employees/types";

// Mirrors server/src/validators/employee.validator.ts. Everything docs/employee_hire.md
// marks Mandatory is required; the reference contact is Recommended, so optional.
// A phone field holds only the local digits — PhoneInput supplies the +880, and
// toE164 puts it back at submit time.
const localPhone = z
  .string()
  .min(9, "Enter a 9-10 digit number")
  .max(10, "Enter a 9-10 digit number");

const employeeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    mobile: localPhone,
    email: z.string().trim().email("Enter a valid email"),
    address: z.string().trim().min(1, "Address is required"),
    date_of_birth: z.string().min(1, "Date of birth is required"),
    marital_status: z.enum(MARITAL_STATUSES, "Select a marital status"),
    nid_number: z.string().trim().min(1, "NID number is required"),

    // Role codes now come from GET /employee-roles, not a fixed enum -- an
    // admin can add roles, so this just checks something was picked.
    role: z.string().min(1, "Select a role"),
    // Opt-in override of the role's standard salary -- see override_salary below.
    reference_salary: z.coerce.number().positive("Reference salary must be positive").optional(),
    override_salary: z.boolean(),
    joining_date: z.string().min(1, "Joining date is required"),
    employment_status: z.enum(EMPLOYMENT_STATUSES),
    probation_end_date: z.string().optional(),

    education: z.enum(EDUCATION_LEVELS, "Select the highest level completed"),
    experience_years: z.coerce.number().int().min(0, "Years can't be negative"),
    experience: z.string().trim().min(1, "Describe the experience"),

    emergency_name: z.string().trim().min(1, "Name is required"),
    emergency_relation: z.string().trim().min(1, "Relationship is required"),
    emergency_phone: localPhone,
    emergency_email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
    emergency_address: z.string().trim().optional(),

    // "employee" vs "outside" is a form-only toggle; the API sees one kind or
    // the other, with the unused kind sent as null.
    reference_kind: z.enum(["NONE", "EMPLOYEE", "OUTSIDE"]),
    reference_employee_id: z.string().optional(),
    reference_name: z.string().trim().optional(),
    reference_phone: z.string().trim().optional(),
    reference_address: z.string().trim().optional(),
  })
  .refine((d) => d.reference_kind !== "EMPLOYEE" || !!d.reference_employee_id, {
    message: "Pick the employee who referred them",
    path: ["reference_employee_id"],
  })
  .refine((d) => d.reference_kind !== "OUTSIDE" || !!d.reference_name?.trim(), {
    message: "Name is required",
    path: ["reference_name"],
  })
  .refine((d) => d.reference_kind !== "OUTSIDE" || (d.reference_phone ?? "").length >= 9, {
    message: "Enter a 9-10 digit number",
    path: ["reference_phone"],
  })
  .refine((d) => !d.override_salary || (d.reference_salary !== undefined && d.reference_salary > 0), {
    message: "Enter the override amount",
    path: ["reference_salary"],
  });

// z.coerce on reference_salary makes the schema's input type differ from its output type —
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
    role: "",
    reference_salary: undefined,
    override_salary: false,
    joining_date: new Date().toISOString().slice(0, 10),
    employment_status: "APPOINTED",
    probation_end_date: "",
    education: undefined as unknown as EducationLevel,
    experience_years: undefined,
    experience: "",
    emergency_name: "",
    emergency_relation: "",
    emergency_phone: "",
    emergency_email: "",
    emergency_address: "",
    reference_kind: "NONE",
    reference_employee_id: "",
    reference_name: "",
    reference_phone: "",
    reference_address: "",
  };
}

function toFormValues(e: Employee): EmployeeFormInput {
  const date = (d: string | null) => (d ? d.slice(0, 10) : "");
  return {
    name: e.profile.name,
    mobile: toLocalDigits(e.profile.mobile),
    email: e.profile.email ?? "",
    address: e.profile.address ?? "",
    date_of_birth: date(e.date_of_birth),
    marital_status: e.marital_status as MaritalStatus,
    nid_number: e.nid_number ?? "",
    role: e.role,
    reference_salary: e.reference_salary ?? undefined,
    override_salary: e.reference_salary !== null,
    joining_date: date(e.joining_date),
    employment_status: e.employment_status,
    probation_end_date: date(e.probation_end_date),
    education: (e.education ?? undefined) as EducationLevel,
    experience_years: e.experience_years ?? undefined,
    experience: e.experience ?? "",
    emergency_name: e.emergency_name ?? "",
    emergency_relation: e.emergency_relation ?? "",
    emergency_phone: toLocalDigits(e.emergency_phone),
    emergency_email: e.emergency_email ?? "",
    emergency_address: e.emergency_address ?? "",
    reference_kind: e.reference_employee_id ? "EMPLOYEE" : e.reference_name ? "OUTSIDE" : "NONE",
    reference_employee_id: e.reference_employee_id ?? "",
    reference_name: e.reference_name ?? "",
    reference_phone: toLocalDigits(e.reference_phone),
    reference_address: e.reference_address ?? "",
  };
}

/** A deactivated role can still be an employee's current one (Finding 2) --
 *  labelled so picking it off the list reads as a fact, not an active choice. */
function roleLabel(r: EmployeeRoleConfig): string {
  return r.is_active ? r.label : `${r.label} (inactive)`;
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
    setValue,
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
  const referenceKind = useWatch({ control, name: "reference_kind" });
  const emergencyRelation = useWatch({ control, name: "emergency_relation" });

  // Roles are configured in Settings now, not a fixed 3. Fetched unfiltered
  // (same endpoint/key as the detail page and Settings card, so the cache is
  // shared) and then filtered to active roles, plus -- on an edit -- whatever
  // role this employee currently holds even if it's since been deactivated.
  // A deactivated role is still a real fact about their pay; hiding it would
  // make the form lie about who they are. New hires only ever see active ones,
  // since employee is undefined until isEdit resolves it.
  const { data: rolesData } = useGetData<Paginated<EmployeeRoleConfig>>(
    "/employee-roles?limit=100",
    ["employee-roles"]
  );
  const allRoles = rolesData?.results ?? [];
  const roles = allRoles.filter((r) => r.is_active || r.code === employee?.role);
  const roleCode = useWatch({ control, name: "role" });
  const selectedRole = roles.find((r) => r.code === roleCode);
  const overrideSalary = useWatch({ control, name: "override_salary" });
  // True only while editing someone who currently has an override -- lets the
  // form warn that unchecking moves their actual pay, not just a form default.
  const hadOverride = isEdit && employee?.reference_salary != null;
  // The appointment letter states the guaranteed wage, so show it as they type R
  // rather than letting them discover it after saving. Off the override, R is
  // the role's standard -- salary isn't something you can drift into by accident.
  const enteredSalary = Number(useWatch({ control, name: "reference_salary" })) || 0;
  const referenceSalary = overrideSalary ? enteredSalary : Number(selectedRole?.reference_salary ?? 0);

  // "Other" isn't stored — it just reveals a free-text box, so the dropdown
  // shows it selected whenever the saved relationship isn't one of the listed ones.
  const relationIsOther =
    !!emergencyRelation && !RELATIONSHIPS.includes(emergencyRelation as (typeof RELATIONSHIPS)[number]);

  // Only active employees can vouch for a new hire, and nobody can refer themselves.
  const { data: colleagues } = useGetData<Paginated<Employee>>("/employees?limit=100", ["employees"]);
  const referenceOptions = (colleagues?.results ?? []).filter(
    (c) => c.profile.is_active && c.id !== id
  );

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
    // reference_salary is destructured out of `rest` too: it's rebuilt below as
    // an explicit override-amount-or-null, never left to the raw form value.
    const { reference_kind, override_salary, reference_salary, ...rest } = values;

    // The unused reference kind is sent as null, not omitted: on an edit, only an
    // explicit null clears what was stored before the switch.
    const reference =
      reference_kind === "EMPLOYEE"
        ? {
            reference_employee_id: values.reference_employee_id,
            reference_name: null,
            reference_phone: null,
            reference_address: null,
          }
        : reference_kind === "OUTSIDE"
          ? {
              reference_employee_id: null,
              reference_name: values.reference_name,
              reference_phone: toE164(values.reference_phone ?? ""),
              reference_address: blankToUndefined(values.reference_address) ?? null,
            }
          : {
              reference_employee_id: null,
              reference_name: null,
              reference_phone: null,
              reference_address: null,
            };

    const payload = {
      ...rest,
      mobile: toE164(values.mobile),
      emergency_phone: toE164(values.emergency_phone),
      emergency_email: blankToUndefined(values.emergency_email),
      emergency_address: blankToUndefined(values.emergency_address),
      // Explicit null when the override is off: the server now accepts null
      // here specifically to mean "clear the override, use the role
      // standard" (reference_salary: z.union([z.null(), positive-number]).optional()
      // in server/src/validators/employee.validator.ts) -- an omitted key
      // would mean "leave unchanged" on an edit, which is not what unchecking
      // the box should do.
      reference_salary: override_salary ? reference_salary : null,
      ...reference,
      // Explicit null, never an omitted key: on a PATCH an omitted key means
      // "leave unchanged", which is how a confirmed employee kept showing the
      // deadline from their probation. The service enforces this too.
      probation_end_date:
        values.employment_status === "PROBATION"
          ? (blankToUndefined(values.probation_end_date) ?? null)
          : null,
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
        toast.error(error.fieldError("mobile") ?? error.fieldError("reference_salary") ?? error.message);
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
                  <Controller
                    control={control}
                    name="mobile"
                    render={({ field }) => (
                      <PhoneInput
                        id="mobile"
                        value={field.value}
                        onChange={field.onChange}
                        invalid={!!errors.mobile}
                      />
                    )}
                  />
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
                <Field id="email" label="Email" error={errors.email?.message}>
                  <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
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
                          {(v: string) => {
                            const r = roles.find((role) => role.code === v);
                            return r ? roleLabel(r) : "Select role";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.code}>
                            {roleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                id="reference_salary"
                label="Reference salary"
                hint="normal-month total"
                error={errors.reference_salary?.message}
              >
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Controller
                      control={control}
                      name="override_salary"
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            // The NumericInput below unmounts without
                            // shouldUnregister, so a value typed (or a stray
                            // "0" from an emptied field) survives in RHF state
                            // and the object-level refine keeps rejecting it
                            // even though the field is gone from the screen.
                            // Clearing it here is what actually lets Save
                            // succeed after unchecking.
                            if (!checked) setValue("reference_salary", undefined, { shouldValidate: true });
                          }}
                        />
                      )}
                    />
                    Override the role&apos;s standard salary
                  </label>
                  {overrideSalary ? (
                    <NumericInput
                      id="reference_salary"
                      allowDecimal
                      decimalPlaces={2}
                      placeholder={selectedRole?.reference_salary ?? "15000"}
                      {...register("reference_salary")}
                      aria-invalid={!!errors.reference_salary}
                    />
                  ) : (
                    <p
                      className={
                        hadOverride ? "text-sm text-warning" : "text-sm text-muted-foreground"
                      }
                    >
                      {selectedRole
                        ? hadOverride
                          ? `Saving will move them onto the role standard: ${formatMoney(selectedRole.reference_salary)} (currently ${formatMoney(employee?.reference_salary ?? 0)})`
                          : `Uses role standard: ${formatMoney(selectedRole.reference_salary)}`
                        : "Pick a role to see its standard salary"}
                    </p>
                  )}
                </div>
                {referenceSalary > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Guaranteed fixed wage {formatMoney(Math.round(referenceSalary * FIXED_WAGE_RATIO))} ·
                    allowance {formatMoney(0)}–{formatMoney(Math.round(referenceSalary * 0.3))}
                  </p>
                )}
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
              <div className="grid grid-cols-[1fr_7rem] gap-4">
                <Field
                  id="education"
                  label="Education"
                  hint="highest level completed"
                  error={errors.education?.message}
                >
                  <Controller
                    control={control}
                    name="education"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger id="education" className="w-full" aria-invalid={!!errors.education}>
                          <SelectValue>
                            {(v: string) => (v ? EDUCATION_LABELS[v as EducationLevel] : "Select level")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {EDUCATION_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {EDUCATION_LABELS[level]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field
                  id="experience_years"
                  label="Experience"
                  hint="years"
                  error={errors.experience_years?.message}
                >
                  <NumericInput
                    id="experience_years"
                    allowZero
                    placeholder="0"
                    {...register("experience_years")}
                    aria-invalid={!!errors.experience_years}
                  />
                </Field>
              </div>
              <Field
                id="experience"
                label="Where and what"
                hint="employer, role, duties"
                error={errors.experience?.message}
              >
                <Input
                  id="experience"
                  placeholder="Layer farm in Gazipur, feeding and cleaning"
                  {...register("experience")}
                  aria-invalid={!!errors.experience}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emergency contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field id="emergency_name" label="Name" error={errors.emergency_name?.message}>
                <Input
                  id="emergency_name"
                  {...register("emergency_name")}
                  aria-invalid={!!errors.emergency_name}
                />
              </Field>
              <Field id="emergency_phone" label="Phone" error={errors.emergency_phone?.message}>
                <Controller
                  control={control}
                  name="emergency_phone"
                  render={({ field }) => (
                    <PhoneInput
                      id="emergency_phone"
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!errors.emergency_phone}
                    />
                  )}
                />
              </Field>

              <Field
                id="emergency_relation"
                label="Relationship"
                error={errors.emergency_relation?.message}
                className={relationIsOther ? "" : "col-span-2"}
              >
                <Controller
                  control={control}
                  name="emergency_relation"
                  render={({ field }) => (
                    <Select
                      value={relationIsOther ? RELATIONSHIP_OTHER : (field.value ?? "")}
                      onValueChange={(v) => field.onChange(v === RELATIONSHIP_OTHER ? " " : v)}
                    >
                      <SelectTrigger
                        id="emergency_relation"
                        className="w-full"
                        aria-invalid={!!errors.emergency_relation}
                      >
                        <SelectValue>{(v: string) => v.trim() || "Select relationship"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                        <SelectItem value={RELATIONSHIP_OTHER}>{RELATIONSHIP_OTHER}…</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              {relationIsOther && (
                <Field id="emergency_relation_other" label="Specify">
                  <Controller
                    control={control}
                    name="emergency_relation"
                    render={({ field }) => (
                      <Input
                        id="emergency_relation_other"
                        autoFocus
                        placeholder="Employer, in-law…"
                        value={field.value?.trim() === "" ? "" : field.value}
                        onChange={(e) => field.onChange(e.target.value || " ")}
                      />
                    )}
                  />
                </Field>
              )}

              <Field id="emergency_email" label="Email" hint="(optional)" error={errors.emergency_email?.message}>
                <Input id="emergency_email" type="email" {...register("emergency_email")} />
              </Field>
              <Field id="emergency_address" label="Address" hint="(optional)">
                <Input id="emergency_address" {...register("emergency_address")} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Reference
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">(optional)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* A reference is one kind or the other, never both — a segmented
                  toggle so the invalid combination can't be entered at all. */}
              <Controller
                control={control}
                name="reference_kind"
                render={({ field }) => (
                  <div className="flex w-fit gap-1 rounded-md bg-muted p-1">
                    {(
                      [
                        ["NONE", "None"],
                        ["EMPLOYEE", "An employee"],
                        ["OUTSIDE", "Someone outside"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => field.onChange(value)}
                        className={`rounded px-3 py-1 text-sm transition-colors ${
                          field.value === value
                            ? "bg-background font-medium shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              />

              {referenceKind === "EMPLOYEE" && (
                <Field
                  id="reference_employee_id"
                  label="Referred by"
                  error={errors.reference_employee_id?.message}
                >
                  <Controller
                    control={control}
                    name="reference_employee_id"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="reference_employee_id"
                          className="w-full"
                          aria-invalid={!!errors.reference_employee_id}
                        >
                          <SelectValue>
                            {(v: string) =>
                              referenceOptions.find((o) => o.id === v)?.profile.name ??
                              "Select an employee"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {referenceOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.profile.name} · {EMPLOYEE_ROLE_LABELS[o.role as EmployeeRole] ?? o.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              )}

              {referenceKind === "OUTSIDE" && (
                <div className="grid grid-cols-2 gap-4">
                  <Field id="reference_name" label="Name" error={errors.reference_name?.message}>
                    <Input
                      id="reference_name"
                      {...register("reference_name")}
                      aria-invalid={!!errors.reference_name}
                    />
                  </Field>
                  <Field id="reference_phone" label="Phone" error={errors.reference_phone?.message}>
                    <Controller
                      control={control}
                      name="reference_phone"
                      render={({ field }) => (
                        <PhoneInput
                          id="reference_phone"
                          value={field.value}
                          onChange={field.onChange}
                          invalid={!!errors.reference_phone}
                        />
                      )}
                    />
                  </Field>
                  <Field id="reference_address" label="Address" hint="(optional)" className="col-span-2">
                    <Input id="reference_address" {...register("reference_address")} />
                  </Field>
                </div>
              )}

              {referenceKind === "NONE" && (
                <p className="text-sm text-muted-foreground">
                  A previous employer or a known local person who can vouch for them.
                </p>
              )}
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
