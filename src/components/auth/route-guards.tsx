import { Navigate, Outlet, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
      {children}
    </div>
  );
}

/** Anything past this needs a session. */
export function RequireAuth() {
  const { me, isLoading, error, refetch } = useAuth();
  const location = useLocation();

  if (isLoading) return <Centered><p className="text-sm text-muted-foreground">Loading…</p></Centered>;
  if (error) {
    return (
      <Centered>
        <p className="text-sm">Could not reach the server.</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          Try again
        </Button>
      </Centered>
    );
  }
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** The dashboard itself: admins only, and only once the temp password is replaced. */
export function RequireAdminReady() {
  const { me, logout } = useAuth();
  if (!me) return null; // RequireAuth sits above this
  if (me.must_change_password) return <Navigate to="/change-password" replace />;
  if (me.role !== "ADMIN") {
    return (
      <Centered>
        <p className="text-lg font-semibold">No access</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The dashboard is for admins. Employees use the farm app on their phone.
        </p>
        <Button variant="outline" size="sm" onClick={() => void logout()}>
          Log out
        </Button>
      </Centered>
    );
  }
  return <Outlet />;
}
