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

export function SalesByDatePage() {
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
      toast.success("CSV downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
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
      toast.success("PDF downloaded");
    } catch (err) {
      if (err && typeof err === "object" && "status" in err && err.status === 501) {
        toast.error("PDF export is not yet available. Use CSV instead.");
      } else {
        toast.error(err instanceof Error ? err.message : "Export failed");
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
        {error instanceof Error ? error.message : "Failed to load report."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports">← Reports</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">Sales by Date</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label>From</Label>
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
          <Label>To</Label>
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
          Export CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled
          title="PDF export coming soon"
        >
          Export PDF
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground">
          No data for the selected period
        </div>
      ) : (
        <>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="dimensionLabel" />
                <YAxis tickFormatter={(v) => `${Math.round(v)} ֏`} />
                <Tooltip
                  formatter={(v: number | undefined) =>
                    v != null ? [formatPrice(v), "Revenue"] : []
                  }
                />
                <Bar dataKey="chartRevenue" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Orders</th>
                  <th className="px-4 py-2 text-right font-medium">Units Sold</th>
                  <th className="px-4 py-2 text-right font-medium">Revenue</th>
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
                  <td className="px-4 py-2">Total</td>
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
                Previous
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
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
