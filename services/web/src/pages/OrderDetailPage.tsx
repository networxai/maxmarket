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

function StatusBadge({ status }: { status: Order["status"] }) {
  const variant: Record<Order["status"], string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    fulfilled: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    returned: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  };
  return (
    <span className={cn("rounded px-2 py-0.5 text-xs font-medium", variant[status])}>
      {status}
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
        toast.success("Order submitted for approval");
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
          toast.success("Order approved. Stock reserved.");
        },
        onError: (e) => {
          if (e instanceof ApiError && e.errorCode === "INSUFFICIENT_STOCK" && e.details) {
            setInsufficientStockDetails(e.details as InsufficientStockDetail[]);
          } else if (e instanceof ApiError && e.errorCode === "OPTIMISTIC_LOCK_CONFLICT") {
            setApproveOpen(false);
            toast.info("This order was modified. Refreshing...");
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
          toast.success("Order rejected");
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
      }
    );
  };

  const handleFulfill = () => {
    fulfillOrder.mutate(undefined, {
      onSuccess: () => {
        setFulfillOpen(false);
        toast.success("Order fulfilled");
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
    });
  };

  const handleCancel = () => {
    cancelOrder.mutate(undefined, {
      onSuccess: () => {
        setCancelOpen(false);
        toast.success("Order cancelled. Stock released.");
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
    });
  };

  const handleReturn = () => {
    returnOrder.mutate(undefined, {
      onSuccess: () => {
        setReturnOpen(false);
        toast.success("Order marked as returned");
      },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
    });
  };

  const handleDelete = () => {
    if (!id) return;
    deleteOrder.mutate(id, {
      onSuccess: () => {
        setDeleteOpen(false);
        toast.success("Draft deleted");
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
          toast.success(`Price overridden for ${overrideLineItem.sku}`);
          void refetch();
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t)),
      }
    );
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : "Failed to load order."}
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
          <Link to="/orders">← Orders</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={order.status} />
              {canSeeVersionHistory && (
                <span className="text-muted-foreground text-sm">
                  Version {order.currentVersion}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAgentOwnDraft && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/orders/${order.id}/edit`}>Edit</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSubmitOpen(true)}>
                  Submit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              </>
            )}
            {order.status === "submitted" && isManager && (
              <>
                <Button size="sm" onClick={() => setApproveOpen(true)}>
                  Approve
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
              </>
            )}
            {order.status === "approved" && isManager && (
              <>
                <Button size="sm" onClick={() => setFulfillOpen(true)}>
                  Fulfill
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                  Cancel
                </Button>
              </>
            )}
            {order.status === "approved" && canVersionEdit && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/orders/${order.id}/version-edit`}>Edit (New Version)</Link>
              </Button>
            )}
            {order.status === "approved" && canCancelReturn && role !== "manager" && (
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
            {order.status === "fulfilled" && canCancelReturn && (
              <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}>
                Return
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm">
            <p>
              <span className="text-muted-foreground">Client:</span>{" "}
              <span title={order.clientId}>{displayName(order.clientName, order.clientId)}</span>
            </p>
            {order.agentId != null && (
              <p>
                <span className="text-muted-foreground">Agent:</span>{" "}
                <span title={order.agentId}>{displayName(order.agentName, order.agentId)}</span>
              </p>
            )}
            <p><span className="text-muted-foreground">Created:</span> {formatDateTime(order.createdAt)}</p>
            <p><span className="text-muted-foreground">Updated:</span> {formatDateTime(order.updatedAt)}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">SKU</th>
                  <th className="px-2 py-1 text-left">Product / Variant</th>
                  <th className="px-2 py-1 text-right">Qty</th>
                  <th className="px-2 py-1 text-right">Unit</th>
                  {order.lineItems.length > 0 && "basePrice" in order.lineItems[0] && order.lineItems[0].basePrice != null && (
                    <>
                      <th className="px-2 py-1 text-right">Base Price</th>
                      <th className="px-2 py-1 text-right">Discount</th>
                    </>
                  )}
                  <th className="px-2 py-1 text-right">Final Price</th>
                  <th className="px-2 py-1 text-right">Line Total</th>
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

          <p className="text-right font-medium">Order total: {formatPrice(orderTotal(order))}</p>

          {order.notes && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
              <p className="mt-1 text-sm">{order.notes}</p>
            </div>
          )}

          {canSeeVersionHistory && (
            <div>
              <Button variant="link" size="sm" asChild className="p-0 h-auto">
                <Link to={`/orders/${order.id}/versions`}>View Version History</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {insufficientStockDetails && insufficientStockDetails.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive">Insufficient stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Approval blocked. The following line items have insufficient stock:</p>
            <ul className="mt-2 list-inside list-disc text-sm">
              {insufficientStockDetails.map((d) => (
                <li key={d.lineItemId}>
                  SKU {d.sku}: requested {d.requestedQty}, available {d.availableQty}, reserved {d.reservedQty}.
                  Free stock: {d.availableQty - d.reservedQty}
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setInsufficientStockDetails(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Submit confirm */}
      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit order?</AlertDialogTitle>
            <AlertDialogDescription>
              Submit this order for approval? Prices will be recalculated based on current group discounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitOrder.isPending}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve confirm */}
      <AlertDialog open={approveOpen} onOpenChange={(open) => { setApproveOpen(open); if (!open) setInsufficientStockDetails(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve order?</AlertDialogTitle>
            <AlertDialogDescription>
              Approve this order? Stock will be reserved for all line items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approveOrder.isPending}>Approve</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject order?</DialogTitle>
          </DialogHeader>
          <Label>Reason (optional)</Label>
          <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectOrder.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill confirm */}
      <AlertDialog open={fulfillOpen} onOpenChange={setFulfillOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as fulfilled?</AlertDialogTitle>
            <AlertDialogDescription>Mark as fulfilled? Stock will be decremented.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFulfill} disabled={fulfillOrder.isPending}>Fulfill</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirm */}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel order?</AlertDialogTitle>
            <AlertDialogDescription>Cancel this order? Reserved stock will be released.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={cancelOrder.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Cancel order</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return confirm */}
      <AlertDialog open={returnOpen} onOpenChange={setReturnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as returned?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark as returned? Note: Stock is not automatically restored. Use Inventory to adjust stock manually if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReturn} disabled={returnOrder.isPending}>Return</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft?</AlertDialogTitle>
            <AlertDialogDescription>Delete this draft? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteOrder.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Override price dialog */}
      <Dialog open={!!overrideLineItem} onOpenChange={(open) => !open && setOverrideLineItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override price for {overrideLineItem?.sku}</DialogTitle>
          </DialogHeader>
          <Label>Override price</Label>
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
            <Button variant="outline" onClick={() => setOverrideLineItem(null)}>Cancel</Button>
            <Button onClick={handleOverrideConfirm} disabled={overridePriceMutation.isPending}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
