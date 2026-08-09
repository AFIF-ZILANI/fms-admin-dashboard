import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePatchData, usePostData } from "@/lib/api";
import { humanizeEnum } from "@/lib/utils";
import { EMPLOYEE_ROLES, type Employee } from "@/pages/employees/types";

const employeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(1, "Mobile is required"),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  role: z.enum(EMPLOYEE_ROLES, "Select a role"),
  salary: z.coerce.number().positive("Salary must be positive"),
  joining_date: z.string().optional(),
});

type EmployeeFormInput = z.input<typeof employeeSchema>;
type EmployeeFormValues = z.output<typeof employeeSchema>;

function blankEmployee(): EmployeeFormInput {
  return {
    name: "",
    mobile: "",
    email: "",
    address: "",
    role: undefined as unknown as EmployeeFormInput["role"],
    salary: undefined,
    joining_date: new Date().toISOString().slice(0, 10),
  };
}

function toFormValues(employee: Employee): EmployeeFormInput {
  return {
    name: employee.profile.name,
    mobile: employee.profile.mobile,
    email: employee.profile.email ?? "",
    address: employee.profile.address ?? "",
    role: employee.role,
    salary: employee.salary,
    joining_date: employee.joining_date.slice(0, 10),
  };
}

type EmployeeFormDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; employee?: Employee };

export function EmployeeFormDialog({ open, onOpenChange, employee }: EmployeeFormDialogProps) {
  const isEdit = !!employee;
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormInput, unknown, EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: blankEmployee(),
  });

  useEffect(() => {
    if (open) reset(employee ? toFormValues(employee) : blankEmployee());
  }, [open, employee, reset]);

  const createEmployee = usePostData<Employee, EmployeeFormValues>("/employees", ["employees"]);
  const updateEmployee = usePatchData<Employee, EmployeeFormValues>(
    () => `/employees/${employee?.id}`,
    ["employees"]
  );

  const onSubmit = (values: EmployeeFormValues) => {
    const payload = {
      ...values,
      email: values.email || undefined,
      address: values.address || undefined,
      // joining_date isn't accepted on update — server keeps the original.
      ...(isEdit ? { joining_date: undefined } : {}),
    };
    const mutation = isEdit ? updateEmployee : createEmployee;
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEdit ? "Employee updated" : "Employee added");
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.fieldError("mobile") ?? error.fieldError("salary") ?? error.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this employee's details." : "Register a new employee."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mobile">Mobile</Label>
              <Input id="mobile" {...register("mobile")} aria-invalid={!!errors.mobile} />
              {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" {...register("email")} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" {...register("address")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="role" className="w-full" aria-invalid={!!errors.role}>
                      <SelectValue>{(v: string) => (v ? humanizeEnum(v) : "Select role")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYEE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {humanizeEnum(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="salary">Salary</Label>
              <Input id="salary" type="number" step="0.01" {...register("salary")} aria-invalid={!!errors.salary} />
              {errors.salary && <p className="text-xs text-destructive">{errors.salary.message}</p>}
            </div>
          </div>
          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="joining_date">Joining date</Label>
              <Input id="joining_date" type="date" {...register("joining_date")} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save changes" : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
