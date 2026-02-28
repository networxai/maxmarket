import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type { User, PaginationMeta } from "@/types/api";
import type { CreateUserRequest, UpdateUserRequest } from "@/types/admin";

interface UsersListResponse {
  data: User[];
  pagination: PaginationMeta;
}

export interface UsersParams {
  page?: number;
  pageSize?: number;
  role?: string;
  isActive?: boolean;
}

export function useUsers(params: UsersParams = {}) {
  const { page = 1, pageSize = 20, role, isActive } = params;
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));
  if (role) sp.set("role", role);
  if (typeof isActive === "boolean") sp.set("isActive", String(isActive));
  return useQuery({
    queryKey: ["users", "admin", page, pageSize, role ?? null, isActive],
    queryFn: () => apiRequest<UsersListResponse>(`/users?${sp.toString()}`),
  });
}

export function useUser(id: string | null) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => apiRequest<User>(`/users/${id}`),
    enabled: !!id,
  });
}

function invalidateUsers(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["users"] });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserRequest) =>
      apiRequest<User>("/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useUpdateUser(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateUserRequest) =>
      apiRequest<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidateUsers(qc);
      if (id) void qc.invalidateQueries({ queryKey: ["user", id] });
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useAssignClientToAgent(agentId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      apiRequest(`/users/${agentId}/clients/${clientId}`, { method: "POST" }),
    onSuccess: () => {
      invalidateUsers(qc);
      if (agentId) void qc.invalidateQueries({ queryKey: ["users", agentId, "clients"] });
    },
  });
}

export function useRemoveClientFromAgent(agentId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      apiRequest(`/users/${agentId}/clients/${clientId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateUsers(qc);
      if (agentId) void qc.invalidateQueries({ queryKey: ["users", agentId, "clients"] });
    },
  });
}
