import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import {
  OPERATIONAL_NAV,
  SETTINGS_NAV,
  SYSTEM_NAV,
  type NavItem,
} from "@/components/layout/nav-config";
import { type UseThemeProps } from "next-themes";

function NavGroup({ items }: { items: NavItem[] }) {
  const inSettings = useLocation().pathname.startsWith("/settings");
  // Clicking Settings while it is open folds the sub-navigation away; leaving Settings forgets the fold,
  // so coming back always opens it.
  const [folded, setFolded] = useState(false);
  if (!inSettings && folded) setFolded(false);
  return (
    <div className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon }) => (
        <div key={to} className="flex flex-col gap-0.5">
        <NavLink
          to={to}
          onClick={(e) => {
            if (to === "/settings" && inSettings) {
              e.preventDefault();
              setFolded((f) => !f);
            }
          }}
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
        {to === "/settings" && inSettings && !folded && (
          <div className="mt-1.5 mb-4 ml-5 hidden flex-col gap-0.5 border-l border-sidebar-border pl-2 lg:flex">
            {SETTINGS_NAV.map(({ id, label: subLabel, icon: SubIcon }) => (
              <NavLink
                key={id}
                to={`/settings/${id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )
                }
              >
                <SubIcon className="size-3.5 shrink-0" />
                {subLabel}
              </NavLink>
            ))}
          </div>
        )}
        </div>
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
