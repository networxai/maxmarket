import type { LucideIcon } from "lucide-react";
import {
  Package,
  ShoppingCart,
  Warehouse,
  Users,
  Building2,
  LayoutGrid,
  BarChart3,
  FileText,
  Settings,
  Languages,
} from "lucide-react";
import type { Role } from "@/types/api";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Roles that see this item. Empty = public (everyone). */
  roles: Role[] | "all";
}

export const navItems: NavItem[] = [
  { to: "/catalog", label: "nav.catalog", icon: Package, roles: "all" },
  { to: "/orders", label: "nav.orders", icon: ShoppingCart, roles: ["agent", "manager", "admin", "super_admin"] },
  { to: "/orders", label: "nav.myOrders", icon: ShoppingCart, roles: ["client"] },
  { to: "/admin/inventory", label: "nav.inventory", icon: Warehouse, roles: ["agent", "manager", "admin", "super_admin"] },
  { to: "/admin/users", label: "nav.users", icon: Users, roles: ["super_admin", "admin"] },
  { to: "/admin/client-groups", label: "nav.clientGroups", icon: Building2, roles: ["super_admin", "admin", "manager", "agent"] },
  { to: "/admin/catalog", label: "nav.catalogAdmin", icon: LayoutGrid, roles: ["super_admin", "admin"] },
  { to: "/reports", label: "nav.reports", icon: BarChart3, roles: ["super_admin", "admin", "manager", "agent"] },
  { to: "/admin/audit", label: "nav.auditLogs", icon: FileText, roles: ["super_admin", "admin"] },
  { to: "/settings", label: "nav.settings", icon: Settings, roles: ["super_admin", "admin", "manager", "agent", "client"] },
  { to: "/admin/i18n", label: "nav.translations", icon: Languages, roles: ["super_admin"] },
];

export function getNavItemsForRole(role: Role | null): NavItem[] {
  if (!role) {
    return navItems.filter((item) => item.roles === "all");
  }
  return navItems.filter(
    (item) => item.roles === "all" || (item.roles as Role[]).includes(role)
  );
}
