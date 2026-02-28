import { useState } from "react";
import { toast } from "sonner";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeactivateUser,
  useAgentClients,
  useAssignClientToAgent,
  useRemoveClientFromAgent,
  useClientGroups,
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
import { formatDate } from "@/lib/format-date";
import type { User as UserType, Role } from "@/types/api";

const ROLES: Role[] = ["super_admin", "admin", "manager", "agent", "client"];
const LANGUAGES = ["en", "hy", "ru"] as const;

function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
    super_admin: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
    admin: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
    manager: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    agent: "bg-green-500/20 text-green-700 dark:text-green-300",
    client: "bg-slate-500/20 text-slate-700 dark:text-slate-300",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] ?? "bg-muted"}`}
    >
      {role.replace("_", " ")}
    </span>
  );
}

export function UsersAdminPage() {
  const { user: currentUser, role } = useAuth();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserType | null>(null);
  const [deactivateUser, setDeactivateUser] = useState<UserType | null>(null);
  const [manageClientsAgent, setManageClientsAgent] = useState<UserType | null>(null);
  const [createRole, setCreateRole] = useState<Role>("agent");

  const isSuperAdmin = role === "super_admin";
  const canCreateUser = isSuperAdmin;
  const canEditAny = isSuperAdmin;
  const canDeactivate = isSuperAdmin;
  const canManageClients = role === "super_admin" || role === "admin";

  const { data, isLoading, isError, error, refetch } = useUsers({
    page,
    pageSize: 20,
    role: roleFilter || undefined,
    isActive:
      activeFilter === "all"
        ? undefined
        : activeFilter === "active"
          ? true
          : false,
  });
  const { data: groupsData } = useClientGroups({ pageSize: 500 });
  const groups = groupsData?.data ?? [];

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser(editUser?.id ?? null);
  const deactivateMutation = useDeactivateUser();
  const assignMutation = useAssignClientToAgent(manageClientsAgent?.id ?? null);
  const removeMutation = useRemoveClientFromAgent(manageClientsAgent?.id ?? null);

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email") as string;
    const password = fd.get("password") as string;
    const fullName = fd.get("fullName") as string;
    const userRole = fd.get("role") as Role;
    const preferredLanguage = (fd.get("preferredLanguage") as string) || "en";
    const clientGroupId = fd.get("clientGroupId") as string | null;
    if (!email || !password || !fullName || !userRole) return;
    if (userRole === "client" && !clientGroupId) {
      toast.error("Client group is required for client role");
      return;
    }
    try {
      await createMutation.mutateAsync({
        email,
        password,
        fullName,
        role: userRole,
        preferredLanguage: preferredLanguage as "en" | "hy" | "ru",
        clientGroupId: userRole === "client" ? clientGroupId || undefined : undefined,
      });
      setCreateOpen(false);
      toast.success("User created");
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error("Email already in use");
        else if (err.status === 422) toast.error(err.message);
        else toast.error(err.message);
      } else {
        toast.error("Failed to create user");
      }
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!editUser) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fullName = fd.get("fullName") as string;
    const preferredLanguage = (fd.get("preferredLanguage") as string) || "en";
    const payload: {
      fullName?: string;
      preferredLanguage?: string;
      role?: Role;
      isActive?: boolean;
      clientGroupId?: string | null;
    } = { fullName, preferredLanguage: preferredLanguage as "en" | "hy" | "ru" };
    if (canEditAny) {
      payload.role = fd.get("role") as Role;
      payload.isActive = fd.get("isActive") === "true";
      const cg = fd.get("clientGroupId") as string | null;
      payload.clientGroupId = editUser.role === "client" ? (cg || null) : undefined;
    }
    try {
      await updateMutation.mutateAsync(payload);
      setEditUser(null);
      toast.success("User updated");
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to update user");
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    try {
      await deactivateMutation.mutateAsync(deactivateUser.id);
      setDeactivateUser(null);
      toast.success("User deactivated");
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to deactivate user");
    }
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : "Failed to load users."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        {canCreateUser && (
          <Button onClick={() => setCreateOpen(true)}>Create User</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
        <div className="flex gap-1 rounded-md border border-input p-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setActiveFilter(f);
                setPage(1);
              }}
              className={`rounded px-3 py-1 text-sm ${activeFilter === f ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : "Inactive"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 text-muted-foreground">
          Loading users…
        </div>
      ) : !data?.data.length ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground">
          No users found.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Email</th>
                  <th className="px-4 py-2 text-left font-medium">Role</th>
                  <th className="px-4 py-2 text-left font-medium">Client group</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Created</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((u) => {
                  const group = groups.find((g) => g.id === u.clientGroupId);
                  const isOwnProfile = currentUser?.id === u.id;
                  const canEdit =
                    canEditAny || (isOwnProfile && role !== "client");
                  return (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-4 py-2">{u.fullName}</td>
                      <td className="px-4 py-2">{u.email}</td>
                      <td className="px-4 py-2">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-2">
                        {u.role === "client" ? group?.name ?? "—" : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${u.isActive ? "bg-green-500" : "bg-red-500"}`}
                          title={u.isActive ? "Active" : "Inactive"}
                        />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditUser(u)}
                            >
                              Edit
                            </Button>
                          )}
                          {canDeactivate && u.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeactivateUser(u)}
                            >
                              Deactivate
                            </Button>
                          )}
                          {canManageClients && u.role === "agent" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setManageClientsAgent(u)}
                            >
                              Manage Clients
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                name="email"
                type="email"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                name="password"
                type="password"
                required
                minLength={8}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-fullName">Full name</Label>
              <Input
                id="create-fullName"
                name="fullName"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-role">Role</Label>
              <select
                id="create-role"
                name="role"
                required
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as Role)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="create-lang">Preferred language</Label>
              <select
                id="create-lang"
                name="preferredLanguage"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {createRole === "client" && (
              <div>
                <Label htmlFor="create-clientGroup">Client group (required for client)</Label>
                <select
                  id="create-clientGroup"
                  name="clientGroupId"
                  required
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                >
                  <option value="">Select group…</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editUser && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-fullName">Full name</Label>
                <Input
                  id="edit-fullName"
                  name="fullName"
                  defaultValue={editUser.fullName}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-lang">Preferred language</Label>
                <select
                  id="edit-lang"
                  name="preferredLanguage"
                  defaultValue={editUser.preferredLanguage}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              {canEditAny && (
                <>
                  <div>
                    <Label htmlFor="edit-role">Role</Label>
                    <select
                      id="edit-role"
                      name="role"
                      defaultValue={editUser.role}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="edit-active">Active</Label>
                    <select
                      id="edit-active"
                      name="isActive"
                      defaultValue={String(editUser.isActive)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  {editUser.role === "client" && (
                    <div>
                      <Label htmlFor="edit-clientGroup">Client group</Label>
                      <select
                        id="edit-clientGroup"
                        name="clientGroupId"
                        defaultValue={editUser.clientGroupId ?? ""}
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                      >
                        <option value="">—</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
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

      {/* Deactivate confirmation */}
      <AlertDialog open={!!deactivateUser} onOpenChange={(o) => !o && setDeactivateUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate user</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivate {deactivateUser?.fullName}? They will no longer be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Clients Dialog */}
      <ManageClientsDialog
        agent={manageClientsAgent}
        onClose={() => setManageClientsAgent(null)}
        assignMutation={assignMutation}
        removeMutation={removeMutation}
      />
    </div>
  );
}

function ManageClientsDialog({
  agent,
  onClose,
  assignMutation,
  removeMutation,
}: {
  agent: UserType | null;
  onClose: () => void;
  assignMutation: ReturnType<typeof useAssignClientToAgent>;
  removeMutation: ReturnType<typeof useRemoveClientFromAgent>;
}) {
  const [assignClientId, setAssignClientId] = useState("");
  const [removeClient, setRemoveClient] = useState<UserType | null>(null);

  const { data: clientsData } = useAgentClients(agent?.id ?? null, 1, 100);
  const { data: usersData } = useUsers({ pageSize: 500, role: "client" });
  const assignedClients = clientsData?.data ?? [];
  const allClients = usersData?.data ?? [];
  const unassignedClients = allClients.filter(
    (c) => !assignedClients.some((a) => a.id === c.id)
  );

  const handleAssign = async () => {
    if (!assignClientId || !agent) return;
    try {
      await assignMutation.mutateAsync(assignClientId);
      toast.success("Client assigned");
      setAssignClientId("");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error("Already assigned");
        else toast.error(err.message);
      } else {
        toast.error("Failed to assign");
      }
    }
  };

  const handleRemove = async () => {
    if (!removeClient || !agent) return;
    try {
      await removeMutation.mutateAsync(removeClient.id);
      toast.success("Client removed");
      setRemoveClient(null);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to remove");
    }
  };

  return (
    <Dialog open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage clients — {agent?.fullName}</DialogTitle>
        </DialogHeader>
        {agent && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium">Assigned clients</h4>
              {assignedClients.length === 0 ? (
                <p className="text-muted-foreground text-sm">None</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {assignedClients.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between rounded border px-2 py-1 text-sm"
                    >
                      {c.fullName} ({c.email})
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setRemoveClient(c)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium">Assign client</h4>
              <div className="mt-1 flex gap-2">
                <select
                  value={assignClientId}
                  onChange={(e) => setAssignClientId(e.target.value)}
                  className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">Select client…</option>
                  {unassignedClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.email})
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!assignClientId || assignMutation.isPending}
                  onClick={handleAssign}
                >
                  Assign
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialog open={!!removeClient} onOpenChange={(o) => !o && setRemoveClient(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove client</AlertDialogTitle>
              <AlertDialogDescription>
                Remove {removeClient?.fullName} from this agent&apos;s assignments?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
