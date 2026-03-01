import { useState } from "react";
import { Link } from "react-router-dom";
import { useProducts, useCategories } from "@/api/hooks";
import { useTranslation } from "@/i18n/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format-currency";
import type { ProductListItem, ProductVariant, PublicProductVariant } from "@/types/api";

/** First image from first variant, or null. */
function getFirstProductImage(product: ProductListItem) {
  return product.variants?.[0]?.images?.[0];
}

function VariantPrices({ variant }: { variant: ProductVariant | PublicProductVariant }) {
  const v = variant as ProductVariant;
  const hasAnyPrice =
    v.costPrice != null ||
    v.pricePerUnit != null ||
    v.pricePerBox != null ||
    v.clientPrice != null;
  if (!hasAnyPrice) return <span className="text-muted-foreground text-sm">—</span>;
  const parts: string[] = [];
  if (v.clientPrice != null) parts.push(`Client: ${formatPrice(v.clientPrice)}`);
  if (v.pricePerUnit != null) parts.push(`Unit: ${formatPrice(v.pricePerUnit)}`);
  if (v.pricePerBox != null) parts.push(`Box: ${formatPrice(v.pricePerBox)}`);
  if (v.costPrice != null) parts.push(`Cost: ${formatPrice(v.costPrice)}`);
  return <span className="text-sm">{parts.join(" · ")}</span>;
}

export function CatalogPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const pageSize = 20;

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

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          placeholder={t("catalog.search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full sm:max-w-xs"
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm sm:w-auto"
          disabled={categoriesLoading}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {productsData.data.map((product: ProductListItem) => (
              <Card key={product.id} className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
                <div className="aspect-square w-full shrink-0 overflow-hidden bg-muted">
                  {(() => {
                    const firstImage = getFirstProductImage(product);
                    return firstImage ? (
                    <img
                      src={firstImage.url}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
                      {t("catalog.noImage")}
                    </div>
                  );
                  })()}
                </div>
                <CardHeader className="flex-grow">
                  <CardTitle className="text-base">
                    <Link
                      to={`/catalog/${product.id}`}
                      className="hover:underline"
                    >
                      {product.name}
                    </Link>
                  </CardTitle>
                  {product.category && (
                    <p className="text-muted-foreground text-sm">
                      {product.category.name}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {product.variants.slice(0, 2).map((variant) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono text-muted-foreground">
                        {variant.sku}
                      </span>
                      <VariantPrices variant={variant} />
                    </div>
                  ))}
                  {product.variants.length > 2 && (
                    <p className="text-muted-foreground text-xs">
                      +{product.variants.length - 2} more variant
                      {product.variants.length - 2 > 1 ? "s" : ""}
                    </p>
                  )}
                  <Button variant="outline" size="sm" asChild className="mt-2">
                    <Link to={`/catalog/${product.id}`}>{t("catalog.view")}</Link>
                  </Button>
                </CardContent>
              </Card>
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
