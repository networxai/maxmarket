import { API_BASE_URL, API_PREFIX, CORRELATION_ID_HEADER } from "./constants";

export type ReportType =
  | "sales-by-date"
  | "sales-by-manager"
  | "sales-by-client"
  | "sales-by-product";

export interface ExportParams {
  format: "csv" | "pdf";
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  variantId?: string;
  managerId?: string;
}

export async function downloadReportFile(
  reportType: ReportType,
  params: ExportParams,
  accessToken: string
): Promise<void> {
  const q: Record<string, string> = { format: params.format };
  if (params.dateFrom) q.dateFrom = params.dateFrom;
  if (params.dateTo) q.dateTo = params.dateTo;
  if (params.clientId) q.clientId = params.clientId;
  if (params.variantId) q.variantId = params.variantId;
  if (params.managerId) q.managerId = params.managerId;
  const query = new URLSearchParams(q);
  const url = `${API_BASE_URL}${API_PREFIX}/reports/${reportType}/export?${query.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      [CORRELATION_ID_HEADER]: crypto.randomUUID(),
    },
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    let error: { message?: string; errorCode?: string };
    try {
      error = JSON.parse(text);
    } catch {
      error = { message: text || res.statusText };
    }
    throw Object.assign(new Error(error.message ?? "Export failed"), {
      status: res.status,
      errorCode: error.errorCode,
    });
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `${reportType}_${params.dateFrom ?? "all"}_to_${params.dateTo ?? "all"}.${params.format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
