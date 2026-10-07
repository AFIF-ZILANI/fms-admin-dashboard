import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import {
  CreditCard,
  Factory,
  KeyRound,
  Layers,
  Package,
  QrCode,
  Ruler,
  Smartphone,
  Tags,
  Truck,
  UserCog,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/components/layout/use-page-title";
import { cn } from "@/lib/utils";
import { WarehousesTab } from "@/pages/inventory/warehouses-tab";
import { OrganizationsTab } from "@/pages/inventory/organizations-tab";
import { InstrumentsTab } from "@/pages/payments/instruments-tab";
import { StockUnitProvisionCard } from "@/pages/settings/stock-unit-provision-card";
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
    label: "Farm",
    sections: [
      { id: "warehouses", label: "Warehouses", description: "Where stock is stored.", icon: Warehouse, content: <WarehousesTab /> },
      { id: "instruments", label: "Payment instruments", description: "The farm's wallets, bank and mobile accounts.", icon: CreditCard, content: <InstrumentsTab /> },
      { id: "organizations", label: "Organizations", description: "Manufacturers, importers and distributors.", icon: Factory, content: <OrganizationsTab /> },
    ],
  },
  {
    label: "Catalog",
    sections: [
      { id: "coded-units", label: "Coded units", description: "Provision QR-coded stock units.", icon: QrCode, content: <StockUnitProvisionCard /> },
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
  usePageTitle("Settings");
  const [params, setParams] = useSearchParams();
  // The section lives in the URL so a refresh, back button or shared link lands on the same page.
  const active = ALL.find((s) => s.id === params.get("section")) ?? ALL[0]!;

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      <nav aria-label="Settings sections" className="shrink-0 md:w-56">
        <div className="flex gap-4 overflow-x-auto md:sticky md:top-20 md:flex-col md:gap-5 md:overflow-visible">
          {GROUPS.map((group) => (
            <div key={group.label} className="flex shrink-0 flex-col gap-1">
              <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
              <div className="flex gap-1 md:flex-col">
                {group.sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={s.id === active.id ? "page" : undefined}
                    onClick={() => setParams({ section: s.id }, { replace: true })}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      s.id === active.id
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <s.icon className="size-4 shrink-0" />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <section className="min-w-0 flex-1">
        <header className="mb-4 border-b border-border pb-4">
          <h2 className="text-lg font-semibold tracking-tight">{active.label}</h2>
          <p className="text-sm text-muted-foreground">{active.description}</p>
        </header>
        {active.content}
      </section>
    </div>
  );
}
