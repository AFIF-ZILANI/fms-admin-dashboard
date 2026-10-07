import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PhoneInput } from "@/components/shared/phone-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { ApiError, apiFetch } from "@/lib/api";
import { ME_KEY, useAuth } from "@/lib/auth-context";
import { toE164, toLocalDigits } from "@/lib/phone";
import { formatDate, humanizeEnum } from "@/lib/utils";

type Account = {
  id: string;
  name: string;
  email: string | null;
  mobile: string;
  address: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  password_changed_at: string | null;
  admin_since: string | null;
};

const ACCOUNT_KEY = ["auth", "account"];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

function ago(value: string | null) {
  if (!value) return "Never";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  return days < 60 ? `${days} days ago` : formatDate(value);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export function AccountSection() {
  const { data: account, isLoading } = useQuery<Account, ApiError>({
    queryKey: ACCOUNT_KEY,
    queryFn: () => apiFetch<Account>("/auth/account"),
  });

  if (isLoading || !account) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <IdentityCard account={account} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <ProfileCard account={account} />
          <PasswordCard changedAt={account.password_changed_at} />
        </div>
        <div className="flex flex-col gap-6">
          <DetailsCard account={account} />
          <SessionCard />
        </div>
      </div>
      <DangerZone />
    </div>
  );
}

function IdentityCard({ account }: { account: Account }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
          {initials(account.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold tracking-tight">{account.name}</h3>
          <p className="truncate text-sm text-muted-foreground">{account.email ?? "No email on file"}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge tone="info" label={humanizeEnum(account.role)} />
          <StatusBadge tone={account.is_active ? "success" : "neutral"} label={account.is_active ? "Active" : "Inactive"} />
        </div>
      </CardContent>
    </Card>
  );
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  mobile: z.string().trim().regex(/^\d{7,12}$/, "Enter a valid mobile number"),
  address: z.string().trim().max(300, "Keep it under 300 characters"),
});
type ProfileValues = z.infer<typeof profileSchema>;

function ProfileCard({ account }: { account: Account }) {
  const queryClient = useQueryClient();
  const values: ProfileValues = {
    name: account.name,
    mobile: toLocalDigits(account.mobile),
    address: account.address ?? "",
  };
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: values });

  // Re-sync when the server copy changes (after a save).
  useEffect(() => reset(values), [account.name, account.mobile, account.address]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (v: ProfileValues) => {
    try {
      const saved = await apiFetch<Account>("/auth/account", {
        method: "PATCH",
        body: JSON.stringify({ name: v.name, mobile: toE164(v.mobile), address: v.address }),
      });
      queryClient.setQueryData(ACCOUNT_KEY, saved);
      void queryClient.invalidateQueries({ queryKey: ME_KEY }); // the header shows the name
      toast.success("Profile saved");
    } catch (e) {
      if (e instanceof ApiError) {
        const field = (["name", "mobile", "address"] as const).find((f) => e.fieldError(f));
        if (field) return setError(field, { message: e.fieldError(field)! });
        return setError("root", { message: e.message });
      }
      setError("root", { message: "Could not reach the server." });
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear across the dashboard and in the audit log.</CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc_name">Full name</Label>
            <Input id="acc_name" {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc_email">Email</Label>
            <Input id="acc_email" value={account.email ?? ""} disabled readOnly />
            <p className="text-xs text-muted-foreground">This is your sign-in. Another admin can change it.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc_mobile">Mobile</Label>
            <PhoneInput
              id="acc_mobile"
              value={watch("mobile")}
              onChange={(d) => setValue("mobile", d, { shouldDirty: true, shouldValidate: true })}
              invalid={!!errors.mobile}
            />
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc_address">Address</Label>
            <Input id="acc_address" {...register("address")} aria-invalid={!!errors.address} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>
          {errors.root && <p className="text-sm text-destructive sm:col-span-2">{errors.root.message}</p>}
        </CardContent>
        <CardFooter className="mt-4 justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" disabled={!isDirty || isSubmitting} onClick={() => reset(values)}>
            Discard
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z.string().min(8, "At least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordCard({ changedAt }: { changedAt: string | null }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (v: PasswordValues) => {
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: v.current_password, new_password: v.new_password }),
      });
      reset();
      void queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY });
      toast.success("Password changed. Other devices were signed out.");
    } catch (e) {
      setError("root", { message: e instanceof ApiError ? (e.fieldError("new_password") ?? e.message) : "Could not reach the server." });
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Last changed {ago(changedAt).toLowerCase()}. Changing it signs you out on every other device.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc_current">Current password</Label>
            <Input id="acc_current" type="password" autoComplete="current-password" {...register("current_password")} aria-invalid={!!errors.current_password} />
            {errors.current_password && <p className="text-xs text-destructive">{errors.current_password.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc_new">New password</Label>
            <Input id="acc_new" type="password" autoComplete="new-password" {...register("new_password")} aria-invalid={!!errors.new_password} />
            {errors.new_password && <p className="text-xs text-destructive">{errors.new_password.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc_confirm">Confirm new password</Label>
            <Input id="acc_confirm" type="password" autoComplete="new-password" {...register("confirm")} aria-invalid={!!errors.confirm} />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
          </div>
          {errors.root && <p className="text-sm text-destructive sm:col-span-3">{errors.root.message}</p>}
        </CardContent>
        <CardFooter className="mt-4 justify-end border-t pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function DetailsCard({ account }: { account: Account }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          <Row label="Role">{humanizeEnum(account.role)}</Row>
          <Row label="Status">{account.is_active ? "Active" : "Inactive"}</Row>
          <Row label="Member since">{formatDate(account.created_at)}</Row>
          {account.admin_since && <Row label="Admin since">{formatDate(account.admin_since)}</Row>}
          <Row label="Password changed">{ago(account.password_changed_at)}</Row>
        </dl>
      </CardContent>
    </Card>
  );
}

function SessionCard() {
  const { logout } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session</CardTitle>
        <CardDescription>Sign out of this browser.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full" onClick={() => void logout()}>
          <LogOut className="size-4" /> Log out
        </Button>
      </CardContent>
    </Card>
  );
}

function DangerZone() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPassword("");
      setError("");
    }
  };

  const deactivate = async () => {
    setBusy(true);
    setError("");
    try {
      await apiFetch("/auth/deactivate-account", { method: "POST", body: JSON.stringify({ password }) });
      toast.success("Your account was deactivated");
      await logout();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach the server.");
      setBusy(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <ShieldAlert className="size-4" /> Danger zone
        </CardTitle>
        <CardDescription>Actions here lock you out of the dashboard.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-xl text-sm">
          <p className="font-medium">Deactivate my account</p>
          <p className="text-muted-foreground">
            You are signed out immediately and can't sign in again. Everything you recorded stays in the books and
            audit log, and another admin can reactivate you. The last active admin can't do this.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Deactivate account
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate your account?</DialogTitle>
            <DialogDescription>Enter your password to confirm. You will be signed out right away.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deact_password">Password</Label>
            <Input
              id="deact_password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void deactivate()} disabled={!password || busy}>
              {busy ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
