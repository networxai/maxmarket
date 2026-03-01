import { cn } from "@/lib/utils";

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-primary/10 text-primary",
  approved: "bg-emerald-50 text-emerald-600",
  fulfilled: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
  cancelled: "bg-amber-50 text-amber-600",
  returned: "bg-orange-50 text-orange-600",
};

export const ROLE_BADGE_CLASSES: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  agent: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  client: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label: string;
  className?: string;
}) {
  const classes = STATUS_BADGE_CLASSES[status] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
        classes,
        className
      )}
    >
      {label}
    </span>
  );
}

export function RoleBadge({
  role,
  label,
  className,
}: {
  role: string;
  label: string;
  className?: string;
}) {
  const classes = ROLE_BADGE_CLASSES[role] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
        classes,
        className
      )}
    >
      {label}
    </span>
  );
}
