import { useState } from "react";
import { toast } from "sonner";
import {
  useClientGroups,
  useCreateClientGroup,
  useUpdateClientGroup,
  useDeleteClientGroup,
} from "@/api/hooks";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { ApiError } from "@/api/client";
import type { ClientGroup } from "@/types/admin";
import { useTranslation } from "@/i18n/useTranslation";

function formatDiscount(group: ClientGroup): string {
  if (group.discountType === "percentage") {
    return `${group.discountValue}%`;
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(group.discountValue);
}

export function ClientGroupsAdminPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ClientGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<ClientGroup | null>(null);

  const canMutate = role === "super_admin" || role === "admin";

  const { data, isLoading, isError, error, refetch } = useClientGroups({
    page,
    pageSize: 20,
  });
  const createMutation = useCreateClientGroup();
  const updateMutation = useUpdateClientGroup(editGroup?.id ?? null);
  const deleteMutation = useDeleteClientGroup();

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const discountType = fd.get("discountType") as "fixed" | "percentage";
    const discountValue = Number(fd.get("discountValue"));
    if (!name || discountValue < 0) return;
    try {
      await createMutation.mutateAsync({ name, discountType, discountValue });
      setCreateOpen(false);
      toast.success(t("clientGroups.created"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToCreate"));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!editGroup) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name") as string;
    const discountType = fd.get("discountType") as "fixed" | "percentage";
    const discountValue = Number(fd.get("discountValue"));
    if (!name || discountValue < 0) return;
    try {
      await updateMutation.mutateAsync({ name, discountType, discountValue });
      setEditGroup(null);
      toast.success(t("clientGroups.updated"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToUpdate"));
    }
  };

  const handleDelete = async () => {
    if (!deleteGroup) return;
    try {
      await deleteMutation.mutateAsync(deleteGroup.id);
      setDeleteGroup(null);
      toast.success(t("clientGroups.deleted"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error(t("errors.cannotDeleteGroupWithClients"));
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error(t("errors.failedToDelete"));
      }
    }
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : t("errors.failedToLoadClientGroups")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("pages.clientGroups.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("pages.clientGroups.description")}</p>
        </div>
        {canMutate && (
          <Button onClick={() => setCreateOpen(true)}>{t("clientGroups.createGroup")}</Button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ) : !data?.data.length ? (
        <div className="rounded-lg border bg-card py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold">{t("pages.clientGroups.empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("pages.clientGroups.emptyHint")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("table.name")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("table.discountType")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("table.discountValue")}</th>
                  {canMutate && (
                    <th className="px-4 py-2 text-right font-medium">{t("table.actions")}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.data.map((g) => (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{g.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${g.discountType === "percentage" ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" : "bg-green-500/20 text-green-700 dark:text-green-300"}`}
                      >
                        {g.discountType === "percentage" ? t("clientGroups.discountPercentage") : t("clientGroups.discountFixed")}
                      </span>
                    </td>
                    <td className="px-4 py-2">{formatDiscount(g)}</td>
                    {canMutate && (
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditGroup(g)}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteGroup(g)}
                        >
                          {t("common.delete")}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("common.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("common.pageOf", { page: data.pagination.page, total: data.pagination.totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clientGroups.createTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label htmlFor="create-name">{t("table.name")}</Label>
              <Input
                id="create-name"
                name="name"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-discountType">{t("table.discountType")}</Label>
              <select
                id="create-discountType"
                name="discountType"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              >
                <option value="fixed">{t("clientGroups.discountFixed")}</option>
                <option value="percentage">{t("clientGroups.discountPercentage")}</option>
              </select>
            </div>
            <div>
              <Label htmlFor="create-discountValue">{t("table.discountValue")}</Label>
              <Input
                id="create-discountValue"
                name="discountValue"
                type="number"
                min={0}
                step={0.01}
                required
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("clientGroups.editTitle")}</DialogTitle>
          </DialogHeader>
          {editGroup && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">{t("table.name")}</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editGroup.name}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-discountType">{t("table.discountType")}</Label>
                <select
                  id="edit-discountType"
                  name="discountType"
                  defaultValue={editGroup.discountType}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                >
                  <option value="fixed">{t("clientGroups.discountFixed")}</option>
                  <option value="percentage">{t("clientGroups.discountPercentage")}</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit-discountValue">{t("table.discountValue")}</Label>
                <Input
                  id="edit-discountValue"
                  name="discountValue"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={editGroup.discountValue}
                  required
                  className="mt-1"
                />
              </div>
              <p className="text-muted-foreground text-sm">
                {t("clientGroups.changesHint")}
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditGroup(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteGroup} onOpenChange={(o) => !o && setDeleteGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("clientGroups.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("clientGroups.deleteDesc", { name: deleteGroup?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
