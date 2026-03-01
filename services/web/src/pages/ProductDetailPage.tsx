import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useProduct } from "@/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import type { ProductVariant } from "@/types/api";

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

  const allImages = product.variants.flatMap(
    (v) => (v as ProductVariant).images ?? []
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/catalog">← Catalog</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row">
            {allImages.length > 0 ? (
              <div className="w-full shrink-0 lg:w-80">
                <ProductImageGallery
                  images={allImages}
                  productName={product.name}
                />
              </div>
            ) : (
              <div className="flex h-48 w-full shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground text-sm lg:w-80">
                No image
              </div>
            )}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-2xl font-bold">{product.name}</h1>
                {product.description && (
                  <p className="mt-1 text-muted-foreground">{product.description}</p>
                )}
                {product.category && (
                  <span className="mt-2 inline-block rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {product.category.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-6 pt-6">
            <h2 className="text-lg font-semibold">Variants</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Unit Type</TableHead>
                <TableHead>Min Order</TableHead>
                <TableHead>Selling Price (per unit)</TableHead>
                <TableHead>Selling Price (per box)</TableHead>
                <TableHead className="text-muted-foreground">Cost Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.variants.map((variant) => {
                const v = variant as ProductVariant;
                return (
                  <TableRow key={variant.id}>
                    <TableCell className="font-mono font-medium">{variant.sku}</TableCell>
                    <TableCell>{variant.unitType}</TableCell>
                    <TableCell>{variant.minOrderQty}</TableCell>
                    <TableCell>{(v.pricePerUnit ?? v.clientPrice) != null ? formatPrice(v.pricePerUnit ?? v.clientPrice!) : "—"}</TableCell>
                    <TableCell>{v.pricePerBox != null ? formatPrice(v.pricePerBox) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{v.costPrice != null ? formatPrice(v.costPrice) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
