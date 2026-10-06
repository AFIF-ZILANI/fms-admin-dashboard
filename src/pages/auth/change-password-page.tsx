import { useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { ME_KEY, useAuth } from "@/lib/auth-context";

const schema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z.string().min(8, "At least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, {
    path: ["confirm"],
    message: "Passwords don't match",
  });
type Values = z.infer<typeof schema>;

/** Both the forced first-login screen (temp password) and a voluntary change. */
export function ChangePasswordPage() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const forced = me?.must_change_password ?? false;
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setFormError("");
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: values.current_password,
          new_password: values.new_password,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
      toast.success("Password changed");
      navigate("/", { replace: true });
    } catch (e) {
      setFormError(
        e instanceof ApiError
          ? (e.fieldError("new_password") ?? e.message)
          : "Could not reach the server.",
      );
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{forced ? "Set a new password" : "Change password"}</CardTitle>
          <CardDescription>
            {forced
              ? "You signed in with a temporary password. Choose your own to continue."
              : "Other devices signed in as you will be signed out."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="current_password">
                {forced ? "Temporary password" : "Current password"}
              </Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                autoFocus
                {...register("current_password")}
                aria-invalid={!!errors.current_password}
              />
              {errors.current_password && (
                <p className="text-xs text-destructive">{errors.current_password.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                {...register("new_password")}
                aria-invalid={!!errors.new_password}
              />
              {errors.new_password && (
                <p className="text-xs text-destructive">{errors.new_password.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...register("confirm")}
                aria-invalid={!!errors.confirm}
              />
              {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save password"}
            </Button>
            {forced ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
                Log out
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
