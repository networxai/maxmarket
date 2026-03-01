import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/i18n/useTranslation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart3, Users, Package, Calendar } from "lucide-react";

const REPORTS = [
  { to: "/reports/sales-by-date", labelKey: "reports.salesByDate", icon: Calendar, roles: ["super_admin", "admin", "manager", "agent"] as const },
  { to: "/reports/sales-by-manager", labelKey: "reports.salesByManager", icon: BarChart3, roles: ["super_admin", "admin", "manager"] as const },
  { to: "/reports/sales-by-client", labelKey: "reports.salesByClient", icon: Users, roles: ["super_admin", "admin", "manager", "agent"] as const },
  { to: "/reports/sales-by-product", labelKey: "reports.salesByProduct", icon: Package, roles: ["super_admin", "admin", "manager", "agent"] as const },
];

export function ReportsLandingPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const visibleReports = REPORTS.filter((r) =>
    role && (r.roles as readonly string[]).includes(role)
  );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("pages.reports.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("pages.reports.description")}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {visibleReports.map(({ to, labelKey, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-2">
                <Icon className="h-5 w-5" />
                <span className="font-medium">{t(labelKey)}</span>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {t("reports.viewReport")}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
