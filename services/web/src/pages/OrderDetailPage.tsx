import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import {
  useOrder,
  useSubmitOrder,
  useApproveOrder,
  useRejectOrder,
  useFulfillOrder,
  useCancelOrder,
  useReturnOrder,
  useOverrideLinePrice,
  useDeleteOrder,
} from "@/api/hooks";
import type { Order, OrderLineItem } from "@/types/orders";
import type { InsufficientStockDetail } from "@/types/orders";
import { ApiError } from "@/api/client";
import { getErrorMessage } from "@/lib/error-messages";
import { formatDateTime } from "@/lib/format-date";
import { formatPrice } from "@/lib/format-currency";
import { displayName } from "@/lib/display-name";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/useTranslation";

function orderTotal(order: Order): number {
  return order.lineItems.reduce((sum, li) => sum + (li.finalPrice ?? 0) * li.qty, 0);
}

function StatusBadge({ status, t }: { status: Order["status"]; t: (k: string) => string }) {
  const variant: Record<Order["status"], string> = {
    draft: "bg-slate-100 text-slate-600",
    submitted: "bg-primary/10 text-primary",
    approved: "bg-emerald-50 text-emerald-600",
    fulfilled: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-50 text-red-600",
    cancelled: "bg-amber-50 text-amber-600",
    returned: "bg-orange-50 text-orange-600",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold", variant[status])}>
      {t(`orders.status.${status}`)}
    </span>
  );
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = id ?? null;
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [fulfillOpen, setFulfillOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [insufficientStockDetails, setInsufficientStockDetails] = useState<InsufficientStockDetail[] | null>(null);
  const [overrideLineItem, setOverrideLineItem] = useState<OrderLineItem | null>(null);
  const [overridePrice, setOverridePrice] = useState("");

  const { data: order, isLoading, isError, error, refetch } = useOrder(orderId);
  const submitOrder = useSubmitOrder(orderId);
  const approveOrder = useApproveOrder(orderId);
  const rejectOrder = useRejectOrder(orderId);
  const fulfillOrder = useFulfillOrder(orderId);
  const cancelOrder = useCancelOrder(orderId);
  const returnOrder = useReturnOrder(orderId);
  const overridePriceMutation = useOverrideLinePrice(orderId, overrideLineItem?.id ?? null);
  const deleteOrder = useDeleteOrder();

  const isAgentOwnDraft = role === "agent" && user?.id === order?.agentId && order?.status === "draft";
  const isManager = role === "manager";
  const canCancelReturn = role === "manager" || role === "admin" || role === "super_admin";
  const canVersionEdit = (role === "admin" || role === "super_admin") && order?.status === "approved";
  const canSeeVersionHistory = (role === "manager" || role === "admin" || role === "super_admin") && (order?.currentVersion ?? 0) > 1;

  const handleSubmit = () => {
    submitOrder.mutate(undefined, {
      onSuccess: () => {
        setSubmitOpen(false);
        toast.success(t("orders.submittedForApproval"));
      },
      onError: (e) => {
        toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t));
      },
    });
  };

  const handleApprove = () => {
    if (!order) return;
    approveOrder.mutate(
      { versionLock: order.versionLock },
      {
        onSuccess: () => {
          setApproveOpen(false);
          setInsufficientStockDetails(null);
          toast.success(t("orders.approvedStockReserved"));
        },
        onError: (e) => {
          if (e instanceof ApiError && e.errorCode === "INSUFFICIENT_STOCK" && e.details) {
            setInsufficientStockDetails(e.details as InsufficientStockDetail[]);
          } else if (e instanceof ApiError && e.errorCode === "OPTIMISTIC_LOCK_CONFLICT") {
            setApproveOpen(false);
            toast.info(t("orders.modifiedRefreshing"));
            void refetch();
          } else {
            toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t));
          }
        },
      }
    );
  };

  const handleReject = () => {
    rejectOrder.mutate(
      { reason: rejectReason || undefined },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setRejectReason("");
          toast.success(t("orders.rejected"));
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
      }
    );
  };

  const handleFulfill = () => {
    fulfillOrder.mutate(undefined, {
      onSuccess: () => {
        setFulfillOpen(false);
        toast.success(t("orders.fulfilled"));
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
    });
  };

  const handleCancel = () => {
    cancelOrder.mutate(undefined, {
      onSuccess: () => {
        setCancelOpen(false);
        toast.success(t("orders.cancelledStockReleased"));
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
    });
  };

  const handleReturn = () => {
    returnOrder.mutate(undefined, {
      onSuccess: () => {
        setReturnOpen(false);
        toast.success(t("orders.markedReturned"));
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
    });
  };

  const handleDelete = () => {
    if (!id) return;
    deleteOrder.mutate(id, {
      onSuccess: () => {
        setDeleteOpen(false);
        toast.success(t("orders.draftDeleted"));
        window.location.href = "/orders";
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
    });
  };

  const handleOverrideConfirm = () => {
    const num = parseFloat(overridePrice);
    if (Number.isNaN(num) || num < 0 || !overrideLineItem) return;
    overridePriceMutation.mutate(
      { overridePrice: num },
      {
        onSuccess: () => {
          setOverrideLineItem(null);
          setOverridePrice("");
          toast.success(t("orders.priceOverridden", { sku: overrideLineItem.sku }));
          void refetch();
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
      }
    );
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : t("errors.failedToLoadOrder")}
      </div>
    );
  }

  if (isLoading || !order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const lineTotal = (li: OrderLineItem) => (li.finalPrice ?? 0) * li.qty;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/orders">{t("orders.backToOrders")}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} t={t} />
              {canSeeVersionHistory && (
                <span className="text-muted-foreground text-sm">
                  {t("orders.versionLabel", { version: String(order.currentVersion ?? 1) })}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAgentOwnDraft && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/orders/${order.id}/edit`}>{t("common.edit")}</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSubmitOpen(true)}>
                  {t("orders.submit")}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  {t("common.delete")}
                </Button>
              </>
            )}
            {order.status === "submitted" && isManager && (
              <>
                <Button size="sm" onClick={() => setApproveOpen(true)}>
                  {t("orders.approve")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)}>
                  {t("orders.reject")}
                </Button>
              </>
            )}
            {order.status === "approved" && isManager && (
              <>
                <Button size="sm" onClick={() => setFulfillOpen(true)}>
                  {t("orders.fulfill")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                  {t("orders.cancel")}
                </Button>
              </>
            )}
            {order.status === "approved" && canVersionEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/orders/${order.id}/version-edit`}>{t("orders.editNewVersion")}</Link>
              </Button>
            )}
            {order.status === "approved" && canCancelReturn && role !== "manager" && (
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
            {order.status === "fulfilled" && canCancelReturn && (
              <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}>
                {t("orders.return")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">{t("orderDetail.client")}:</span>{" "}
              <span title={order.clientId}>{displayName(order.clientName, order.clientId)}</span>
            </p>
            {order.agentId != null && (
              <p>
                <span className="text-muted-foreground">{t("orderDetail.agent")}:</span>{" "}
                <span title={order.agentId}>{displayName(order.agentName, order.agentId)}</span>
              </p>
            )}
            <p><span className="text-muted-foreground">{t("orderDetail.created")}:</span> {formatDateTime(order.createdAt)}</p>
            <p><span className="text-muted-foreground">{t("orderDetail.updated")}:</span> {formatDateTime(order.updatedAt)}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">{t("table.sku")}</th>
                  <th className="px-2 py-1 text-left">{t("table.productVariant")}</th>
                  <th className="px-2 py-1 text-right">{t("table.qty")}</th>
                  <th className="px-2 py-1 text-right">{t("table.unit")}</th>
                  {order.lineItems.length > 0 && "basePrice" in order.lineItems[0] && order.lineItems[0].basePrice != null && (
                    <>
                      <th className="px-2 py-1 text-right">{t("table.basePrice")}</th>
                      <th className="px-2 py-1 text-right">{t("table.discount")}</th>
                    </>
                  )}
                  <th className="px-2 py-1 text-right">{t("table.finalPrice")}</th>
                  <th className="px-2 py-1 text-right">{t("table.lineTotal")}</th>
                  {order.status === "submitted" && isManager && <th className="px-2 py-1"></th>}
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((li) => (
                  <tr key={li.id} className="border-b">
                    <td className="px-2 py-1 font-mono">{li.sku}</td>
                    <td className="px-2 py-1">{li.sku}</td>
                    <td className="px-2 py-1 text-right">{li.qty}</td>
                    <td className="px-2 py-1 text-right">{li.unitType}</td>
                    {li.basePrice != null && (
                      <>
                        <td className="px-2 py-1 text-right">{formatPrice(li.basePrice)}</td>
                        <td className="px-2 py-1 text-right">{formatPrice(li.groupDiscount ?? 0)}</td>
                      </>
                    )}
                    <td className="px-2 py-1 text-right">{(li.finalPrice ?? 0).toFixed(2)}</td>
                    <td className="px-2 py-1 text-right">{lineTotal(li).toFixed(2)}</td>
                    {order.status === "submitted" && isManager && (
                      <td className="px-2 py-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setOverrideLineItem(li);
                            setOverridePrice(String(li.finalPrice ?? ""));
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-right font-medium">{t("orderDetail.orderTotal")}: {formatPrice(orderTotal(order))}</p>

          {order.notes && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">{t("orderDetail.notes")}</h3>
              <p className="mt-1 text-sm">{order.notes}</p>
            </div>
          )}

          {canSeeVersionHistory && (
            <div>
              <Button variant="link" size="sm" asChild className="p-0 h-auto">
                <Link to={`/orders/${order.id}/versions`}>{t("orderDetail.viewVersionHistory")}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {insufficientStockDetails && insufficientStockDetails.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">{t("orderDetail.insufficientStock")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{t("orderDetail.approvalBlocked")}</p>
            <ul className="mt-2 list-inside list-disc text-sm">
              {insufficientStockDetails.map((d) => (
                <li key={d.lineItemId}>
                  SKU {d.sku}: requested {d.requestedQty}, available {d.availableQty}, reserved {d.reservedQty}.
                  Free stock: {d.availableQty - d.reservedQty}
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setInsufficientStockDetails(null)}>
              {t("orderDetail.dismiss")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Submit confirm */}
      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orderDetail.submitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("orderDetail.submitDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitOrder.isPending}>{t("orders.submit")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve confirm */}
      <AlertDialog open={approveOpen} onOpenChange={(open) => { setApproveOpen(open); if (!open) setInsufficientStockDetails(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orderDetail.approveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("orderDetail.approveDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approveOrder.isPending}>{t("orders.approve")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orderDetail.rejectTitle")}</DialogTitle>
          </DialogHeader>
          <Label>{t("orderDetail.rejectReason")}</Label>
          <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t("orderDetail.reasonPlaceholder")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectOrder.isPending}>{t("orders.reject")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill confirm */}
      <AlertDialog open={fulfillOpen} onOpenChange={setFulfillOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orderDetail.fulfillTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orderDetail.fulfillDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleFulfill} disabled={fulfillOrder.isPending}>{t("orders.fulfill")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirm */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orderDetail.cancelOrderTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orderDetail.cancelDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelOrder.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("orders.cancelOrder")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return confirm */}
      <AlertDialog open={returnOpen} onOpenChange={setReturnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orderDetail.returnTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orderDetail.returnDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturn} disabled={returnOrder.isPending}>{t("orders.return")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders.deleteDraftTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders.deleteDraftDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteOrder.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Override price dialog */}
      <Dialog open={!!overrideLineItem} onOpenChange={(open) => !open && setOverrideLineItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orderDetail.overridePriceFor", { sku: overrideLineItem?.sku ?? "" })}</DialogTitle>
          </DialogHeader>
          <Label>{t("orderDetail.overridePrice")}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={0.01}
              value={overridePrice}
              onChange={(e) => setOverridePrice(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">֏</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideLineItem(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleOverrideConfirm} disabled={overridePriceMutation.isPending}>{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
