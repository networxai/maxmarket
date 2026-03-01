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
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    fulfilled: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    cancelled: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    returned: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variant[status])}>
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
        toast.success(t("orders.draftDeleted"));
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
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{role === "client" ? t("orders.myOrders") : t("orders.orders")}</h2>
          <p className="text-muted-foreground text-sm">{t("pages.orders.description")}</p>
        </div>
        {showNewOrder && (
          <Button asChild>
            <Link to="/orders/new">{t("orders.newOrder")}</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">
        <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={t("table.status")} />
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
          placeholder={t("filters.from")}
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="w-full sm:w-[140px]"
        />
        <Input
          type="date"
          placeholder={t("filters.to")}
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="w-full sm:w-[140px]"
        />
        {canFilterClient && (role === "admin" || role === "super_admin") && clientsData?.data && (
          <Select value={clientId || "all"} onValueChange={(v) => { setClientId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("table.client")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allClients")}</SelectItem>
              {clientsData.data.map((u: { id: string; fullName: string }) => (
                <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canFilterClient && role === "manager" && (
          <Input
            placeholder={t("filters.clientIdPlaceholder")}
            value={clientId}
            onChange={(e) => { setClientId(e.target.value); setPage(1); }}
            className="w-full sm:w-[220px]"
          />
        )}
        {canFilterAgent && agentsData?.data && (
          <Select value={agentId || "all"} onValueChange={(v) => { setAgentId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("table.agent")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.allAgents")}</SelectItem>
              {agentsData.data.map((u: { id: string; fullName: string }) => (
                <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border bg-card py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold">{t("common.noOrders")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("pages.orders.noOrdersMatch")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("table.order")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("table.client")}</th>
                  {role !== "client" && <th className="hidden px-4 py-2 text-left font-medium md:table-cell">{t("table.agent")}</th>}
                  <th className="px-4 py-2 text-left font-medium">{t("table.status")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("table.items")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("table.total")}</th>
                  <th className="hidden px-4 py-2 text-left font-medium md:table-cell">{t("table.created")}</th>
                  {role !== "client" && <th className="px-4 py-2 text-right font-medium">{t("table.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-b transition-colors hover:bg-muted/50"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{displayName(order.clientName ?? clientMap.get(order.clientId), order.clientId)}</td>
                    {role !== "client" && (
                      <td className="hidden px-4 py-2 md:table-cell">{displayName(order.agentName ?? agentMap.get(order.agentId ?? ""), order.agentId)}</td>
                    )}
                    <td className="px-4 py-2"><StatusBadge status={order.status} t={t} /></td>
                    <td className="px-4 py-2 text-right">{order.lineItems.length}</td>
                    <td className="px-4 py-2 text-right">{formatPrice(orderTotal(order))}</td>
                    <td className="hidden px-4 py-2 md:table-cell">{formatDate(order.createdAt)}</td>
                    {role !== "client" && (
                      <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {order.status === "draft" && role === "agent" && user?.id === order.agentId && (
                          <>
                            <Button variant="link" size="sm" asChild className="p-0 h-auto">
                              <Link to={`/orders/${order.id}/edit`}>{t("common.edit")}</Link>
                            </Button>
                            <span className="mx-1">|</span>
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-destructive"
                              onClick={() => setDeleteOrderId(order.id)}
                            >
                              {t("common.delete")}
                            </Button>
                          </>
                        )}
                        {order.status === "submitted" && role === "manager" && (
                          <Button variant="link" size="sm" asChild className="p-0 h-auto">
                            <Link to={`/orders/${order.id}`}>{t("orders.review")}</Link>
                          </Button>
                        )}
                        {order.status === "approved" && role === "manager" && (
                          <Button variant="link" size="sm" asChild className="p-0 h-auto">
                            <Link to={`/orders/${order.id}`}>{t("orders.fulfillCancel")}</Link>
                          </Button>
                        )}
                        {order.status === "approved" && (role === "admin" || role === "super_admin") && (
                          <Button variant="link" size="sm" asChild className="p-0 h-auto">
                            <Link to={`/orders/${order.id}/version-edit`}>{t("orders.editNewVersion")}</Link>
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t("common.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("common.pageOfWithTotal", {
                  page: pagination.page,
                  total: pagination.totalPages,
                  totalCount: pagination.totalCount,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orders.deleteDraftTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("orders.deleteDraftDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={deleteOrder.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
