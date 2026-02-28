import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useOrder, useUpdateOrder, useStockByVariant } from "@/api/hooks";
import { VariantPicker, type PickedVariant } from "@/components/VariantPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { getErrorMessage } from "@/lib/error-messages";
import { formatPrice } from "@/lib/format-currency";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface LineRow extends PickedVariant {
  qty: number;
}

export function EditOrderPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: order, isLoading, isError, error } = useOrder(id ?? null);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [notes, setNotes] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const updateOrder = useUpdateOrder(id ?? null);
  const { stockByVariant, isLoading: stockLoading } = useStockByVariant({
    enabled: !!user && user.role === "agent",
  });

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
    if (!id || lines.length === 0 || validationError) return;
    updateOrder.mutate(
      {
        lineItems: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Draft updated");
          navigate(`/orders/${id}`);
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
    return <Skeleton className="h-64 w-full" />;
  }

  if (order.status !== "draft") {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-muted-foreground">
        Only draft orders can be edited. <Button variant="link" onClick={() => navigate(`/orders/${id}`)}>View order</Button>
      </div>
    );
  }

  if (user?.role !== "agent" || order.agentId !== user?.id) {
    return (
      <div className="rounded-lg border bg-destructive/10 p-4 text-destructive">
        You can only edit your own draft orders.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/orders/${id}`)}>← Order {order.orderNumber}</Button>

      <Card>
        <CardHeader>
          <CardTitle>Edit draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Line items</Label>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setPickerOpen(true)}>Add item</Button>
            <div className="mt-2 space-y-2">
              {lines.map((l) => {
                const stock = stockByVariant.get(l.variantId);
                const freeQty = stock ? stock.available - stock.reserved : null;
                const stockLabel = stockLoading ? "Loading…" : freeQty === null ? "—" : freeQty <= 0 ? "Out of stock" : freeQty < 10 ? `Low: ${freeQty}` : `${freeQty} available`;
                const stockClass = freeQty === null && !stockLoading ? "text-muted-foreground" : freeQty === null ? "" : freeQty <= 0 ? "text-red-500" : freeQty < 10 ? "text-yellow-600 dark:text-amber-500" : "text-green-600 dark:text-green-500";
                return (
                <div key={l.variantId} className="space-y-1 rounded border p-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-sm">
                      <span className="font-mono">{l.sku}</span> · {l.productName} · {formatPrice(l.pricePerUnit)}/unit
                    <span className={cn("ml-2 text-xs", stockClass)}>· Stock: {stockLabel}</span>
                    </div>
                    <Input type="number" min={l.minOrderQty} value={l.qty} onChange={(e) => setQty(l.variantId, Number(e.target.value))} className="w-20" />
                    <Button variant="ghost" size="icon" onClick={() => removeLine(l.variantId)}><X className="h-4 w-4" /></Button>
                  </div>
                  {freeQty != null && l.qty > freeQty && (
                    <p className="text-amber-600 dark:text-amber-500 text-xs">
                      Requested quantity exceeds available stock ({freeQty})
                    </p>
                  )}
                </div>
              );})}
            </div>
            {validationError && <p className="text-destructive text-sm">{validationError}</p>}
            {lines.length > 0 && (
              <p className="mt-2 text-right font-medium">
                Subtotal: {formatPrice(lines.reduce((sum, l) => sum + l.pricePerUnit * l.qty, 0))}
              </p>
            )}
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={lines.length === 0 || !!validationError || updateOrder.isPending}>
              {updateOrder.isPending ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={() => navigate(`/orders/${id}`)}>Cancel</Button>
          </div>
        </CardContent>
      </Card>

      <VariantPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={addLine}
        stockByVariantId={stockByVariant}
        stockLoading={stockLoading}
      />
    </div>
  );
}
