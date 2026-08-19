import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import {
  OPERATIONAL_NAV,
  SYSTEM_NAV,
  type NavItem,
} from "@/components/layout/nav-config";
import { useTheme, type UseThemeProps } from "next-themes";

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
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
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

export function Sidebar({theme}: {theme: UseThemeProps}) {
  const isDark =
    theme.theme === "dark" ||
    (theme.theme === "system" && theme.systemTheme === "dark");
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col gap-4 border-r border-border bg-sidebar px-2 py-4 lg:w-60 lg:px-3">
      <div className="flex flex-col px-2">
        <img
          src={isDark ? "/logo-dark.svg" : "/logo-light.svg"}
          alt="FMS Logo"
          className="w-22 shrink-0"
        />
        <span className="text-xs">FMS Admin Dashboard</span>
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
