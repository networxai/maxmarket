import type { Role } from "@/types/api";

export interface NavItem {
  to: string;
  label: string;
  /** Roles that see this item. Empty = public (everyone). */
  roles: Role[] | "all";
}

export const navItems: NavItem[] = [
  { to: "/catalog", label: "nav.catalog", roles: "all" },
  { to: "/orders", label: "nav.orders", roles: ["agent", "manager", "admin", "super_admin"] },
  { to: "/orders", label: "nav.myOrders", roles: ["client"] },
  { to: "/admin/inventory", label: "nav.inventory", roles: ["agent", "manager", "admin", "super_admin"] },
  { to: "/admin/users", label: "nav.users", roles: ["super_admin", "admin"] },
  { to: "/admin/client-groups", label: "nav.clientGroups", roles: ["super_admin", "admin", "manager", "agent"] },
  { to: "/admin/catalog", label: "nav.catalogAdmin", roles: ["super_admin", "admin"] },
  { to: "/reports", label: "nav.reports", roles: ["super_admin", "admin", "manager", "agent"] },
  { to: "/admin/audit", label: "nav.auditLogs", roles: ["super_admin", "admin"] },
  { to: "/settings", label: "nav.settings", roles: ["super_admin", "admin", "manager", "agent", "client"] },
  { to: "/admin/i18n", label: "nav.translations", roles: ["super_admin"] },
];

export function getNavItemsForRole(role: Role | null): NavItem[] {
  if (!role) {
    return navItems.filter((item) => item.roles === "all");
  }
  return navItems.filter(
    (item) => item.roles === "all" || (item.roles as Role[]).includes(role)
  );
}
