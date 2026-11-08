import {
  CalendarClock,
  Clock,
  LayoutDashboard,
  Bird,
  Home,
  Package,
  Truck,
  Users,
  ShoppingCart,
  ShoppingBag,
  Wallet,
  Landmark,
  UserCog,
  ShieldCheck,
  Gift,
  Bell,
  History,
  Settings,
  Syringe,
  Warehouse,
  CreditCard,
  Factory,
  QrCode,
  Tags,
  Smartphone,
  UserRound,
  ChartColumn,
  BookOpen,
  TriangleAlert,
  Wheat,
  Wrench,
  SlidersHorizontal,
  Split,
  Inbox,
  Receipt,
  TrendingDown,
  ChartLine,
  Stethoscope,
  ClipboardList,
  ListChecks,
  ArrowLeftRight,
  Skull,
  Scale,
  Thermometer,
  PackageOpen,
  type LucideIcon,
} from "lucide-react";

export type NavChild = { to: string; label: string; icon: LucideIcon };
export type NavItem = { to: string; label: string; icon: LucideIcon; children?: NavChild[] };

// A section's pages are the sidebar's sub-navigation (no in-page tab row). Query-based children
// (?tab=) keep every existing detail route and "Back to ..." link working; first child is the default.
const tab = (base: string, id: string, label: string, icon: LucideIcon): NavChild => ({
  to: `${base}?tab=${id}`,
  label,
  icon,
});

// A batch's pages: /batches/:id is the overview, the rest are /batches/:id/<value>. The sidebar shows
// them under Batches only while a batch is open, since every link needs its id.
export const BATCH_SECTIONS = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "allocations", label: "Houses", icon: ArrowLeftRight },
  { value: "mortality", label: "Mortality", icon: Skull },
  { value: "weight", label: "Weight", icon: Scale },
  { value: "feeding", label: "Feeding", icon: Wheat },
  { value: "treatments", label: "Treatments", icon: Syringe },
  { value: "vaccines", label: "Vaccines", icon: ShieldCheck },
  { value: "environment", label: "Environment", icon: Thermometer },
  { value: "consumption", label: "Consumption", icon: PackageOpen },
  { value: "financials", label: "Financials", icon: Wallet },
] as const;

export type BatchSection = (typeof BATCH_SECTIONS)[number]["value"];

export const batchSectionPath = (id: string, section: BatchSection) =>
  section === "overview" ? `/batches/${id}` : `/batches/${id}/${section}`;

export const batchNavChildren = (id: string): NavChild[] =>
  BATCH_SECTIONS.map(({ value, label, icon }) => ({ to: batchSectionPath(id, value), label, icon }));

export const OPERATIONAL_NAV: NavItem[] = [
  { to: "/analytics", label: "Analytics", icon: LayoutDashboard },
  { to: "/batches", label: "Batches", icon: Bird },
  { to: "/houses", label: "Houses", icon: Home },
  {
    to: "/inventory",
    label: "Inventory",
    icon: Package,
    children: [
      tab("/inventory", "analytics", "Analytics", ChartColumn),
      tab("/inventory", "stock-ledger", "Stock ledger", BookOpen),
      tab("/inventory", "items", "Item catalog", Package),
      tab("/inventory", "low-stock", "Low stock", TriangleAlert),
      tab("/inventory", "consumption-log", "Consumption log", Wheat),
      tab("/inventory", "assets", "Assets", Wrench),
      tab("/inventory", "adjustments", "Adjustments", SlidersHorizontal),
      tab("/inventory", "organizations", "Organizations", Factory),
      tab("/inventory", "coded-units", "Coded units", QrCode),
      tab("/inventory", "stock-allocation", "Stock allocation", Split),
      tab("/inventory", "warehouses", "Warehouses", Warehouse),
    ],
  },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/doctors", label: "Doctors", icon: Stethoscope },
  {
    to: "/sales",
    label: "Sales",
    icon: ShoppingCart,
    children: [
      tab("/sales", "overview", "Overview", ChartColumn),
      tab("/sales", "birds", "Bird sales", Bird),
      tab("/sales", "regular", "Regular sales", ShoppingCart),
      tab("/sales", "incoming", "Incoming", Inbox),
    ],
  },
  { to: "/purchases", label: "Purchases", icon: ShoppingBag },
  {
    to: "/payments",
    label: "Payments",
    icon: Wallet,
    children: [
      tab("/payments", "payments", "Payments", Wallet),
      tab("/payments", "instruments", "Farm accounts", CreditCard),
    ],
  },
  {
    to: "/finance",
    label: "Finance",
    icon: Landmark,
    children: [
      tab("/finance", "overview", "Overview", ChartColumn),
      tab("/finance", "expenses", "Expenses", Receipt),
      tab("/finance", "depreciation", "Depreciation", TrendingDown),
      tab("/finance", "shared-costs", "Shared costs", Split),
      tab("/finance", "pnl", "Batch P&L", ChartLine),
    ],
  },
  { to: "/employees", label: "Employees", icon: UserCog },
  {
    to: "/tasks",
    label: "Tasks",
    icon: ClipboardList,
    children: [
      tab("/tasks", "assignments", "Assignments", ClipboardList),
      tab("/tasks", "catalog", "Task catalog", ListChecks),
    ],
  },
  { to: "/bonuses", label: "Bonuses", icon: Gift },
  { to: "/admins", label: "Admins", icon: ShieldCheck },
];

export const SYSTEM_NAV: NavItem[] = [
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/audit-log", label: "Audit Log", icon: History },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    children: [
      { to: "/settings/categories-units", label: "Categories & units", icon: Tags },
      { to: "/settings/vaccine-templates", label: "Vaccine templates", icon: Syringe },
      { to: "/settings/farm-day", label: "Farm day", icon: Clock },
      { to: "/settings/settlement", label: "Settlement window", icon: CalendarClock },
      { to: "/settings/roles", label: "Roles & salaries", icon: UserCog },
      { to: "/settings/devices", label: "Devices", icon: Smartphone },
      { to: "/settings/account", label: "Account", icon: UserRound },
    ],
  },
];

export const ALL_NAV = [...OPERATIONAL_NAV, ...SYSTEM_NAV];
