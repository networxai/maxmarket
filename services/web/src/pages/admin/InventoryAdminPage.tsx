import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useStock, useAdjustStock } from "@/api/hooks";
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
import type { WarehouseStock } from "@/types/admin";
import { useTranslation } from "@/i18n/useTranslation";

function FreeQtyCell({ available, reserved }: { available: number; reserved: number }) {
  const free = available - reserved;
  const color =
    free <= 0 ? "text-red-600 font-semibold" : free < 10 ? "text-amber-600" : "text-green-600";
  return <span className={color}>{free}</span>;
}

export function InventoryAdminPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const [warehouseFilter, setWarehouseFilter] = useState<string>("");
  const [skuSearch, setSkuSearch] = useState("");
  const [adjustRow, setAdjustRow] = useState<WarehouseStock | null>(null);
  const [newAvailable, setNewAvailable] = useState<number>(0);
  const [reason, setReason] = useState("");

  const canAdjust = role === "super_admin" || role === "admin";

  const { data, isLoading, isError, error, refetch } = useStock({
    page,
    pageSize: 20,
    warehouseId: warehouseFilter || undefined,
  });

  const warehouses = useMemo(() => {
    if (!data?.data) return [];
    const ids = new Set(data.data.map((r) => r.warehouseId));
    return Array.from(ids);
  }, [data?.data]);

  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    if (!skuSearch.trim()) return data.data;
    const q = skuSearch.trim().toLowerCase();
    return data.data.filter((r) => r.sku.toLowerCase().includes(q));
  }, [data?.data, skuSearch]);

  const adjustMutation = useAdjustStock();

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustRow) return;
    const reserved = adjustRow.reservedQty;
    if (newAvailable < reserved) {
      toast.error(t("inventory.cannotSetBelowReserved", { reserved: String(reserved) }));
      return;
    }
    if (!reason.trim()) {
      toast.error(t("inventory.reasonRequired"));
      return;
    }
    try {
      await adjustMutation.mutateAsync({
        warehouseId: adjustRow.warehouseId,
        variantId: adjustRow.variantId,
        newAvailableQty: newAvailable,
        reason: reason.trim(),
      });
      toast.success(t("inventory.stockAdjusted", { sku: adjustRow.sku }));
      setAdjustRow(null);
      setNewAvailable(0);
      setReason("");
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errorCode === "STOCK_BELOW_RESERVED" || err.status === 422) {
          toast.error(err.message);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error(t("errors.failedToAdjustStock"));
      }
    }
  };

  const openAdjust = (row: WarehouseStock) => {
    setAdjustRow(row);
    setNewAvailable(row.availableQty);
    setReason("");
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : t("errors.failedToLoadStock")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("admin.inventory")}</h1>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder={t("filters.searchBySku")}
          value={skuSearch}
          onChange={(e) => setSkuSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={warehouseFilter}
          onChange={(e) => {
            setWarehouseFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">{t("filters.allWarehouses")}</option>
          {warehouses.map((wid) => (
            <option key={wid} value={wid}>
              {wid}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : !data?.data.length ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground">
          {t("inventory.noStock")}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("table.variantSku")}</th>
                  <th className="hidden px-4 py-2 text-left font-medium md:table-cell">{t("inventory.warehouseId")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("inventory.available")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("inventory.reserved")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("inventory.free")}</th>
                  {canAdjust && (
                    <th className="px-4 py-2 text-right font-medium">{t("table.actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row) => (
                  <tr key={`${row.variantId}-${row.warehouseId}`} className="border-b last:border-0">
                    <td className="px-4 py-2" title={row.variantId}>
                      {row.productName ? (
                        <span>{row.productName} <span className="font-mono text-muted-foreground text-xs">({row.sku})</span></span>
                      ) : (
                        <span className="font-mono">{row.sku}</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2 font-mono text-muted-foreground text-xs md:table-cell" title={row.warehouseId}>
                      {row.warehouseId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2 text-right">{row.availableQty}</td>
                    <td className="px-4 py-2 text-right">{row.reservedQty}</td>
                    <td className="px-4 py-2 text-right">
                      <FreeQtyCell
                        available={row.availableQty}
                        reserved={row.reservedQty}
                      />
                    </td>
                    {canAdjust && (
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openAdjust(row)}>
                          {t("inventory.adjust")}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pagination.totalPages > 1 && (
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
                {t("common.pageOf", { page: data.pagination.page, total: data.pagination.totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Adjust Stock Dialog */}
      <Dialog open={!!adjustRow} onOpenChange={(o) => !o && setAdjustRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("inventory.adjustStockFor", { sku: adjustRow?.sku ?? "" })}</DialogTitle>
          </DialogHeader>
          {adjustRow && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="rounded bg-muted/50 p-3 text-sm">
                <p>{t("inventory.currentAvailable")}: {adjustRow.availableQty}</p>
                <p>{t("inventory.currentReserved")}: {adjustRow.reservedQty}</p>
                <p>
                  {t("inventory.currentFree")}:{" "}
                  <FreeQtyCell
                    available={adjustRow.availableQty}
                    reserved={adjustRow.reservedQty}
                  />
                </p>
              </div>
              <div>
                <Label htmlFor="adjust-new">{t("inventory.newAvailableQty")}</Label>
                <Input
                  id="adjust-new"
                  type="number"
                  min={0}
                  value={newAvailable}
                  onChange={(e) => setNewAvailable(Number(e.target.value) || 0)}
                  className="mt-1"
                />
                {newAvailable < adjustRow.reservedQty && newAvailable >= 0 && (
                  <p className="mt-1 text-sm text-amber-600">
                    {t("inventory.cannotSetBelowReserved", { reserved: String(adjustRow.reservedQty) })}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="adjust-reason">{t("inventory.reasonRequiredLabel")}</Label>
                <textarea
                  id="adjust-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdjustRow(null)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    adjustMutation.isPending ||
                    newAvailable < adjustRow.reservedQty ||
                    !reason.trim()
                  }
                >
                  {t("inventory.adjust")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
