import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";

export function useUiStrings(language: string) {
  return useQuery({
    queryKey: ["i18n", "ui-strings", language],
    queryFn: () =>
      apiRequest<Record<string, string>>(
        `/i18n/ui-strings?language=${language}`
      ),
    enabled: !!language,
  });
}

export function useUpdateUiStrings() {
  return useMutation({
    mutationFn: (body: {
      language: string;
      strings: Record<string, string>;
    }) =>
      apiRequest(`/i18n/ui-strings`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  });
}
