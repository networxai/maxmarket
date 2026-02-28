import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type {
  AuditLogsResponse,
  ClearAuditLogsRequest,
  ClearAuditLogsResponse,
} from "@/types/reports";

export interface AuditLogsParams {
  eventType?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeCleared?: boolean;
  page?: number;
  pageSize?: number;
}

export function useAuditLogs(params: AuditLogsParams = {}) {
  const {
    eventType,
    actorId,
    targetType,
    targetId,
    dateFrom,
    dateTo,
    includeCleared = false,
    page = 1,
    pageSize = 20,
  } = params;
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  sp.set("includeCleared", String(includeCleared));
  if (eventType) sp.set("eventType", eventType);
  if (actorId) sp.set("actorId", actorId);
  if (targetType) sp.set("targetType", targetType);
  if (targetId) sp.set("targetId", targetId);
  if (dateFrom) sp.set("dateFrom", dateFrom);
  if (dateTo) sp.set("dateTo", dateTo);
  return useQuery({
    queryKey: [
      "audit",
      "logs",
      eventType ?? null,
      actorId ?? null,
      targetType ?? null,
      targetId ?? null,
      dateFrom ?? null,
      dateTo ?? null,
      includeCleared,
      page,
      pageSize,
    ],
    queryFn: () =>
      apiRequest<AuditLogsResponse>(`/audit/logs?${sp.toString()}`),
  });
}

export function useClearAuditLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClearAuditLogsRequest) =>
      apiRequest<ClearAuditLogsResponse>("/audit/logs/clear", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}
