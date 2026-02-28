import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useOrder, useUpdateOrder } from "@/api/hooks";
import { VariantPicker, type PickedVariant } from "@/components/VariantPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { getErrorMessage } from "@/lib/error-messages";
import { useTranslation } from "@/i18n/useTranslation";
import { X } from "lucide-react";

interface LineRow extends PickedVariant {
  qty: number;
}

export function OrderVersionEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: order, isLoading, isError, error, refetch } = useOrder(id ?? null);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [notes, setNotes] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const updateOrder = useUpdateOrder(id ?? null);

  useEffect(() => {
    if (!order) return;
    setNotes(order.notes ?? "");
    setLines(
      order.lineItems.map((li) => ({
        variantId: li.variantId,
        sku: li.sku,
        productName: li.sku,
        unitType: li.unitType,
        pricePerUnit: li.finalPrice ?? 0,
        minOrderQty: 1,
        qty: li.qty,
      }))
    );
  }, [order]);

  const addLine = (v: PickedVariant) => {
    if (lines.some((l) => l.variantId === v.variantId)) return;
    setLines((prev) => [...prev, { ...v, qty: v.minOrderQty }]);
  };

  const removeLine = (variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  };

  const setQty = (variantId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.max(1, Math.floor(qty)) } : l))
    );
  };

  const validationError = lines.some((l) => l.qty < l.minOrderQty)
    ? "Quantity must be at least min order qty for each line."
    : null;

  const handleSubmit = () => {
    if (!id || !order || lines.length === 0 || validationError) return;
    updateOrder.mutate(
      {
        lineItems: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        notes: notes || undefined,
        versionLock: order.versionLock,
      },
      {
        onSuccess: (updated) => {
          toast.success(`Version ${updated.currentVersion} created. Re-approval required.`);
          navigate(`/orders/${id}`);
        },
        onError: (e) => {
          if (e instanceof ApiError && e.errorCode === "OPTIMISTIC_LOCK_CONFLICT") {
            toast.info("Conflict detected. Refreshing...");
            void refetch();
          } else {
            toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t));
          }
        },
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
    return <Skeleton className="h-64 w-full" />;
  }

  if (order.status !== "approved") {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-muted-foreground">
        Only approved orders can be edited (creates new version). <Button variant="link" onClick={() => navigate(`/orders/${id}`)}>View order</Button>
      </div>
    );
  }

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    return (
      <div className="rounded-lg border bg-destructive/10 p-4 text-destructive">
        Only admin or super admin can create a new version.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/orders/${id}`)}>← Order {order.orderNumber}</Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit order (new version)</CardTitle>
          <p className="text-muted-foreground text-sm">Editing an approved order creates a new version and requires re-approval.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            Editing an approved order creates a new version and requires re-approval.
          </div>
          <div>
            <Label>Line items</Label>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setPickerOpen(true)}>Add item</Button>
            <div className="mt-2 space-y-2">
              {lines.map((l) => (
                <div key={l.variantId} className="flex items-center gap-2 rounded border p-2">
                  <div className="flex-1 text-sm"><span className="font-mono">{l.sku}</span> · {l.productName}</div>
                  <Input type="number" min={l.minOrderQty} value={l.qty} onChange={(e) => setQty(l.variantId, Number(e.target.value))} className="w-20" />
                  <Button variant="ghost" size="icon" onClick={() => removeLine(l.variantId)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
            {validationError && <p className="text-destructive text-sm">{validationError}</p>}
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={lines.length === 0 || !!validationError || updateOrder.isPending}>
              {updateOrder.isPending ? "Saving…" : "Save (create version)"}
            </Button>
            <Button variant="outline" onClick={() => navigate(`/orders/${id}`)}>Cancel</Button>
          </div>
        </CardContent>
      </Card>

      <VariantPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={addLine} />
    </div>
  );
}
