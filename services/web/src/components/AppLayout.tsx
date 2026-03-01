import type { ReactNode } from "react";
import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/i18n/useTranslation";
import { useLogout } from "@/api/hooks";
import { getNavItemsForRole } from "@/lib/nav-config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut, User, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Language } from "@/types/api";

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hy", label: "Հայերեն" },
  { value: "ru", label: "Русский" },
];

/** Route path -> page title for header breadcrumb. */
const ROUTE_TITLES: Record<string, string> = {
  "/": "nav.home",
  "/catalog": "nav.catalog",
  "/orders": "nav.orders",
  "/admin/inventory": "nav.inventory",
  "/admin/users": "nav.users",
  "/admin/client-groups": "nav.clientGroups",
  "/admin/catalog": "nav.catalogAdmin",
  "/reports": "nav.reports",
  "/admin/audit": "nav.auditLogs",
  "/settings": "nav.settings",
  "/admin/i18n": "nav.translations",
};

function getPageTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith("/catalog/")) return "nav.catalog";
  if (pathname.startsWith("/orders")) return "nav.orders";
  if (pathname.startsWith("/reports/")) return "nav.reports";
  if (pathname.startsWith("/admin/catalog")) return "nav.catalogAdmin";
  if (pathname.startsWith("/admin/inventory")) return "nav.inventory";
  return "nav.home";
}

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, logout: clearAuth } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const logoutMutation = useLogout();
  const navItems = getNavItemsForRole(role);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const setSidebarCollapsedPersisted = (v: boolean | ((prev: boolean) => boolean)) => {
    setSidebarCollapsed((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  };
  const pageTitle = getPageTitle(location.pathname);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        navigate("/login", { replace: true });
      },
    });
  };

  const SidebarNav = ({ onLinkClick, collapsed }: { onLinkClick?: () => void; collapsed?: boolean }) => (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={`${item.to}-${item.label}`}
            to={item.to}
            onClick={onLinkClick}
            aria-label={t(item.label)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                collapsed && "justify-center px-2"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{t(item.label)}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Mobile: hamburger + sheet */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="z-[100] w-64 overflow-y-auto overflow-x-hidden border-r bg-sidebar p-0 shadow-xl">
            <div className="flex h-14 items-center border-b border-sidebar-border px-4">
              <span className="font-bold text-lg text-sidebar-foreground">MaxMarket</span>
            </div>
            <div className="pt-4 pb-4">
              <SidebarNav onLinkClick={() => setSidebarOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <Link to="/" className="min-w-0 flex-1 truncate font-semibold" aria-label={t("nav.home")}>
          MaxMarket
        </Link>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Language">
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[100]">
              {LANGUAGE_OPTIONS.map((opt) => (
                <DropdownMenuItem key={opt.value} onClick={() => setLanguage(opt.value)}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={user.fullName}>
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100]">
                <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="default" size="sm" className="shrink-0" asChild>
              <Link to="/login">{t("auth.login")}</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Desktop: fixed collapsible sidebar (hidden on mobile — use Sheet) */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 md:flex",
          sidebarCollapsed ? "md:w-[68px]" : "md:w-64"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          {!sidebarCollapsed ? (
            <Link to="/" className="font-bold text-lg text-sidebar-foreground">
              MaxMarket
            </Link>
          ) : (
            <Link to="/" className="flex items-center justify-center w-full font-bold text-lg text-sidebar-foreground" aria-label={t("nav.home")}>
              M
            </Link>
          )}
        </div>
        <SidebarNav collapsed={sidebarCollapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={() => setSidebarCollapsedPersisted((c) => !c)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main content area — no margin on mobile, offset by sidebar on desktop */}
      <main
        className={cn(
          "min-h-screen flex-1 transition-all duration-300",
          "ml-0",
          sidebarCollapsed ? "md:ml-[68px]" : "md:ml-64"
        )}
      >
        {/* Top header bar (desktop only; mobile uses the top bar above) */}
        <header className="sticky top-0 z-30 hidden h-14 shrink-0 items-center gap-4 border-b bg-background px-4 md:flex md:px-6">
          <div className="flex flex-1 items-center gap-4">
            <h1 className="text-lg font-semibold">{t(pageTitle)}</h1>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Globe className="h-4 w-4" />
                  {LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100]">
                {LANGUAGE_OPTIONS.map((opt) => (
                  <DropdownMenuItem key={opt.value} onClick={() => setLanguage(opt.value)}>
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    {user.fullName}
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{t(`roles.${user.role}`)}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[100]">
                  <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("auth.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="default" size="sm" asChild>
                <Link to="/login">{t("auth.login")}</Link>
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
