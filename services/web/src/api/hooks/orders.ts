import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type {
  Order,
  OrdersListResponse,
  OrderVersionsListResponse,
  OrderVersionDetail,
  CreateOrderRequest,
  UpdateOrderRequest,
  ApproveOrderRequest,
  RejectOrderRequest,
  OverridePriceRequest,
} from "@/types/orders";

export interface OrdersParams {
  page?: number;
  pageSize?: number;
  status?: string;
  clientId?: string;
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildOrdersQuery(params: OrdersParams): string {
  const p = new URLSearchParams();
  p.set("page", String(params.page ?? 1));
  p.set("pageSize", String(params.pageSize ?? 20));
  if (params.status) p.set("status", params.status);
  if (params.clientId) p.set("clientId", params.clientId);
  if (params.agentId) p.set("agentId", params.agentId);
  if (params.dateFrom) p.set("dateFrom", params.dateFrom);
  if (params.dateTo) p.set("dateTo", params.dateTo);
  return p.toString();
}

export function useOrders(params: OrdersParams = {}) {
  const qs = buildOrdersQuery(params);
  return useQuery({
    queryKey: ["orders", params.page, params.pageSize, params.status ?? null, params.clientId ?? null, params.agentId ?? null, params.dateFrom ?? null, params.dateTo ?? null],
    queryFn: () => apiRequest<OrdersListResponse>(`/orders?${qs}`),
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => apiRequest<Order>(`/orders/${id}`),
    enabled: !!id,
  });
}

export function useOrderVersions(orderId: string | null, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["orders", orderId, "versions", page, pageSize],
    queryFn: () =>
      apiRequest<OrderVersionsListResponse>(`/orders/${orderId}/versions?page=${page}&pageSize=${pageSize}`),
    enabled: !!orderId,
  });
}

export function useOrderVersion(orderId: string | null, versionNumber: number | null) {
  return useQuery({
    queryKey: ["orders", orderId, "versions", versionNumber],
    queryFn: () => apiRequest<OrderVersionDetail>(`/orders/${orderId}/versions/${versionNumber}`),
    enabled: !!orderId && versionNumber != null && versionNumber >= 1,
  });
}

function invalidateOrders(qc: ReturnType<typeof useQueryClient>, id?: string) {
  void qc.invalidateQueries({ queryKey: ["orders"] });
  if (id) void qc.invalidateQueries({ queryKey: ["order", id] });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderRequest) =>
      apiRequest<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateOrders(qc),
  });
}

export function useUpdateOrder(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrderRequest) =>
      apiRequest<Order>(`/orders/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => invalidateOrders(qc, id ?? undefined),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => apiRequest(`/orders/${orderId}`, { method: "DELETE" }),
    onSuccess: () => invalidateOrders(qc),
  });
}

export function useSubmitOrder(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<Order>(`/orders/${id}/submit`, { method: "POST" }),
    onSuccess: () => invalidateOrders(qc, id ?? undefined),
  });
}

export function useApproveOrder(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApproveOrderRequest) =>
      apiRequest<Order>(`/orders/${id}/approve`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateOrders(qc, id ?? undefined),
  });
}

export function useRejectOrder(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RejectOrderRequest) =>
      apiRequest<Order>(`/orders/${id}/reject`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateOrders(qc, id ?? undefined),
  });
}

export function useFulfillOrder(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<Order>(`/orders/${id}/fulfill`, { method: "POST" }),
    onSuccess: () => invalidateOrders(qc, id ?? undefined),
  });
}

export function useCancelOrder(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<Order>(`/orders/${id}/cancel`, { method: "POST" }),
    onSuccess: () => invalidateOrders(qc, id ?? undefined),
  });
}

export function useReturnOrder(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<Order>(`/orders/${id}/return`, { method: "POST" }),
    onSuccess: () => invalidateOrders(qc, id ?? undefined),
  });
}

export function useOverrideLinePrice(orderId: string | null, lineItemId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OverridePriceRequest) =>
      apiRequest(`/orders/${orderId}/line-items/${lineItemId}/override-price`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => orderId && invalidateOrders(qc, orderId),
  });
}
