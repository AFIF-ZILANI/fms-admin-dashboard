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
  Bell,
  History,
  Settings,
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
  { to: "/admins", label: "Admins", icon: ShieldCheck },
];

export const SYSTEM_NAV: NavItem[] = [
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/audit-log", label: "Audit Log", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const ALL_NAV = [...OPERATIONAL_NAV, ...SYSTEM_NAV];
