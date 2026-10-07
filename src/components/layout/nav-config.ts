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
  KeyRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { to: string; label: string; icon: LucideIcon };

export const OPERATIONAL_NAV: NavItem[] = [
  { to: "/analytics", label: "Analytics", icon: LayoutDashboard },
  { to: "/batches", label: "Batches", icon: Bird },
  { to: "/houses", label: "Houses", icon: Home },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/purchases", label: "Purchases", icon: ShoppingBag },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/finance", label: "Finance", icon: Landmark },
  { to: "/employees", label: "Employees", icon: UserCog },
  { to: "/bonuses", label: "Bonuses", icon: Gift },
  { to: "/admins", label: "Admins", icon: ShieldCheck },
];

export const SYSTEM_NAV: NavItem[] = [
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/audit-log", label: "Audit Log", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Shown under Settings in the sidebar while a settings page is open; the page maps each id to its content. */
export const SETTINGS_NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "warehouses", label: "Warehouses", icon: Warehouse },
  { id: "instruments", label: "Payment instruments", icon: CreditCard },
  { id: "organizations", label: "Organizations", icon: Factory },
  { id: "coded-units", label: "Coded units", icon: QrCode },
  { id: "categories-units", label: "Categories & units", icon: Tags },
  { id: "roles", label: "Roles & salaries", icon: UserCog },
  { id: "devices", label: "Devices", icon: Smartphone },
  { id: "account", label: "Password", icon: KeyRound },
];

export const ALL_NAV = [...OPERATIONAL_NAV, ...SYSTEM_NAV];
