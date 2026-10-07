import {
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
      tab("/payments", "instruments", "Instruments", CreditCard),
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
      { to: "/settings/roles", label: "Roles & salaries", icon: UserCog },
      { to: "/settings/devices", label: "Devices", icon: Smartphone },
      { to: "/settings/account", label: "Account", icon: UserRound },
    ],
  },
];

export const ALL_NAV = [...OPERATIONAL_NAV, ...SYSTEM_NAV];
