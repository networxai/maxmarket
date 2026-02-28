import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart3, Users, Package, Calendar } from "lucide-react";

const REPORTS = [
  { to: "/reports/sales-by-date", label: "Sales by Date", icon: Calendar, roles: ["super_admin", "admin", "manager", "agent"] as const },
  { to: "/reports/sales-by-manager", label: "Sales by Manager", icon: BarChart3, roles: ["super_admin", "admin", "manager"] as const },
  { to: "/reports/sales-by-client", label: "Sales by Client", icon: Users, roles: ["super_admin", "admin", "manager", "agent"] as const },
  { to: "/reports/sales-by-product", label: "Sales by Product", icon: Package, roles: ["super_admin", "admin", "manager", "agent"] as const },
];

export function ReportsLandingPage() {
  const { role } = useAuth();
  const visibleReports = REPORTS.filter((r) =>
    role && (r.roles as readonly string[]).includes(role)
  );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibleReports.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center gap-2">
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                View report →
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
