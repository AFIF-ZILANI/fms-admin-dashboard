import { Link } from "react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentPageTitle } from "@/components/layout/use-page-title";

export function TopBar() {
  const title = useCurrentPageTitle();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <Button variant="ghost" size="icon" aria-label="Alerts" nativeButton={false} render={<Link to="/alerts" />}>
        <Bell className="size-4" />
      </Button>
    </header>
  );
}
