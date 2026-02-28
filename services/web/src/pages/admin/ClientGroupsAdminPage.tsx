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
      toast.success("Client group created");
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to create");
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
      toast.success("Client group updated");
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to update");
    }
  };

  const handleDelete = async () => {
    if (!deleteGroup) return;
    try {
      await deleteMutation.mutateAsync(deleteGroup.id);
      setDeleteGroup(null);
      toast.success("Client group deleted");
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error(
            "Cannot delete — clients are assigned to this group. Reassign or remove clients first."
          );
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Failed to delete");
      }
    }
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : "Failed to load client groups."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Client Groups</h1>
        {canMutate && (
          <Button onClick={() => setCreateOpen(true)}>Create Group</Button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 text-muted-foreground">
          Loading…
        </div>
      ) : !data?.data.length ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground">
          No client groups.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Discount type</th>
                  <th className="px-4 py-2 text-left font-medium">Discount value</th>
                  {canMutate && (
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
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
                        {g.discountType}
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
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteGroup(g)}
                        >
                          Delete
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Client Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                name="name"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-discountType">Discount type</Label>
              <select
                id="create-discountType"
                name="discountType"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              >
                <option value="fixed">Fixed</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>
            <div>
              <Label htmlFor="create-discountValue">Discount value</Label>
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
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client Group</DialogTitle>
          </DialogHeader>
          {editGroup && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  defaultValue={editGroup.name}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-discountType">Discount type</Label>
                <select
                  id="edit-discountType"
                  name="discountType"
                  defaultValue={editGroup.discountType}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                >
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit-discountValue">Discount value</Label>
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
                Changes affect new orders and draft orders on next submission. Approved
                and fulfilled orders are not affected.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditGroup(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  Save
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
            <AlertDialogTitle>Delete group</AlertDialogTitle>
            <AlertDialogDescription>
              Delete group &quot;{deleteGroup?.name}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
