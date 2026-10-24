import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
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
import { usePatchData, usePostData } from "@/lib/api";
import type { Doctor } from "@/pages/batches/doctor-types";

const doctorSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().min(6, "Mobile is required"),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  specialty: z.string().trim().optional(),
  position: z.string().trim().optional(),
  institution: z.string().trim().optional(),
  // Comma-separated in the form, an array on the wire.
  degrees: z.string().trim().optional(),
});

type DoctorFormValues = z.infer<typeof doctorSchema>;
type DoctorPayload = Omit<DoctorFormValues, "degrees"> & { degrees?: string[] };

const FIELDS = ["name", "mobile", "email", "address", "specialty", "position", "institution", "degrees"] as const;
const EMPTY: DoctorFormValues = {
  name: "",
  mobile: "",
  email: "",
  address: "",
  specialty: "",
  position: "",
  institution: "",
  degrees: "",
};

type DoctorFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor?: Doctor;
};

export function DoctorFormDialog({ open, onOpenChange, doctor }: DoctorFormDialogProps) {
  const isEdit = Boolean(doctor);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      doctor
        ? {
            name: doctor.profile.name,
            mobile: doctor.profile.mobile,
            email: doctor.profile.email ?? "",
            address: doctor.profile.address ?? "",
            specialty: doctor.specialty ?? "",
            position: doctor.position ?? "",
            institution: doctor.institution ?? "",
            degrees: doctor.degrees.join(", "),
          }
        : EMPTY
    );
  }, [open, doctor, reset]);

  // A local, not `doctor?.id` inside the closure below: the React Compiler memoizes that as `doctor.id`,
  // which throws in add mode (doctor undefined).
  const doctorId = doctor?.id;
  const isActive = doctor?.profile.is_active ?? true;
  const create = usePostData<Doctor, DoctorPayload>("/doctors", ["doctors"]);
  const update = usePatchData<Doctor, DoctorPayload>(`/doctors/${doctorId}`, ["doctors"]);
  const setActive = usePostData<Doctor, boolean>(
    (active) => `/doctors/${doctorId}/${active ? "reactivate" : "deactivate"}`,
    ["doctors"]
  );
  const mutation = isEdit ? update : create;

  const onSubmit = (values: DoctorFormValues) => {
    const payload: DoctorPayload = {
      name: values.name,
      mobile: values.mobile,
      email: values.email || undefined,
      address: values.address || undefined,
      specialty: values.specialty || undefined,
      position: values.position || undefined,
      institution: values.institution || undefined,
      degrees: values.degrees
        ? values.degrees
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean)
        : undefined,
    };
    return mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEdit ? "Doctor updated" : "Doctor added");
        onOpenChange(false);
      },
      onError: (error) => {
        let hadFieldError = false;
        for (const key of FIELDS) {
          const message = error.fieldError(key);
          if (message) {
            setError(key, { message });
            hadFieldError = true;
          }
        }
        if (!hadFieldError) toast.error(error.message);
      },
    });
  };

  const toggleActive = () => {
    const next = !isActive;
    setActive.mutate(next, {
      onSuccess: () => {
        toast.success(next ? "Doctor reactivated" : "Doctor deactivated");
        onOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const field = (key: (typeof FIELDS)[number], label: string, type = "text") => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`doctor-${key}`}>{label}</Label>
      <Input id={`doctor-${key}`} type={type} {...register(key)} aria-invalid={!!errors[key]} />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]?.message}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit doctor" : "Add doctor"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this doctor's details." : "Doctors can be named on medication and vaccination records."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("name", "Name")}
            {field("mobile", "Mobile")}
            {field("specialty", "Specialty (optional)")}
            {field("position", "Position (optional)")}
            {field("institution", "Institution (optional)")}
            {field("degrees", "Degrees (optional, comma-separated)")}
            {field("email", "Email (optional)", "email")}
            {field("address", "Address (optional)")}
          </div>

          <DialogFooter className="sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant={isActive ? "destructive" : "outline"}
                disabled={setActive.isPending}
                onClick={toggleActive}
              >
                {isActive ? "Deactivate" : "Reactivate"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isEdit ? "Save changes" : "Add doctor"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
