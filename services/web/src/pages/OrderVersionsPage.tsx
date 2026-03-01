import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOrder, useOrderVersions, useOrderVersion } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format-date";
import { formatPrice } from "@/lib/format-currency";
import { useTranslation } from "@/i18n/useTranslation";

export function OrderVersionsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  const orderId = id ?? null;
  const { data: order, isLoading: orderLoading } = useOrder(orderId);
  const { data: versionsData, isLoading: versionsLoading } = useOrderVersions(orderId);
  const { data: versionDetail } = useOrderVersion(orderId, selectedVersion);

  if (orderLoading || !order) {
    return <Skeleton className="h-48 w-full" />;
  }

  const versions = versionsData?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/orders/${id}`}>{t("orderVersions.backToOrder", { number: order.orderNumber })}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("orderVersions.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {versionsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("orderVersions.empty")}</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.versionNumber}
                  className={cn(
                    "flex items-center justify-between rounded border p-2",
                    selectedVersion === v.versionNumber && "border-primary bg-muted/50"
                  )}
                >
                  <div>
                    <span className="font-medium">{t("orderVersions.versionNumber", { number: String(v.versionNumber) })}</span>
                    <span className="text-muted-foreground text-sm"> · {v.diffSummary}</span>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(v.createdAt)} · by {v.createdByUserId}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedVersion(selectedVersion === v.versionNumber ? null : v.versionNumber)}
                  >
                    {selectedVersion === v.versionNumber ? t("common.hide") : t("common.view")}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {selectedVersion != null && versionDetail && (
            <div className="mt-4 rounded border p-4">
              <h3 className="font-medium">{t("orderVersions.snapshotTitle", { number: String(versionDetail.versionNumber) })}</h3>
              <p className="text-muted-foreground text-sm">
                {formatDateTime(versionDetail.createdAt)} · by {versionDetail.createdByUserId}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[300px] text-sm">
                  <thead>
                    <tr className="border-b">
                    <th className="px-2 py-1 text-left">{t("table.sku")}</th>
                    <th className="px-2 py-1 text-right">{t("table.qty")}</th>
                    <th className="px-2 py-1 text-right">{t("table.finalPrice")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionDetail.snapshot.lineItems.map((li) => (
                      <tr key={li.id} className="border-b">
                        <td className="px-2 py-1 font-mono">{li.sku}</td>
                        <td className="px-2 py-1 text-right">{li.qty}</td>
                        <td className="px-2 py-1 text-right">{formatPrice(li.finalPrice ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {versionDetail.diff.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium">{t("orderVersions.changesTitle")}</h4>
                  <ul className="mt-1 list-inside list-disc text-sm">
                    {versionDetail.diff.map((d, i) => (
                      <li key={i}>
                        <span className="font-mono">{d.field}</span>:{" "}
                        <span className="text-muted-foreground line-through">{String(d.oldValue)}</span>
                        {" → "}
                        <span className="font-medium">{String(d.newValue)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
