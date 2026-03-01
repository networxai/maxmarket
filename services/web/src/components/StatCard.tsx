import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const COLOR_MAP = {
  primary: { bg: "bg-primary/10", text: "text-primary", icon: "text-primary" },
  success: { bg: "bg-emerald-50", text: "text-emerald-600", icon: "text-emerald-600" },
  warning: { bg: "bg-amber-50", text: "text-amber-600", icon: "text-amber-600" },
  info: { bg: "bg-cyan-50", text: "text-cyan-600", icon: "text-cyan-600" },
  error: { bg: "bg-red-50", text: "text-red-600", icon: "text-red-600" },
} as const;

export type StatCardColor = keyof typeof COLOR_MAP;

export function StatCard({
  title,
  value,
  icon: Icon,
  color = "primary",
  trend,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  color?: StatCardColor;
  trend?: { value: string; positive: boolean };
}) {
  const c = COLOR_MAP[color];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-lg",
              c.bg
            )}
          >
            <Icon className={cn("h-5 w-5", c.icon)} />
          </div>
          <h3 className="mt-3 text-2xl font-bold">{value}</h3>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        {trend != null && (
          <span
            className={cn(
              "text-sm font-medium",
              trend.positive ? "text-emerald-600" : "text-red-500"
            )}
          >
            {trend.positive ? "+" : ""}
            {trend.value}
          </span>
        )}
      </div>
    </Card>
  );
}
