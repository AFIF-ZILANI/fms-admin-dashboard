import { NavLink } from "react-router";
import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { OPERATIONAL_NAV, SYSTEM_NAV, type NavItem } from "@/components/layout/nav-config";

function NavGroup({ items }: { items: NavItem[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "lg:justify-start justify-center",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          <span className="hidden lg:inline">{label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col gap-4 border-r border-border bg-sidebar px-2 py-4 lg:w-60 lg:px-3">
      <div className="flex items-center gap-2 px-1 lg:px-2">
        <Sprout className="size-6 shrink-0 text-brand" />
        <span className="hidden text-sm font-semibold tracking-tight lg:inline">ZeroD Farms</span>
      </div>
      <nav className="flex flex-1 flex-col justify-between overflow-y-auto">
        <NavGroup items={OPERATIONAL_NAV} />
        <div className="mt-4 flex flex-col gap-2">
          <div className="mx-1 border-t border-sidebar-border lg:mx-2" />
          <NavGroup items={SYSTEM_NAV} />
        </div>
      </nav>
    </aside>
  );
}
