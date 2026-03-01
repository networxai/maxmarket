import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useProducts, useCategories } from "@/api/hooks";
import { useTranslation } from "@/i18n/useTranslation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format-currency";
import type { ProductListItem, ProductVariant, PublicProductVariant } from "@/types/api";
import { LayoutGrid, Grid3X3, Columns3, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** First image from first variant, or null. */
function getFirstProductImage(product: ProductListItem) {
  return product.variants?.[0]?.images?.[0];
}

function VariantPrices({ variant, compact }: { variant: ProductVariant | PublicProductVariant; compact?: boolean }) {
  const v = variant as ProductVariant;
  const hasAnyPrice =
    v.costPrice != null ||
    v.pricePerUnit != null ||
    v.pricePerBox != null ||
    v.clientPrice != null;
  if (!hasAnyPrice) return <span className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>—</span>;
  const parts: string[] = [];
  if (v.clientPrice != null) parts.push(`Client: ${formatPrice(v.clientPrice)}`);
  if (v.pricePerUnit != null) parts.push(`Unit: ${formatPrice(v.pricePerUnit)}`);
  if (v.pricePerBox != null) parts.push(`Box: ${formatPrice(v.pricePerBox)}`);
  if (v.costPrice != null) parts.push(`Cost: ${formatPrice(v.costPrice)}`);
  return <span className={compact ? "text-xs" : "text-sm"}>{parts.join(" · ")}</span>;
}

function ProductCard({
  product,
  compact,
  t,
}: {
  product: ProductListItem;
  compact: boolean;
  t: (k: string) => string;
}) {
  const firstImage = getFirstProductImage(product);
  const showVariants = compact ? 1 : 2;
  return (
    <Card className="flex flex-col overflow-hidden group cursor-pointer transition-shadow hover:shadow-[0_4px_18px_0_rgba(0,0,0,0.12)]">
      <div
        className={cn(
          "w-full shrink-0 overflow-hidden bg-muted",
          compact ? "aspect-[3/2]" : "aspect-[4/3]"
        )}
      >
        {firstImage ? (
          <img
            src={firstImage.url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
            {t("catalog.noImage")}
          </div>
        )}
      </div>
      <CardContent className={cn("flex-grow space-y-2", compact ? "p-3" : "p-5")}>
        {product.category && (
          <p
            className={cn(
              "font-medium text-primary uppercase tracking-wide",
              compact ? "text-[10px]" : "text-xs"
            )}
          >
            {product.category.name}
          </p>
        )}
        <h3
          className={cn(
            "font-semibold leading-snug",
            compact ? "text-sm" : "text-base"
          )}
        >
          <Link to={`/catalog/${product.id}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        {product.variants.slice(0, showVariants).map((variant) => (
          <div
            key={variant.id}
            className={cn("flex items-center justify-between", compact ? "text-xs" : "text-sm")}
          >
            <span className="font-mono text-muted-foreground">{variant.sku}</span>
            <VariantPrices variant={variant} compact={compact} />
          </div>
        ))}
        {product.variants.length > showVariants && (
          <p className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>
            +{product.variants.length - showVariants} more
          </p>
        )}
        <div className={cn("flex items-center justify-between", compact ? "pt-1" : "pt-2")}>
          <span
            className={cn(
              "text-muted-foreground",
              compact ? "text-[10px]" : "text-sm"
            )}
          >
            {product.variants.length} var.
          </span>
          <Button variant="default" size="sm" asChild className="rounded-lg shadow-sm shadow-primary/20">
            <Link to={`/catalog/${product.id}`}>{t("catalog.view")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type GridCols = 3 | 4 | 5;

export function CatalogPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [gridCols, setGridCols] = useState<GridCols>(() => {
    try {
      const saved = localStorage.getItem("catalog-grid-cols");
      const n = saved ? parseInt(saved, 10) : 4;
      return (n >= 3 && n <= 5 ? n : 4) as GridCols;
    } catch {
      return 4;
    }
  });
  const pageSize = 20;

  useEffect(() => {
    try {
      localStorage.setItem("catalog-grid-cols", String(gridCols));
    } catch {}
  }, [gridCols]);

  const { data: productsData, isLoading, isError, error } = useProducts({
    page,
    pageSize,
    search: search || undefined,
    category: category || undefined,
  });
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : "Failed to load products."}
      </div>
    );
  }

  const categoryFilter = category || "all";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("filters.searchProducts")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-10 rounded-lg bg-card border-border/70"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategory(v === "all" ? "" : v);
            setPage(1);
          }}
          disabled={categoriesLoading}
        >
          <SelectTrigger className="w-full sm:w-48 h-10 rounded-lg bg-card border-border/70">
            <SelectValue placeholder={t("filters.allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 ml-auto" role="group" aria-label={t("catalog.gridSize") ?? "Grid size"}>
          <Button
            variant={gridCols === 3 ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setGridCols(3)}
            aria-label="3 columns"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={gridCols === 4 ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setGridCols(4)}
            aria-label="4 columns"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={gridCols === 5 ? "default" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setGridCols(5)}
            aria-label="5 columns"
          >
            <Columns3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden transition-shadow hover:shadow-md">
              <Skeleton className="aspect-square w-full" />
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !productsData?.data.length ? (
        <div className="rounded-lg border bg-card py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold">{t("catalog.noProducts")}</p>
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "grid gap-4 sm:gap-6",
              gridCols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
              gridCols === 4 && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
              gridCols === 5 && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            )}
          >
            {productsData.data.map((product: ProductListItem) => (
              <ProductCard
                key={product.id}
                product={product}
                compact={gridCols >= 4}
                t={t}
              />
            ))}
          </div>

          {productsData.pagination && productsData.pagination.totalPages > 1 && (
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
                Page {productsData.pagination.page} of{" "}
                {productsData.pagination.totalPages} (
                {productsData.pagination.totalCount} total)
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= productsData.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
