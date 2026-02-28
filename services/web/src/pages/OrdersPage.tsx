import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import {
  useOrders,
  useDeleteOrder,
  useUsersList,
  useAgentClients,
} from "@/api/hooks";
import type { Order } from "@/types/orders";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/error-messages";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/format-date";
import { formatPrice } from "@/lib/format-currency";
import { displayName } from "@/lib/display-name";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/useTranslation";

const STATUS_VALUES = ["", "draft", "submitted", "approved", "fulfilled", "rejected", "cancelled", "returned"] as const;

function getStatusOptions(t: (k: string) => string) {
  return [
    { value: "", label: t("common.allStatuses") },
    ...STATUS_VALUES.filter(Boolean).map((v) => ({
      value: v,
      label: t(`orders.status.${v}`),
    })),
  ];
}

function orderTotal(order: Order): number {
  return order.lineItems.reduce((sum, li) => sum + (li.finalPrice ?? 0) * li.qty, 0);
}

function StatusBadge({ status, t }: { status: Order["status"]; t: (k: string) => string }) {
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
      {t(`orders.status.${status}`)}
    </span>
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const statusOptions = getStatusOptions(t);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [clientId, setClientId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);

  const canFilterClient = role === "manager" || role === "admin" || role === "super_admin";
  const canFilterAgent = role === "admin" || role === "super_admin";
  const showNewOrder = role === "agent";

  const { data: ordersData, isLoading, isError, error } = useOrders({
    page,
    pageSize: 20,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    clientId: clientId || undefined,
    agentId: agentId || undefined,
  });

  const { data: clientsData } = useUsersList({
    role: "client",
    pageSize: 200,
    enabled: role === "admin" || role === "super_admin",
  });
  const { data: agentsData } = useUsersList({
    role: "agent",
    pageSize: 200,
    enabled: canFilterAgent,
  });
  const { data: agentClientsData } = useAgentClients(role === "agent" && user ? user.id : null, 1, 200);

  const clientMap = new Map<string, string>();
  if (clientsData?.data) for (const u of clientsData.data) clientMap.set(u.id, u.fullName);
  if (agentClientsData?.data) for (const u of agentClientsData.data) clientMap.set(u.id, u.fullName);
  const agentMap = new Map<string, string>();
  if (agentsData?.data) for (const u of agentsData.data) agentMap.set(u.id, u.fullName);

  const deleteOrder = useDeleteOrder();

  const handleDeleteConfirm = () => {
    if (!deleteOrderId) return;
    deleteOrder.mutate(deleteOrderId, {
      onSuccess: () => {
        setDeleteOrderId(null);
        toast.success("Draft deleted");
        navigate("/orders");
      },
      onError: (e) => {
        toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t));
      },
    });
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : t("errors.failedToLoad")}
      </div>
    );
  }

  const orders = ordersData?.data ?? [];
  const pagination = ordersData?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{role === "client" ? t("orders.myOrders") : t("orders.orders")}</h1>
        {showNewOrder && (
          <Button asChild>
            <Link to="/orders/new">{t("orders.newOrder")}</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value || "all"} value={opt.value || "all"}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          placeholder="From"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="w-[140px]"
        />
        <Input
          type="date"
          placeholder="To"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="w-[140px]"
        />
        {canFilterClient && (role === "admin" || role === "super_admin") && clientsData?.data && (
          <Select value={clientId || "all"} onValueChange={(v) => { setClientId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clientsData.data.map((u: { id: string; fullName: string }) => (
                <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canFilterClient && role === "manager" && (
          <Input
            placeholder="Client ID (UUID)"
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setPage(1); }}
            className="w-[220px]"
          />
        )}
        {canFilterAgent && agentsData?.data && (
          <Select value={agentId || "all"} onValueChange={(v) => { setAgentId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agentsData.data.map((u: { id: string; fullName: string }) => (
                <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground">
          {t("common.noOrders")}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Order</th>
                  <th className="px-4 py-2 text-left font-medium">Client</th>
                  {role !== "client" && <th className="px-4 py-2 text-left font-medium">Agent</th>}
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Items</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-left font-medium">Created</th>
                  {role !== "client" && <th className="px-4 py-2 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{displayName(order.clientName ?? clientMap.get(order.clientId), order.clientId)}</td>
                    {role !== "client" && (
                      <td className="px-4 py-2">{displayName(order.agentName ?? agentMap.get(order.agentId ?? ""), order.agentId)}</td>
                    )}
                    <td className="px-4 py-2"><StatusBadge status={order.status} t={t} /></td>
                    <td className="px-4 py-2 text-right">{order.lineItems.length}</td>
                    <td className="px-4 py-2 text-right">{formatPrice(orderTotal(order))}</td>
                    <td className="px-4 py-2">{formatDate(order.createdAt)}</td>
                    {role !== "client" && (
                      <td className="px-4 py-2 text-right">
                        {order.status === "draft" && role === "agent" && user?.id === order.agentId && (
                          <>
                            <Button variant="link" size="sm" asChild className="p-0 h-auto">
                              <Link to={`/orders/${order.id}/edit`}>Edit</Link>
                            </Button>
                            <span className="mx-1">|</span>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-destructive"
                              onClick={() => setDeleteOrderId(order.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                        {order.status === "submitted" && role === "manager" && (
                          <Button variant="link" size="sm" asChild className="p-0 h-auto">
                            <Link to={`/orders/${order.id}`}>Review</Link>
                          </Button>
                        )}
                        {order.status === "approved" && role === "manager" && (
                          <Button variant="link" size="sm" asChild className="p-0 h-auto">
                            <Link to={`/orders/${order.id}`}>Fulfill / Cancel</Link>
                          </Button>
                        )}
                        {order.status === "approved" && (role === "admin" || role === "super_admin") && (
                          <Button variant="link" size="sm" asChild className="p-0 h-auto">
                            <Link to={`/orders/${order.id}/version-edit`}>Edit (New Version)</Link>
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} total)
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this draft? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteOrder.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
