import type { ReactNode } from "react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/i18n/useTranslation";
import { useLogout } from "@/api/hooks";
import { getNavItemsForRole, getSectionLabel } from "@/lib/nav-config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Menu, LogOut, User, Globe, ChevronLeft, ChevronRight, Search, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Language } from "@/types/api";

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hy", label: "Հայերեն" },
  { value: "ru", label: "Русский" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
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
  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        navigate("/login", { replace: true });
      },
    });
  };

  const groupedBySection = navItems.reduce(
    (acc, item) => {
      const sec = item.section ?? "main";
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push(item);
      return acc;
    },
    {} as Record<string, typeof navItems>
  );
  const sectionOrder = ["main", "management", "reports", "admin"] as const;

  const SidebarNav = ({ onLinkClick, collapsed }: { onLinkClick?: () => void; collapsed?: boolean }) => (
    <nav className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1">
      {sectionOrder.map((section, idx) => {
        const items = groupedBySection[section];
        if (!items?.length) return null;
        return (
          <div key={section} className={cn("space-y-1", idx > 0 && "mt-6")}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {t(getSectionLabel(section))}
              </p>
            )}
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  onClick={onLinkClick}
                  aria-label={t(item.label)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-white shadow-md shadow-primary/30"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      collapsed && "justify-center px-2"
                    )
                  }
                >
                  <Icon className="h-[22px] w-[22px] shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.label)}</span>}
                </NavLink>
              );
            })}
          </div>
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
          <SheetContent side="left" className="z-[100] w-64 overflow-y-auto overflow-x-hidden border-r bg-white p-0 shadow-xl">
            <div className="flex h-16 items-center gap-2 px-5 border-b border-border/30">
              <div className="h-7 w-7 shrink-0 rounded-md bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="font-bold text-lg text-foreground">MaxMarket</span>
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
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-border/50 bg-white shadow-sm transition-all duration-300 md:flex",
          sidebarCollapsed ? "md:w-[68px]" : "md:w-64"
        )}
      >
        <div className="flex h-16 items-center gap-2 px-5 border-b border-border/30">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 shrink-0 rounded-md bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-lg text-foreground truncate">MaxMarket</span>
            )}
          </Link>
        </div>
        <SidebarNav collapsed={sidebarCollapsed} />
        <div className="border-t border-border/50 p-2">
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
        <header className="sticky top-0 z-30 hidden h-16 shrink-0 items-center gap-4 border-b border-border/30 bg-card px-6 shadow-sm md:flex">
          <div className="flex flex-1">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ⌘K"
                className="pl-9 bg-muted/50 border-0 rounded-lg h-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 shrink-0" aria-label="Notifications">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-lg">
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

        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
