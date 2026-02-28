import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { StockListResponse, WarehouseStock, AdjustStockRequest } from "@/types/admin";

export interface StockParams {
  page?: number;
  pageSize?: number;
  warehouseId?: string;
  variantId?: string;
  enabled?: boolean;
}

export function useStock(params: StockParams = {}) {
  const { page = 1, pageSize = 20, warehouseId, variantId, enabled = true } = params;
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  if (warehouseId) sp.set("warehouseId", warehouseId);
  if (variantId) sp.set("variantId", variantId);
  return useQuery({
    queryKey: ["inventory", "stock", page, pageSize, warehouseId ?? null, variantId ?? null],
    queryFn: () => apiRequest<StockListResponse>(`/inventory/stock?${sp.toString()}`),
    enabled,
  });
}

function invalidateStock(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["inventory"] });
}

/** Aggregated stock by variant (sum across warehouses). For agent order creation. */
export function useStockByVariant(params?: { enabled?: boolean }) {
  const enabled = params?.enabled ?? true;
  const [allData, setAllData] = React.useState<WarehouseStock[]>([]);
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, error } = useStock({
    page,
    pageSize: 100, // API max per OpenAPI
    enabled,
  });

  // Reset when disabled
  React.useEffect(() => {
    if (!enabled) {
      setAllData([]);
      setPage(1);
    }
  }, [enabled]);

  // Accumulate pages and request next page if more exist
  React.useEffect(() => {
    if (!enabled || !data?.data) return;
    setAllData((prev) => {
      const seen = new Set(prev.map((r) => `${r.variantId}:${r.warehouseId}`));
      const newRows = data.data.filter(
        (r) => !seen.has(`${r.variantId}:${r.warehouseId}`)
      );
      if (newRows.length === 0) return prev;
      return [...prev, ...newRows];
    });
    if (data.pagination && data.pagination.page < data.pagination.totalPages) {
      setPage((p) => p + 1);
    }
  }, [enabled, data?.data, data?.pagination]);

  const stockByVariant = React.useMemo(() => {
    const map = new Map<string, { available: number; reserved: number }>();
    for (const row of allData) {
      const cur = map.get(row.variantId) ?? { available: 0, reserved: 0 };
      map.set(row.variantId, {
        available: cur.available + row.availableQty,
        reserved: cur.reserved + row.reservedQty,
      });
    }
    return map;
  }, [allData]);

  const isLoadingAll =
    isLoading || (enabled && data?.pagination != null && page < (data.pagination.totalPages ?? 1));

  return {
    stockByVariant,
    isLoading: isLoadingAll,
    isError,
    error,
  };
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdjustStockRequest) =>
      apiRequest<WarehouseStock>("/inventory/stock/adjust", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateStock(qc),
  });
}
