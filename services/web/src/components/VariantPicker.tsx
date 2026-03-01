import { useState } from "react";
import { useProducts } from "@/api/hooks";
import { formatPrice } from "@/lib/format-currency";
import type { ProductListItem, ProductVariant } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/useTranslation";

export interface PickedVariant {
  variantId: string;
  sku: string;
  productName: string;
  unitType: string;
  pricePerUnit: number;
  minOrderQty: number;
}

export interface StockInfo {
  available: number;
  reserved: number;
}

interface VariantPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (v: PickedVariant) => void;
  /** Optional: map of variantId -> stock for showing availability (agent order creation) */
  stockByVariantId?: Map<string, StockInfo>;
  /** Optional: whether stock is still loading (show "Loading…" when true and stock unknown) */
  stockLoading?: boolean;
}

function StockBadge({ available, reserved, t }: { available: number; reserved: number; t: (k: string, p?: Record<string, number>) => string }) {
  const free = available - reserved;
  const label = free <= 0 ? t("stock.outOfStock") : free < 10 ? t("stock.lowStockWithQty", { qty: free }) : t("stock.inStockWithQty", { qty: free });
  const className = cn(
    "text-sm",
    free <= 0 && "text-red-500",
    free > 0 && free < 10 && "text-yellow-600 dark:text-amber-500",
    free >= 10 && "text-green-600 dark:text-green-500"
  );
  return <span className={className}>{label}</span>;
}

export function VariantPicker({ open, onOpenChange, onPick, stockByVariantId, stockLoading }: VariantPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useProducts({ page: 1, pageSize: 50, search: search || undefined });

  const handleSelect = (product: ProductListItem, variant: ProductVariant) => {
    const price = variant.pricePerUnit ?? variant.clientPrice ?? 0;
    onPick({
      variantId: variant.id,
      sku: variant.sku,
      productName: product.name,
      unitType: variant.unitType,
      pricePerUnit: price,
      minOrderQty: variant.minOrderQty,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("variantPicker.addItem")}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder={t("catalog.searchProductsOrSku")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="space-y-2">
            {data?.data.map((product) =>
              product.variants.map((variant) => {
                const v = variant as ProductVariant;
                const price = v.pricePerUnit ?? v.clientPrice ?? 0;
                const stock = stockByVariantId?.get(variant.id);
                const showStock = stockByVariantId !== undefined;
                return (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between gap-3 rounded border p-2"
                  >
                    {v.images?.[0] && (
                      <img
                        src={v.images[0].url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-muted-foreground text-sm font-mono">
                        {variant.sku} · {variant.unitType} · {t("catalog.minQtyFormat", { qty: variant.minOrderQty })} · {formatPrice(price)}/unit
                      </p>
                      {showStock && (
                        <p className="mt-1">
                          {stock != null ? (
                            <StockBadge available={stock.available} reserved={stock.reserved} t={t} />
                          ) : stockLoading ? (
                            <span className="text-muted-foreground text-sm">{t("stock.loading")}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">{t("stock.na")}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <Button
                      className="shrink-0"
                      size="sm"
                      onClick={() => handleSelect(product, v)}
                      disabled={stock != null && stock.available - stock.reserved <= 0}
                    >
                      {t("stock.add")}
                    </Button>
                  </div>
                );
              })
            )}
            {data?.data.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("catalog.noProducts")}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
