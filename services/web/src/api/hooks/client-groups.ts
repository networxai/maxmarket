import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { ClientGroup, ClientGroupsListResponse, CreateClientGroupRequest, UpdateClientGroupRequest } from "@/types/admin";

export interface ClientGroupsParams {
  page?: number;
  pageSize?: number;
}

export function useClientGroups(params: ClientGroupsParams = {}) {
  const { page = 1, pageSize = 20 } = params;
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  return useQuery({
    queryKey: ["client-groups", page, pageSize],
    queryFn: () => apiRequest<ClientGroupsListResponse>(`/client-groups?${sp.toString()}`),
  });
}

function invalidateClientGroups(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["client-groups"] });
}

export function useCreateClientGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClientGroupRequest) =>
      apiRequest<ClientGroup>("/client-groups", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateClientGroups(qc),
  });
}

export function useUpdateClientGroup(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateClientGroupRequest) =>
      apiRequest<ClientGroup>(`/client-groups/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => invalidateClientGroups(qc),
  });
}

export function useDeleteClientGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/client-groups/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateClientGroups(qc),
  });
}
