import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { LoginRequest, LoginResponse } from "@/types/api";
import { apiRequest } from "@/api/client";

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LoginRequest) => {
      const res = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        skipAuth: true,
        skipRefreshRetry: true,
        body: JSON.stringify(body),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "" }),
        credentials: "include",
      });
    },
    onSettled: () => {
      queryClient.clear();
    },
  });
}
