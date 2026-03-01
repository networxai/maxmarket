import { Fragment, useState } from "react";
import { toast } from "sonner";
import { useAuditLogs, useClearAuditLogs } from "@/api/hooks";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApiError } from "@/api/client";
import { formatDateTime } from "@/lib/format-date";
import { displayName } from "@/lib/display-name";
import { useTranslation } from "@/i18n/useTranslation";

const EVENT_TYPES = [
  "order.created",
  "order.approved",
  "order.rejected",
  "order.fulfilled",
  "order.cancelled",
  "order.returned",
  "order.version_edit",
  "stock.adjusted",
  "user.created",
  "user.deactivated",
  "user.role_changed",
  "price.override",
];

const TARGET_TYPES = [
  "order",
  "user",
  "product",
  "variant",
  "client_group",
  "stock",
];

function CopyButton({ text, t }: { text: string; t: (k: string) => string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-1 text-xs"
      onClick={handleCopy}
    >
      {copied ? t("common.copied") : t("common.copy")}
    </Button>
  );
}

export function AuditLogsPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const [eventType, setEventType] = useState("");
  const [actorId, setActorId] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeCleared, setIncludeCleared] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearBeforeDate, setClearBeforeDate] = useState("");

  const isSuperAdmin = role === "super_admin";

  const { data, isLoading, isError, error, refetch } = useAuditLogs({
    eventType: eventType || undefined,
    actorId: actorId || undefined,
    targetType: targetType || undefined,
    targetId: targetId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    includeCleared,
    page,
    pageSize: 20,
  });

  const clearMutation = useClearAuditLogs();

  const handleClear = async () => {
    if (!clearBeforeDate) {
      toast.error(t("audit.selectDate"));
      return;
    }
    const beforeDate = new Date(clearBeforeDate).toISOString();
    try {
      const result = await clearMutation.mutateAsync({
        scope: "before_date",
        beforeDate,
      });
      setClearOpen(false);
      toast.success(t("audit.clearedCount", { count: String(result.clearedCount) }));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) toast.error(err.message);
        else toast.error(err.message);
      } else {
        toast.error(t("errors.failedToClearLogs"));
      }
    }
  };

  const entries = data?.data ?? [];
  const pagination = data?.pagination;

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : t("errors.failedToLoadAuditLogs")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("audit.title")}</h1>
        {isSuperAdmin && (
          <Button variant="outline" size="sm" onClick={() => setClearOpen(true)}>
            {t("audit.clearLogsTitle")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded border p-4">
        <div>
          <Label>{t("audit.event")}</Label>
          <Input
            placeholder={t("audit.eventTypePlaceholder")}
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              setPage(1);
            }}
            list="eventTypes"
            className="mt-1 w-48"
          />
          <datalist id="eventTypes">
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et} />
            ))}
          </datalist>
        </div>
        <div>
          <Label>{t("audit.actorId")}</Label>
          <Input
            placeholder={t("filters.uuidPlaceholder")}
            value={actorId}
            onChange={(e) => {
              setActorId(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-48"
          />
        </div>
        <div>
          <Label>{t("audit.targetType")}</Label>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              setPage(1);
            }}
            className="mt-1 h-9 w-32 rounded-md border border-input bg-background px-3 py-1"
          >
            <option value="">{t("common.dash")}</option>
            {TARGET_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {tt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>{t("audit.targetId")}</Label>
          <Input
            placeholder={t("filters.uuidPlaceholder")}
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-48"
          />
        </div>
        <div>
          <Label>{t("filters.from")}</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-40"
          />
        </div>
        <div>
          <Label>{t("filters.to")}</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="mt-1 w-40"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeCleared}
            onChange={(e) => {
              setIncludeCleared(e.target.checked);
              setPage(1);
            }}
          />
          <span className="text-sm">{t("audit.includeCleared")}</span>
        </label>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 text-muted-foreground">{t("audit.loading")}</div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground">
          {t("audit.noEntries")}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("audit.timestamp")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("audit.event")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("audit.actor")}</th>
                  <th className="hidden px-4 py-2 text-left font-medium md:table-cell">{t("audit.target")}</th>
                  <th className="hidden px-4 py-2 text-left font-medium md:table-cell">{t("audit.correlationId")}</th>
                  <th className="hidden px-4 py-2 text-left font-medium sm:table-cell">{t("audit.cleared")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr
                      key={entry.id}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                      onClick={() =>
                        setExpandedId(expandedId === entry.id ? null : entry.id)
                      }
                    >
                      <td className="px-4 py-2">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                          {entry.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-muted-foreground text-xs" title={entry.actorId ?? undefined}>
                          {entry.actorRole && (
                            <span className="mr-1 rounded bg-slate-500/20 px-1">
                              {entry.actorRole}
                            </span>
                          )}
                          {displayName(entry.actorName, entry.actorId)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-2 md:table-cell">
                        {entry.targetType && entry.targetId
                          ? `${entry.targetType} ${entry.targetId.slice(0, 8)}…`
                          : "—"}
                      </td>
                      <td className="hidden px-4 py-2 md:table-cell">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs truncate max-w-[120px]">
                            {entry.correlationId ?? "—"}
                          </span>
                          {entry.correlationId && (
                            <CopyButton text={entry.correlationId} t={t} />
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-2 sm:table-cell">
                        {entry.clearedAt ? (
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                            {t("audit.cleared")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr>
                        <td colSpan={6} className="bg-muted/20 px-4 py-2">
                          {(entry.actorId || entry.targetId) && (
                            <div className="mb-2 font-mono text-xs text-muted-foreground">
                              {entry.actorId && <span title="Actor ID">actorId: {entry.actorId}</span>}
                              {entry.actorId && entry.targetId && " · "}
                              {entry.targetId && <span title="Target ID">targetId: {entry.targetId}</span>}
                            </div>
                          )}
                          <pre className="max-h-64 overflow-auto rounded bg-muted p-4 text-sm">
                            {JSON.stringify(entry.payload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("common.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("common.pageOf", { page: pagination.page, total: pagination.totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("audit.clearLogsTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              {t("audit.clearLogsDesc")}
            </p>
            <div>
              <Label>{t("audit.clearBeforeLabel")}</Label>
              <Input
                type="datetime-local"
                value={clearBeforeDate}
                onChange={(e) => setClearBeforeDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleClear}
              disabled={!clearBeforeDate || clearMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("actions.clearLogs")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
