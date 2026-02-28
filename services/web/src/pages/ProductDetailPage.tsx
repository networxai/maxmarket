import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useProduct } from "@/api/hooks";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import type { ProductVariant, PublicProductVariant } from "@/types/api";

function VariantRow({ variant }: { variant: ProductVariant | PublicProductVariant }) {
  const v = variant as ProductVariant;
  const hasAnyPrice =
    v.costPrice != null ||
    v.pricePerUnit != null ||
    v.pricePerBox != null ||
    v.clientPrice != null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-3 last:border-0">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{variant.sku}</span>
        <span className="text-muted-foreground text-sm">
          {variant.unitType} · min {variant.minOrderQty}
        </span>
      </div>
      {hasAnyPrice ? (
        <div className="text-sm">
          {v.clientPrice != null && (
            <span className="mr-2">Client: {formatPrice(v.clientPrice)}</span>
          )}
          {v.pricePerUnit != null && (
            <span className="mr-2">Unit: {formatPrice(v.pricePerUnit)}</span>
          )}
          {v.pricePerBox != null && (
            <span className="mr-2">Box: {formatPrice(v.pricePerBox)}</span>
          )}
          {v.costPrice != null && (
            <span className="text-muted-foreground">Cost: {formatPrice(v.costPrice)}</span>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">—</span>
      )}
    </div>
  );
}

function ProductImageGallery({
  images,
  productName,
}: {
  images: Array<{ id: string; url: string }>;
  productName: string;
}) {
  const [selectedUrl, setSelectedUrl] = useState(images[0]?.url ?? "");
  if (!images.length) return null;
  return (
    <div className="space-y-2">
      <div className="aspect-square max-w-md overflow-hidden rounded-lg border bg-muted">
        <img
          src={selectedUrl || images[0].url}
          alt={productName}
          className="h-full w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setSelectedUrl(img.url)}
              className={cn(
                "aspect-square w-16 shrink-0 overflow-hidden rounded border transition-opacity hover:opacity-90",
                selectedUrl === img.url && "ring-2 ring-primary ring-offset-2"
              )}
            >
              <img
                src={img.url}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError, error } = useProduct(id ?? null);

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : "Failed to load product."}
      </div>
    );
  }

  if (isLoading || !product) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/catalog">← Catalog</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          {product.description && (
            <p className="text-muted-foreground">{product.description}</p>
          )}
          {product.category && (
            <p className="text-sm text-muted-foreground">
              Category: {product.category.name}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <h2 className="mb-2 font-medium">Variants</h2>
          <div className="divide-y">
            {product.variants.map((variant) => (
              <VariantRow key={variant.id} variant={variant} />
            ))}
          </div>
          {(() => {
            const allImages = product.variants.flatMap(
              (v) => (v as ProductVariant).images ?? []
            );
            if (!allImages.length) return null;
            return (
              <div className="mt-4">
                <h2 className="mb-2 font-medium">Images</h2>
                <ProductImageGallery
                  images={allImages}
                  productName={product.name}
                />
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
