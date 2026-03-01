import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useReportSalesByDate } from "@/api/hooks";
import { useAuth } from "@/contexts/auth-context";
import { downloadReportFile, type ReportType } from "@/lib/report-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, getRevenue } from "@/lib/format-currency";
import { useTranslation } from "@/i18n/useTranslation";

export function SalesByDatePage() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useReportSalesByDate({
    dateFrom,
    dateTo,
    page,
    pageSize: 20,
  });

  const handleExportCSV = async () => {
    if (!accessToken) return;
    try {
      await downloadReportFile(
        "sales-by-date" as ReportType,
        { format: "csv", dateFrom, dateTo },
        accessToken
      );
      toast.success(t("actions.csvDownloaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actions.exportFailed"));
    }
  };

  const handleExportPDF = async () => {
    if (!accessToken) return;
    try {
      await downloadReportFile(
        "sales-by-date" as ReportType,
        { format: "pdf", dateFrom, dateTo },
        accessToken
      );
      toast.success(t("actions.pdfDownloaded"));
    } catch (err) {
      if (err && typeof err === "object" && "status" in err && err.status === 501) {
        toast.error(t("actions.pdfNotAvailable"));
      } else {
        toast.error(err instanceof Error ? err.message : t("actions.exportFailed"));
      }
    }
  };

  const rows = data?.data ?? [];
  const pagination = data?.pagination;
  const chartData = rows
    .filter((r) => (r.dimensionLabel ?? "").trim())
    .slice(0, 10)
    .map((r) => ({ ...r, chartRevenue: getRevenue(r) }));
  const totalOrders = rows.reduce((s, r) => s + r.orderCount, 0);
  const totalQty = rows.reduce((s, r) => s + r.totalQty, 0);
  const totalRevenue = rows.reduce((s, r) => s + getRevenue(r), 0);

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : t("errors.failedToLoad")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("pages.reports.salesByDate")}</h2>
          <p className="text-muted-foreground text-sm">{t("pages.reports.salesByDateDesc")}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports">{t("pages.reports.backToReports")}</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={!dateFrom || !dateTo}
        >
          {t("actions.exportCsv")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled
          title={t("actions.pdfExportComingSoon")}
        >
          {t("actions.exportPdf")}
        </Button>
      </div>

      {!isLoading && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-sm">{t("pages.reports.totalRevenue")}</p>
            <p className="text-2xl font-bold">{formatPrice(totalRevenue)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-sm">{t("pages.reports.totalOrders")}</p>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-sm">{t("pages.reports.totalUnits")}</p>
            <p className="text-2xl font-bold">{totalQty}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6">
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold">{t("pages.reports.noData")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4">
            <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="dimensionLabel" />
                <YAxis tickFormatter={(v) => `${Math.round(v)} ֏`} />
                <Tooltip
                  formatter={(v: number | undefined) =>
                    v != null ? [formatPrice(v), t("table.revenue")] : []
                  }
                />
                <Bar dataKey="chartRevenue" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("table.date")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("table.orders")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("table.unitsSold")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("table.revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.dimension} className="border-b last:border-0">
                    <td className="px-4 py-2">{r.dimensionLabel}</td>
                    <td className="px-4 py-2 text-right">{r.orderCount}</td>
                    <td className="px-4 py-2 text-right">{r.totalQty}</td>
                    <td className="px-4 py-2 text-right">
                      {formatPrice(getRevenue(r))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-4 py-2">{t("common.total")}</td>
                  <td className="px-4 py-2 text-right">{totalOrders}</td>
                  <td className="px-4 py-2 text-right">{totalQty}</td>
                  <td className="px-4 py-2 text-right">
                    {formatPrice(totalRevenue)}
                  </td>
                </tr>
              </tfoot>
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
                Page {pagination.page} of {pagination.totalPages}
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
    </div>
  );
}
