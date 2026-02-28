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
  Cell,
} from "recharts";
import { useReportSalesByClient, useUsers } from "@/api/hooks";
import { useAuth } from "@/contexts/auth-context";
import { downloadReportFile, type ReportType } from "@/lib/report-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, getRevenue } from "@/lib/format-currency";

const CHART_COLORS = [
  "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",
  "#dbeafe", "#eff6ff", "#f0f9ff", "#e0f2fe", "#bae6fd",
];

export function SalesByClientPage() {
  const { accessToken } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const [clientId, setClientId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [page, setPage] = useState(1);

  const { data: clientsData } = useUsers({
    pageSize: 500,
    role: "client",
    isActive: true,
  });
  const clients = clientsData?.data ?? [];

  const { data, isLoading, isError, error } = useReportSalesByClient({
    clientId: clientId || undefined,
    dateFrom,
    dateTo,
    page,
    pageSize: 20,
  });

  const handleExportCSV = async () => {
    if (!accessToken) return;
    try {
      await downloadReportFile(
        "sales-by-client" as ReportType,
        { format: "csv", dateFrom, dateTo, clientId: clientId || undefined },
        accessToken
      );
      toast.success("CSV downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
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
      <h1 className="text-2xl font-semibold">Sales by Client</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label>Client</Label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setPage(1);
            }}
            className="mt-1 h-9 w-64 rounded-md border border-input bg-background px-3 py-1"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.email})
              </option>
            ))}
          </select>
        </div>
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
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          Export CSV
        </Button>
        <Button variant="outline" size="sm" disabled title="PDF export coming soon">
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
              <BarChart data={chartData} margin={{ bottom: 60 }}>
                <XAxis dataKey="dimensionLabel" angle={-45} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => `${Math.round(v)} ֏`} />
                <Tooltip
                  formatter={(v: number | undefined) =>
                    v != null ? [formatPrice(v), "Revenue"] : []
                  }
                />
                <Bar dataKey="chartRevenue">
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Client Name</th>
                  <th className="px-4 py-2 text-right font-medium">Orders</th>
                  <th className="px-4 py-2 text-right font-medium">Units</th>
                  <th className="px-4 py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.dimension} className="border-b last:border-0">
                    <td className="px-4 py-2">{r.dimensionLabel}</td>
                    <td className="px-4 py-2 text-right">{r.orderCount}</td>
                    <td className="px-4 py-2 text-right">{r.totalQty}</td>
                    <td className="px-4 py-2 text-right">{formatPrice(getRevenue(r))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-4 py-2 text-right">{totalOrders}</td>
                  <td className="px-4 py-2 text-right">{totalQty}</td>
                  <td className="px-4 py-2 text-right">{formatPrice(totalRevenue)}</td>
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
