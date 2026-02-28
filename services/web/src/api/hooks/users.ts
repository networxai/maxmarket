import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { AgentClientsResponse } from "@/types/orders";
import type { Role } from "@/types/api";

interface UsersListResponse {
  data: Array<{ id: string; email: string; fullName: string; role: Role }>;
  pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
}

export function useAgentClients(agentId: string | null, page = 1, pageSize = 100) {
  return useQuery({
    queryKey: ["users", agentId, "clients", page, pageSize],
    queryFn: () =>
      apiRequest<AgentClientsResponse>(
        `/users/${agentId}/clients?page=${page}&pageSize=${pageSize}`
      ),
    enabled: !!agentId,
  });
}

export function useUsersList(params: { role?: Role; page?: number; pageSize?: number; enabled?: boolean }) {
  const { role, page = 1, pageSize = 100, enabled = true } = params;
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  if (role) sp.set("role", role);
  return useQuery({
    queryKey: ["users", "list", role ?? null, page, pageSize],
    queryFn: () => apiRequest<UsersListResponse>(`/users?${sp.toString()}`),
    enabled: enabled && pageSize > 0,
  });
}
