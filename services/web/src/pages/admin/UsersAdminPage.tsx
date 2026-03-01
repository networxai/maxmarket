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
import { useTranslation } from "@/i18n/useTranslation";

const ROLES: Role[] = ["super_admin", "admin", "manager", "agent", "client"];
const LANGUAGES = ["en", "hy", "ru"] as const;

function RoleBadge({ role, t }: { role: Role; t: (k: string) => string }) {
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
      {t(`roles.${role}`)}
    </span>
  );
}

export function UsersAdminPage() {
  const { t } = useTranslation();
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
      toast.error(t("users.clientGroupRequired"));
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
      toast.success(t("users.created"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error(t("errors.emailAlreadyInUse"));
        else if (err.status === 422) toast.error(err.message);
        else toast.error(err.message);
      } else {
        toast.error(t("errors.failedToCreateUser"));
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
      toast.success(t("users.updated"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToUpdateUser"));
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    try {
      await deactivateMutation.mutateAsync(deactivateUser.id);
      setDeactivateUser(null);
      toast.success(t("users.deactivated"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToDeactivateUser"));
    }
  };

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : t("errors.failedToLoadUsers")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t("users.title")}</h1>
        {canCreateUser && (
          <Button onClick={() => setCreateOpen(true)}>{t("users.createUser")}</Button>
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
          <option value="">{t("filters.allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
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
              {f === "all" ? t("common.all") : f === "active" ? t("common.active") : t("common.inactive")}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 text-muted-foreground">
          {t("users.loading")}
        </div>
      ) : !data?.data.length ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground">
          {t("users.noUsers")}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("table.name")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("auth.email")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("auth.role")}</th>
                  <th className="hidden px-4 py-2 text-left font-medium md:table-cell">{t("auth.clientGroup")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("table.status")}</th>
                  <th className="hidden px-4 py-2 text-left font-medium md:table-cell">{t("table.created")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("table.actions")}</th>
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
                        <RoleBadge role={u.role} t={t} />
                      </td>
                      <td className="hidden px-4 py-2 md:table-cell">
                        {u.role === "client" ? group?.name ?? "—" : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${u.isActive ? "bg-green-500" : "bg-red-500"}`}
                          title={u.isActive ? t("common.active") : t("common.inactive")}
                        />
                      </td>
                      <td className="hidden px-4 py-2 text-muted-foreground md:table-cell">
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
                              {t("common.edit")}
                            </Button>
                          )}
                          {canDeactivate && u.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeactivateUser(u)}
                            >
                              {t("users.deactivateUser")}
                            </Button>
                          )}
                          {canManageClients && u.role === "agent" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setManageClientsAgent(u)}
                            >
                              {t("users.manageClients")}
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

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.createUser")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <Label htmlFor="create-email">{t("auth.email")}</Label>
              <Input
                id="create-email"
                name="email"
                type="email"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-password">{t("auth.password")}</Label>
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
              <Label htmlFor="create-fullName">{t("auth.fullName")}</Label>
              <Input
                id="create-fullName"
                name="fullName"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="create-role">{t("auth.role")}</Label>
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
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="create-lang">{t("auth.preferredLanguage")}</Label>
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
                <Label htmlFor="create-clientGroup">{t("users.clientGroupLabel")}</Label>
                <select
                  id="create-clientGroup"
                  name="clientGroupId"
                  required
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                >
                  <option value="">{t("users.selectGroup")}</option>
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
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("users.editUser")}</DialogTitle>
          </DialogHeader>
          {editUser && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit-fullName">{t("auth.fullName")}</Label>
                <Input
                  id="edit-fullName"
                  name="fullName"
                  defaultValue={editUser.fullName}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-lang">{t("auth.preferredLanguage")}</Label>
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
                    <Label htmlFor="edit-role">{t("auth.role")}</Label>
                    <select
                      id="edit-role"
                      name="role"
                      defaultValue={editUser.role}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="edit-active">{t("table.active")}</Label>
                    <select
                      id="edit-active"
                      name="isActive"
                      defaultValue={String(editUser.isActive)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                    >
                      <option value="true">{t("common.yes")}</option>
                      <option value="false">{t("common.no")}</option>
                    </select>
                  </div>
                  {editUser.role === "client" && (
                    <div>
                      <Label htmlFor="edit-clientGroup">{t("auth.clientGroup")}</Label>
                      <select
                        id="edit-clientGroup"
                        name="clientGroupId"
                        defaultValue={editUser.clientGroupId ?? ""}
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                      >
                        <option value="">{t("common.dash")}</option>
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

      {/* Deactivate confirmation */}
      <AlertDialog open={!!deactivateUser} onOpenChange={(o) => !o && setDeactivateUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("users.deactivateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("users.deactivateDesc", { name: deactivateUser?.fullName ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("users.deactivateUser")}
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
        t={t}
      />
    </div>
  );
}

function ManageClientsDialog({
  agent,
  onClose,
  assignMutation,
  removeMutation,
  t,
}: {
  agent: UserType | null;
  onClose: () => void;
  assignMutation: ReturnType<typeof useAssignClientToAgent>;
  removeMutation: ReturnType<typeof useRemoveClientFromAgent>;
  t: (k: string, p?: Record<string, string>) => string;
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
      toast.success(t("users.clientAssigned"));
      setAssignClientId("");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error(t("users.alreadyAssigned"));
        else toast.error(err.message);
      } else {
        toast.error(t("errors.failedToAssign"));
      }
    }
  };

  const handleRemove = async () => {
    if (!removeClient || !agent) return;
    try {
      await removeMutation.mutateAsync(removeClient.id);
      toast.success(t("users.clientRemoved"));
      setRemoveClient(null);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToRemove"));
    }
  };

  return (
    <Dialog open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.manageClientsTitle", { name: agent?.fullName ?? "" })}</DialogTitle>
        </DialogHeader>
        {agent && (
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium">{t("users.assignedClients")}</h4>
              {assignedClients.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("common.none")}</p>
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
                        {t("users.removeClient")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium">{t("users.assignClient")}</h4>
              <div className="mt-1 flex gap-2">
                <select
                  value={assignClientId}
                  onChange={(e) => setAssignClientId(e.target.value)}
                  className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">{t("users.selectClientToAssign")}</option>
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
                  {t("users.assign")}
                </Button>
              </div>
            </div>
          </div>
        )}

        <AlertDialog open={!!removeClient} onOpenChange={(o) => !o && setRemoveClient(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>{t("users.removeClientTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("users.removeClientDesc", { name: removeClient?.fullName ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>{t("common.remove")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
