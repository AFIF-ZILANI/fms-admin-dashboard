import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { OPERATIONAL_NAV, SYSTEM_NAV, type NavChild, type NavItem } from "@/components/layout/nav-config";
import { type UseThemeProps } from "next-themes";

/** Path children match on the path; ?tab= children on the tab param, the first one being the default. */
function childActive(child: NavChild, index: number, pathname: string, search: string) {
  const [path, query] = child.to.split("?");
  if (pathname !== path) return false;
  if (!query) return true;
  const current = new URLSearchParams(search).get("tab");
  return current ? current === new URLSearchParams(query).get("tab") : index === 0;
}

function NavGroup({ items }: { items: NavItem[] }) {
  const { pathname, search } = useLocation();
  // Clicking the open section folds its sub-navigation; leaving the section forgets the fold, so
  // coming back always opens it.
  const [folded, setFolded] = useState<string | null>(null);
  if (folded && !pathname.startsWith(folded)) setFolded(null);

  return (
    <div className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, children }) => {
        const inSection = pathname === to || pathname.startsWith(`${to}/`);
        const open = inSection && folded !== to;
        return (
          <div key={to} className="flex flex-col gap-0.5">
            <NavLink
              to={to}
              onClick={(e) => {
                if (children && inSection) {
                  e.preventDefault();
                  setFolded(folded === to ? null : to);
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
            {children && (
              // Always mounted so it can animate; grid rows 0fr -> 1fr is the height transition (no measuring in JS).
              <div
                inert={!open}
                className={cn(
                  "hidden transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none lg:grid",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <div className="mt-1.5 mb-4 ml-5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
                    {children.map((child, i) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                          childActive(child, i, pathname, search)
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <child.icon className="size-3.5 shrink-0" />
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar({ theme }: { theme: UseThemeProps }) {
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
