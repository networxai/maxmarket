import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { SalesReportRow, SalesByManagerRow, SalesReportResponse } from "@/types/reports";

export interface SalesByDateParams {
  dateFrom: string;
  dateTo: string;
  page?: number;
  pageSize?: number;
}

export function useReportSalesByDate(params: SalesByDateParams) {
  const { dateFrom, dateTo, page = 1, pageSize = 20 } = params;
  const sp = new URLSearchParams();
  sp.set("dateFrom", dateFrom);
  sp.set("dateTo", dateTo);
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  return useQuery({
    queryKey: ["reports", "sales-by-date", dateFrom, dateTo, page, pageSize],
    queryFn: () =>
      apiRequest<SalesReportResponse<SalesReportRow>>(
        `/reports/sales-by-date?${sp.toString()}`
      ),
    enabled: !!dateFrom && !!dateTo,
  });
}

export interface SalesByManagerParams {
  managerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useReportSalesByManager(params: SalesByManagerParams = {}) {
  const { managerId, dateFrom, dateTo, page = 1, pageSize = 20 } = params;
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  if (managerId) sp.set("managerId", managerId);
  if (dateFrom) sp.set("dateFrom", dateFrom);
  if (dateTo) sp.set("dateTo", dateTo);
  return useQuery({
    queryKey: ["reports", "sales-by-manager", managerId ?? null, dateFrom ?? null, dateTo ?? null, page, pageSize],
    queryFn: () =>
      apiRequest<SalesReportResponse<SalesByManagerRow>>(
        `/reports/sales-by-manager?${sp.toString()}`
      ),
  });
}

export interface SalesByClientParams {
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useReportSalesByClient(params: SalesByClientParams = {}) {
  const { clientId, dateFrom, dateTo, page = 1, pageSize = 20 } = params;
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  if (clientId) sp.set("clientId", clientId);
  if (dateFrom) sp.set("dateFrom", dateFrom);
  if (dateTo) sp.set("dateTo", dateTo);
  return useQuery({
    queryKey: ["reports", "sales-by-client", clientId ?? null, dateFrom ?? null, dateTo ?? null, page, pageSize],
    queryFn: () =>
      apiRequest<SalesReportResponse<SalesReportRow>>(
        `/reports/sales-by-client?${sp.toString()}`
      ),
  });
}

export interface SalesByProductParams {
  variantId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useReportSalesByProduct(params: SalesByProductParams = {}) {
  const { variantId, dateFrom, dateTo, page = 1, pageSize = 20 } = params;
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  if (variantId) sp.set("variantId", variantId);
  if (dateFrom) sp.set("dateFrom", dateFrom);
  if (dateTo) sp.set("dateTo", dateTo);
  return useQuery({
    queryKey: ["reports", "sales-by-product", variantId ?? null, dateFrom ?? null, dateTo ?? null, page, pageSize],
    queryFn: () =>
      apiRequest<SalesReportResponse<SalesReportRow>>(
        `/reports/sales-by-product?${sp.toString()}`
      ),
  });
}
