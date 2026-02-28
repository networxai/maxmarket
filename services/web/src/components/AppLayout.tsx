import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Menu, LogOut, User, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Language } from "@/types/api";
import { useState } from "react";

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

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth();
        navigate("/login", { replace: true });
      },
    });
  };

  const SidebarNav = ({ onLinkClick }: { onLinkClick?: () => void }) => (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => (
        <Link
          key={`${item.to}-${item.label}`}
          to={item.to}
          onClick={onLinkClick}
          aria-label={t(item.label)}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "text-foreground"
          )}
        >
          {t(item.label)}
        </Link>
      ))}
    </nav>
  );

  const Sidebar = () => (
    <aside className="relative z-20 flex h-full w-64 shrink-0 flex-col border-r border-border bg-background shadow-sm">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
        <SidebarNav />
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* Mobile: hamburger + sheet */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b bg-background px-4 md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="z-[100] w-64 overflow-y-auto overflow-x-hidden border-r bg-background p-0 shadow-xl">
            <div className="pt-12 pb-4">
              <SidebarNav onLinkClick={() => setSidebarOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <Link to="/" className="flex items-center gap-2 font-semibold" aria-label={t("nav.home")}>
          MaxMarket
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Globe className="h-4 w-4" />
                {LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              {LANGUAGE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setLanguage(opt.value)}
                >
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
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                    {t(`roles.${user.role}`)}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50">
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

      {/* Desktop: sidebar + content area */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative hidden overflow-hidden md:block md:w-64 md:shrink-0">
          <Sidebar />
        </div>
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 hidden h-14 shrink-0 items-center gap-4 border-b bg-background px-4 md:flex">
            <Link to="/" className="flex items-center gap-2 font-semibold" aria-label={t("nav.home")}>
              MaxMarket
            </Link>
            <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Globe className="h-4 w-4" />
                {LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              {LANGUAGE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setLanguage(opt.value)}
                >
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
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                    {t(`roles.${user.role}`)}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-50">
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

          <main className="flex-1 overflow-y-auto p-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
