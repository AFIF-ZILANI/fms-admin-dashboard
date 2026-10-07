import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router";
import {
  KeyRound,
  Layers,
  Package,
  Ruler,
  Smartphone,
  Tags,
  Truck,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/components/layout/use-page-title";
import { LookupManagerCard } from "@/pages/settings/lookup-manager-card";
import { DevicesTab } from "@/pages/settings/devices-tab";
import { RoleSalaryCard } from "@/pages/settings/role-salary-card";

type Section = { id: string; label: string; description: string; icon: LucideIcon; content: ReactNode };
type Group = { label: string; sections: Section[] };

// Every section reuses the shared component its owning page already built
// (Warehouses/Organizations from Inventory, Instruments from Payments) —
// per PRD.md §6.15, Settings hosts them, it doesn't fork its own forms.
const GROUPS: Group[] = [
  {
    label: "Catalog",
    sections: [
      {
        id: "categories-units",
        label: "Categories & units",
        description: "The lists behind item, expense and supplier dropdowns.",
        icon: Tags,
        content: (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Renaming FEED, MEDICINE, VACCINE, or EQUIPMENT may affect other features (feeding programs, asset
              creation, coded-unit binding) that reference those specific categories.
            </p>
            <LookupManagerCard title="Item Categories" singular="Item Category" endpoint="/item-categories" queryKey="item-categories" icon={Package} />
            <LookupManagerCard title="Units" singular="Unit" endpoint="/units" queryKey="units" icon={Ruler} />
            <LookupManagerCard title="Expense Categories" singular="Expense Category" endpoint="/expense-categories" queryKey="expense-categories" icon={Layers} />
            <LookupManagerCard
              title="Supplier Supply Categories"
              singular="Supplier Supply Category"
              endpoint="/supplier-supply-categories"
              queryKey="supplier-supply-categories"
              icon={Truck}
            />
          </div>
        ),
      },
    ],
  },
  {
    label: "People & devices",
    sections: [
      { id: "roles", label: "Roles & salaries", description: "Base pay by role.", icon: UserCog, content: <RoleSalaryCard /> },
      { id: "devices", label: "Devices", description: "Phones paired to the farm app.", icon: Smartphone, content: <DevicesTab /> },
    ],
  },
  {
    label: "Account",
    sections: [
      {
        id: "account",
        label: "Password",
        description: "Sign-in security for your account.",
        icon: KeyRound,
        content: (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change password</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
              Changing your password signs you out on every other device.
              <Button variant="outline" nativeButton={false} render={<Link to="/change-password" />}>
                <KeyRound className="size-4" /> Change password
              </Button>
            </CardContent>
          </Card>
        ),
      },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.sections);

export function SettingsPage() {
  const { section } = useParams();
  const active = ALL.find((s) => s.id === section);
  usePageTitle(active ? `Settings · ${active.label}` : "Settings");
  if (!active) return <Navigate to="/settings/categories-units" replace />;

  return (
    <section key={active.id} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">{active.label}</h2>
        <p className="text-sm text-muted-foreground">{active.description}</p>
      </header>
      {active.content}
    </section>
  );
}
