import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useAgentClients, useCreateOrder, useStockByVariant } from "@/api/hooks";
import { VariantPicker, type PickedVariant } from "@/components/VariantPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function CreateOrderPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [clientId, setClientId] = useState("");
  const [lines, setLines] = useState<LineRow[]>([]);
  const [notes, setNotes] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: clientsData } = useAgentClients(user?.id ?? null, 1, 200);
  const { stockByVariant, isLoading: stockLoading } = useStockByVariant({
    enabled: !!user && user.role === "agent",
  });
  const clients = clientsData?.data ?? [];
  const singleClient = clients.length === 1 ? clients[0] : null;
  const effectiveClientId = singleClient ? singleClient.id : clientId;

  useEffect(() => {
    if (singleClient && !clientId) setClientId(singleClient.id);
  }, [singleClient, clientId]);

  const createOrder = useCreateOrder();

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
    if (!effectiveClientId || lines.length === 0 || validationError) return;
    createOrder.mutate(
      {
        clientId: effectiveClientId,
        lineItems: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        notes: notes || undefined,
      },
      {
        onSuccess: (order) => {
          toast.success("Draft order created");
          navigate(`/orders/${order.id}`);
        },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 403) {
            toast.error("Client not assigned to you.");
          } else {
            toast.error(e instanceof ApiError ? e.message : getErrorMessage(e, t));
          }
        },
      }
    );
  };

  if (!user || user.role !== "agent") {
    return (
      <div className="rounded-lg border bg-destructive/10 p-4 text-destructive">
        Only agents can create orders.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/orders")}>
          ← Orders
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">New Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            Prices shown are current base prices. Final prices including group discounts will be calculated when you submit.
          </div>

          <div>
            <Label>Client</Label>
            {singleClient ? (
              <p className="mt-1 font-medium">{singleClient.fullName}</p>
            ) : (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                Add item
              </Button>
            </div>
            {lines.length === 0 ? (
              <p className="text-muted-foreground text-sm">Add at least one line item.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {lines.map((l) => {
                  const stock = stockByVariant.get(l.variantId);
                  const freeQty = stock ? stock.available - stock.reserved : null;
                  const stockLabel = stockLoading
                    ? "Loading…"
                    : freeQty === null
                      ? "—"
                      : freeQty <= 0
                        ? "Out of stock"
                        : freeQty < 10
                          ? `Low: ${freeQty}`
                          : `${freeQty} available`;
                  const stockClass = freeQty === null && !stockLoading ? "text-muted-foreground" : freeQty === null ? "" : freeQty <= 0 ? "text-red-500" : freeQty < 10 ? "text-yellow-600 dark:text-amber-500" : "text-green-600 dark:text-green-500";
                  return (
                  <div key={l.variantId} className="space-y-1 rounded border p-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-sm">
                        <span className="font-mono">{l.sku}</span> · {l.productName} · {l.unitType} · {formatPrice(l.pricePerUnit)}/unit
                        <span className={cn("ml-2 text-xs", stockClass)}>· Stock: {stockLabel}</span>
                      </div>
                      <Label className="sr-only">Qty</Label>
                      <Input
                        type="number"
                        min={l.minOrderQty}
                        value={l.qty}
                        onChange={(e) => setQty(l.variantId, Number(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-muted-foreground text-xs">min {l.minOrderQty}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeLine(l.variantId)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {freeQty != null && l.qty > freeQty && (
                      <p className="text-amber-600 dark:text-amber-500 text-xs">
                        Requested quantity exceeds available stock ({freeQty})
                      </p>
                    )}
                  </div>
                );})}
              </div>
            )}
            {validationError && <p className="text-destructive text-sm">{validationError}</p>}
            {lines.length > 0 && (
              <p className="mt-2 text-right font-medium">
                Subtotal: {formatPrice(lines.reduce((sum, l) => sum + l.pricePerUnit * l.qty, 0))}
              </p>
            )}
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="mt-1" />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!effectiveClientId || lines.length === 0 || !!validationError || createOrder.isPending}
            >
              {createOrder.isPending ? "Creating…" : "Create draft"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/orders")}>
              Cancel
            </Button>
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
