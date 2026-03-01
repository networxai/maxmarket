import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useProducts,
  useProduct,
  useCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
  useAddVariantImage,
  useDeleteVariantImage,
  useReorderVariantImages,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/api/hooks";
import { MultilingualInput } from "@/components/MultilingualInput";
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
import { formatPrice } from "@/lib/format-currency";
import type { Product, ProductVariant, Category } from "@/types/api";
import type { MultilingualString } from "@/types/api";
import { useTranslation } from "@/i18n/useTranslation";

const UNIT_TYPES = ["piece", "box", "kg"] as const;

export function CatalogAdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"products" | "categories">("products");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("catalogAdmin.title")}</h1>
      <div className="flex gap-2 border-b">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === "products" ? "border-primary" : "border-transparent"}`}
        >
          {t("catalogAdmin.products")}
        </button>
        <button
          type="button"
          onClick={() => setTab("categories")}
          className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === "categories" ? "border-primary" : "border-transparent"}`}
        >
          {t("catalogAdmin.categories")}
        </button>
      </div>
      {tab === "products" && <ProductsTab />}
      {tab === "categories" && <CategoriesTab />}
    </div>
  );
}

function ProductsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");

  const { data: productsData, isLoading, isError, error } = useProducts({
    page,
    pageSize: 20,
    search: search || undefined,
    category: category || undefined,
  });
  const { data: categories = [] } = useCategories();

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : t("errors.failedToLoadProducts")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder={t("catalogAdmin.searchProducts")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">{t("filters.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => navigate("/admin/catalog/products/new")}>
          {t("catalogAdmin.newProduct")}
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 text-muted-foreground">{t("common.loading")}</div>
      ) : !productsData?.data.length ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground">
          {t("catalogAdmin.noProducts")}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">{t("table.name")}</th>
                  <th className="hidden px-4 py-2 text-left font-medium md:table-cell">{t("table.category")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("table.variants")}</th>
                  <th className="px-4 py-2 text-left font-medium">{t("table.active")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {productsData.data.map((p: Product) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="hidden px-4 py-2 md:table-cell">{p.category?.name ?? "—"}</td>
                    <td className="px-4 py-2">{p.variants.length}</td>
                    <td className="px-4 py-2">{p.isActive ? t("common.yes") : t("common.no")}</td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/catalog/products/${p.id}`}>{t("common.edit")}</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {productsData.pagination.totalPages > 1 && (
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
                {t("common.pageOf", { page: productsData.pagination.page, total: productsData.pagination.totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= productsData.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CategoriesTab() {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const [createName, setCreateName] = useState<MultilingualString>({ en: "", hy: null, ru: null });
  const [editName, setEditName] = useState<MultilingualString>({ en: "", hy: null, ru: null });

  const { data: categories = [], isLoading, refetch } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory(editCat?.id ?? null);
  const deleteMutation = useDeleteCategory();

  const handleCreateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!createName.en.trim()) {
      toast.error(t("errors.englishNameRequired"));
      return;
    }
    try {
      await createMutation.mutateAsync({
        name: { en: createName.en.trim(), hy: createName.hy?.trim() || null, ru: createName.ru?.trim() || null },
      });
      setCreateOpen(false);
      setCreateName({ en: "", hy: null, ru: null });
      toast.success(t("catalogAdmin.categoryCreated"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToCreate"));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!editCat) return;
    e.preventDefault();
    if (!editName.en.trim()) {
      toast.error(t("errors.englishNameRequired"));
      return;
    }
    try {
      await updateMutation.mutateAsync({
        name: { en: editName.en.trim(), hy: editName.hy?.trim() || null, ru: editName.ru?.trim() || null },
      });
      setEditCat(null);
      toast.success(t("catalogAdmin.categoryUpdated"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToUpdate"));
    }
  };

  const openEdit = (c: Category) => {
    setEditCat(c);
    setEditName({ en: c.name, hy: null, ru: null });
  };

  const handleDelete = async () => {
    if (!deleteCat) return;
    try {
      await deleteMutation.mutateAsync(deleteCat.id);
      setDeleteCat(null);
      toast.success(t("catalogAdmin.categoryDeleted"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          toast.error(
            t("errors.cannotDeleteCategoryWithProducts")
          );
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error(t("errors.failedToDelete"));
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>{t("catalogAdmin.newCategory")}</Button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border p-4 text-muted-foreground">{t("common.loading")}</div>
      ) : !categories.length ? (
        <div className="rounded-lg border bg-muted/50 p-8 text-center text-muted-foreground">
          {t("catalogAdmin.noCategories")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[300px] text-sm">
            <thead>
                <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">{t("table.name")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteCat(c)}
                    >
                      {t("common.delete")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("catalogAdmin.newCategoryTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <MultilingualInput label={t("catalogAdmin.categoryName")} value={createName} onChange={setCreateName} required />
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

      <Dialog open={!!editCat} onOpenChange={(o) => !o && setEditCat(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("catalogAdmin.editCategoryTitle")}</DialogTitle>
          </DialogHeader>
          {editCat && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <MultilingualInput label={t("catalogAdmin.categoryName")} value={editName} onChange={setEditName} required />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditCat(null)}>
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

      <AlertDialog open={!!deleteCat} onOpenChange={(o) => !o && setDeleteCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("catalogAdmin.deleteCategoryTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("clientGroups.deleteDesc", { name: deleteCat?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function CreateProductPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const createMutation = useCreateProduct();

  const [name, setName] = useState<MultilingualString>({ en: "", hy: null, ru: null });
  const [description, setDescription] = useState<MultilingualString>({ en: "", hy: null, ru: null });
  const [categoryId, setCategoryId] = useState<string>("");
  const [sku, setSku] = useState("");
  const [unitType, setUnitType] = useState<"piece" | "box" | "kg">("piece");
  const [minOrderQty, setMinOrderQty] = useState(1);
  const [costPrice, setCostPrice] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [pricePerBox, setPricePerBox] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.en.trim()) {
      toast.error(t("catalogAdmin.productNameRequired"));
      return;
    }
    if (!description.en.trim()) {
      toast.error(t("catalogAdmin.productDescRequired"));
      return;
    }
    if (!sku.trim()) {
      toast.error(t("catalogAdmin.variantSkuRequired"));
      return;
    }
    const cp = Number(costPrice);
    const ppu = Number(pricePerUnit);
    const ppb = pricePerBox ? Number(pricePerBox) : undefined;
    if (cp < 0 || ppu < 0 || (ppb != null && ppb < 0)) {
      toast.error(t("catalogAdmin.pricesMustBePositive"));
      return;
    }
    if (minOrderQty < 1) {
      toast.error(t("catalogAdmin.minOrderQtyRequired"));
      return;
    }
    try {
      const product = await createMutation.mutateAsync({
        name: { en: name.en.trim(), hy: name.hy || null, ru: name.ru || null },
        description: { en: description.en.trim(), hy: description.hy || null, ru: description.ru || null },
        categoryId: categoryId || null,
        variants: [
          {
            sku: sku.trim(),
            unitType,
            minOrderQty,
            costPrice: cp,
            pricePerUnit: ppu,
            pricePerBox: ppb ?? null,
          },
        ],
      });
      toast.success(t("catalogAdmin.productCreated"));
      navigate(`/admin/catalog/products/${product.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error(t("errors.skuAlreadyExists"));
        else toast.error(err.message);
      } else {
        toast.error(t("errors.failedToCreateProduct"));
      }
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/catalog")}>
        {t("catalogAdmin.backToCatalog")}
      </Button>
      <h1 className="text-2xl font-semibold">{t("catalogAdmin.createProduct")}</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <MultilingualInput label={t("catalogAdmin.productName")} value={name} onChange={setName} required />
        <MultilingualInput
          label={t("catalogAdmin.productDescription")}
          value={description}
          onChange={setDescription}
          required
        />
        <div>
          <Label>{t("table.category")}</Label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
          >
            <option value="">{t("common.dash")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded border p-4">
          <h2 className="mb-3 font-medium">{t("catalogAdmin.initialVariant")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("catalogAdmin.skuRequired")}</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label>{t("catalogAdmin.unitType")}</Label>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as "piece" | "box" | "kg")}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              >
                {UNIT_TYPES.map((u) => (
                  <option key={u} value={u}>
                    {t(`unitTypes.${u}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("catalogAdmin.minOrderQty")}</Label>
              <Input
                type="number"
                min={1}
                value={minOrderQty}
                onChange={(e) => setMinOrderQty(Number(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("catalogAdmin.costPrice")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="mt-1"
                />
                <span className="text-muted-foreground text-sm">֏</span>
              </div>
            </div>
            <div>
              <Label>{t("catalogAdmin.pricePerUnit")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(e.target.value)}
                  className="mt-1"
                />
                <span className="text-muted-foreground text-sm">֏</span>
              </div>
            </div>
            <div>
              <Label>{t("catalogAdmin.pricePerBox")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={pricePerBox}
                  onChange={(e) => setPricePerBox(e.target.value)}
                  className="mt-1"
                />
                <span className="text-muted-foreground text-sm">֏</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={createMutation.isPending}>
            {t("catalogAdmin.createProduct")}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/admin/catalog")}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ProductAdminDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading, isError, error, refetch } = useProduct(id ?? null);
  const { data: categories = [] } = useCategories();

  const [editProductOpen, setEditProductOpen] = useState(false);
  const [deleteProductOpen, setDeleteProductOpen] = useState(false);
  const [editVariant, setEditVariant] = useState<ProductVariant | null>(null);
  const [addVariantOpen, setAddVariantOpen] = useState(false);
  const [deleteVariant, setDeleteVariant] = useState<ProductVariant | null>(null);
  const [addImageVariant, setAddImageVariant] = useState<ProductVariant | null>(null);
  const [deleteImageVariant, setDeleteImageVariant] = useState<{ variant: ProductVariant; imageId: string } | null>(null);
  const [reorderImageVariant, setReorderImageVariant] = useState<ProductVariant | null>(null);
  const [reorderImageIds, setReorderImageIds] = useState<string[]>([]);

  const updateMutation = useUpdateProduct(id ?? null);
  const deleteMutation = useDeleteProduct();
  const createVariantMutation = useCreateVariant(id ?? null);
  const updateVariantMutation = useUpdateVariant(id ?? null, editVariant?.id ?? null);
  const deleteVariantMutation = useDeleteVariant(id ?? null);
  const addImageMutation = useAddVariantImage(id ?? null, addImageVariant?.id ?? null);
  const deleteImageMutation = useDeleteVariantImage(id ?? null, deleteImageVariant?.variant.id ?? null);
  const reorderImageMutation = useReorderVariantImages(id ?? null, reorderImageVariant?.id ?? null);

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error instanceof Error ? error.message : t("errors.failedToLoadProduct")}
      </div>
    );
  }

  if (isLoading || !product) {
    return <div className="rounded-lg border p-4 text-muted-foreground">{t("common.loading")}</div>;
  }

  const handleEditProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nameEn = fd.get("nameEn") as string;
    const nameHy = fd.get("nameHy") as string;
    const nameRu = fd.get("nameRu") as string;
    const descEn = fd.get("descEn") as string;
    const descHy = fd.get("descHy") as string;
    const descRu = fd.get("descRu") as string;
    const categoryId = fd.get("categoryId") as string;
    const isActive = fd.get("isActive") === "true";
    if (!nameEn?.trim()) {
      toast.error(t("errors.englishNameRequired"));
      return;
    }
    try {
      await updateMutation.mutateAsync({
        name: { en: nameEn.trim(), hy: nameHy?.trim() || null, ru: nameRu?.trim() || null },
        description: { en: descEn?.trim(), hy: descHy?.trim() || null, ru: descRu?.trim() || null },
        categoryId: categoryId || null,
        isActive,
      });
      setEditProductOpen(false);
      toast.success(t("catalogAdmin.productUpdated"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToUpdate"));
    }
  };

  const handleDeleteProduct = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("catalogAdmin.productDeleted"));
      navigate("/admin/catalog");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error(t("errors.cannotDeleteProductWithOrders"));
        else toast.error(err.message);
      } else {
        toast.error(t("errors.failedToDelete"));
      }
    }
  };

  const handleAddVariantSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sku = fd.get("sku") as string;
    const unitType = fd.get("unitType") as "piece" | "box" | "kg";
    const minOrderQty = Number(fd.get("minOrderQty")) || 1;
    const costPrice = Number(fd.get("costPrice")) || 0;
    const pricePerUnit = Number(fd.get("pricePerUnit")) || 0;
    const pricePerBox = (fd.get("pricePerBox") as string) ? Number(fd.get("pricePerBox")) : null;
    if (!sku?.trim()) {
      toast.error(t("catalogAdmin.variantSkuRequired"));
      return;
    }
    try {
      await createVariantMutation.mutateAsync({
        sku: sku.trim(),
        unitType,
        minOrderQty,
        costPrice,
        pricePerUnit,
        pricePerBox,
      });
      setAddVariantOpen(false);
      toast.success(t("catalogAdmin.variantAdded"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error(t("errors.skuAlreadyExists"));
        else toast.error(err.message);
      } else {
        toast.error(t("errors.failedToAddVariant"));
      }
    }
  };

  const handleEditVariantSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!editVariant) return;
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sku = fd.get("sku") as string;
    const unitType = fd.get("unitType") as "piece" | "box" | "kg";
    const minOrderQty = Number(fd.get("minOrderQty")) || 1;
    const costPrice = Number(fd.get("costPrice")) || 0;
    const pricePerUnit = Number(fd.get("pricePerUnit")) || 0;
    const pricePerBox = (fd.get("pricePerBox") as string) ? Number(fd.get("pricePerBox")) : null;
    const isActive = fd.get("isActive") === "true";
    if (!sku?.trim()) {
      toast.error(t("catalogAdmin.variantSkuRequired"));
      return;
    }
    try {
      await updateVariantMutation.mutateAsync({
        sku: sku.trim(),
        unitType,
        minOrderQty,
        costPrice,
        pricePerUnit,
        pricePerBox,
        isActive,
      });
      setEditVariant(null);
      toast.success(t("catalogAdmin.variantUpdated"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error(t("errors.cannotChangeSkuWithOrders"));
        else toast.error(err.message);
      } else {
        toast.error(t("errors.failedToUpdateVariant"));
      }
    }
  };

  const handleDeleteVariant = async () => {
    if (!deleteVariant) return;
    try {
      await deleteVariantMutation.mutateAsync(deleteVariant.id);
      setDeleteVariant(null);
      toast.success(t("catalogAdmin.variantDeleted"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) toast.error(t("errors.cannotDeleteVariantWithOrders"));
        else toast.error(err.message);
      } else {
        toast.error(t("errors.failedToDeleteVariant"));
      }
    }
  };

  const handleAddImageSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!addImageVariant) return;
    const fd = new FormData(e.currentTarget);
    const url = fd.get("imageUrl") as string;
    const sortOrder = Number(fd.get("sortOrder")) || 0;
    if (!url?.trim()) {
      toast.error(t("catalogAdmin.urlRequired"));
      return;
    }
    try {
      await addImageMutation.mutateAsync({ url: url.trim(), sortOrder });
      setAddImageVariant(null);
      toast.success(t("catalogAdmin.imageAdded"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToAddImage"));
    }
  };

  const handleDeleteImage = async () => {
    if (!deleteImageVariant) return;
    try {
      await deleteImageMutation.mutateAsync(deleteImageVariant.imageId);
      setDeleteImageVariant(null);
      toast.success(t("catalogAdmin.imageRemoved"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToRemoveImage"));
    }
  };

  const openReorder = (v: ProductVariant) => {
    setReorderImageVariant(v);
    setReorderImageIds((v.images ?? []).map((img) => img.id));
  };

  const handleReorderSubmit = async () => {
    if (!reorderImageVariant || reorderImageIds.length === 0) return;
    try {
      await reorderImageMutation.mutateAsync({ imageIds: reorderImageIds });
      setReorderImageVariant(null);
      toast.success(t("catalogAdmin.imagesReordered"));
      void refetch();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error(t("errors.failedToReorderImages"));
    }
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= reorderImageIds.length) return;
    const next = [...reorderImageIds];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setReorderImageIds(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/catalog")}>
          {t("catalogAdmin.backToCatalog")}
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditProductOpen(true)}>
            {t("catalogAdmin.editProductTitle")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => setDeleteProductOpen(true)}
          >
            {t("catalogAdmin.deleteProductTitle")}
          </Button>
        </div>
      </div>

      <div className="rounded border p-4">
        <h2 className="mb-4 font-medium">{t("table.variants")}</h2>
        <Button size="sm" className="mb-4" onClick={() => setAddVariantOpen(true)}>
          {t("catalogAdmin.addVariantTitle")}
        </Button>
        <div className="space-y-4">
          {product.variants.map((v) => {
            const images = (v as ProductVariant).images ?? [];
            return (
              <div key={v.id} className="rounded border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium">{v.sku}</span>
                    <span className="text-muted-foreground text-sm">{v.unitType}</span>
                    <span className="text-muted-foreground text-sm">
                      {t("catalogAdmin.costLabel")}: {formatPrice((v as ProductVariant).costPrice ?? 0)} · {t("catalogAdmin.unitLabel")}: {formatPrice((v as ProductVariant).pricePerUnit ?? 0)}
                      {(v as ProductVariant).pricePerBox != null && ` · ${t("catalogAdmin.boxLabel")}: ${formatPrice((v as ProductVariant).pricePerBox!)}`}
                    </span>
                    <span className="text-muted-foreground text-sm">{t("catalogAdmin.min")}: {v.minOrderQty}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${v.isActive ? "bg-green-500/20 text-green-700" : "bg-muted"}`}>
                      {v.isActive ? t("table.active") : t("catalogAdmin.inactive")}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditVariant(v)}>
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteVariant(v)}
                    >
                      {t("common.delete")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setAddImageVariant(v)}>
                      {t("catalogAdmin.addImageTitle")}
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-sm font-medium">{t("catalogAdmin.images")}</h3>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {images.map((img) => (
                      <div key={img.id} className="relative">
                        {img.url.match(/\.(jpe?g|png|gif|webp)$/i) ? (
                          <img src={img.url} alt="" className="h-16 w-16 rounded object-cover" />
                        ) : (
                          <span className="block h-16 w-16 rounded border bg-muted p-1 text-xs break-all">{img.url}</span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute -right-1 -top-1 h-5 w-5 text-destructive"
                          onClick={() => setDeleteImageVariant({ variant: v, imageId: img.id })}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    {images.length >= 2 && (
                        <Button variant="ghost" size="sm" onClick={() => openReorder(v)}>
                        {t("catalogAdmin.reorder")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={editProductOpen} onOpenChange={setEditProductOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("catalogAdmin.editProductTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditProductSubmit} className="space-y-4">
            <div>
              <Label>{t("catalogAdmin.nameEn")}</Label>
              <Input name="nameEn" defaultValue={product.name} required className="mt-1" />
            </div>
            <div>
              <Label>{t("catalogAdmin.nameHy")}</Label>
              <Input name="nameHy" className="mt-1" />
            </div>
            <div>
              <Label>{t("catalogAdmin.nameRu")}</Label>
              <Input name="nameRu" className="mt-1" />
            </div>
            <div>
              <Label>{t("catalogAdmin.descEn")}</Label>
              <Input name="descEn" defaultValue={product.description ?? ""} className="mt-1" />
            </div>
            <div>
              <Label>{t("catalogAdmin.descHy")}</Label>
              <Input name="descHy" className="mt-1" />
            </div>
            <div>
              <Label>{t("catalogAdmin.descRu")}</Label>
              <Input name="descRu" className="mt-1" />
            </div>
            <div>
              <Label>{t("table.category")}</Label>
              <select
                name="categoryId"
                defaultValue={product.category?.id ?? ""}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              >
                <option value="">{t("common.dash")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("table.active")}</Label>
              <select
                name="isActive"
                defaultValue={String(product.isActive)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              >
                <option value="true">{t("common.yes")}</option>
                <option value="false">{t("common.no")}</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditProductOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Product Dialog */}
      <AlertDialog open={deleteProductOpen} onOpenChange={setDeleteProductOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("catalogAdmin.deleteProductTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("catalogAdmin.deleteProductDesc", { name: product.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Variant Dialog */}
      <Dialog open={addVariantOpen} onOpenChange={setAddVariantOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("catalogAdmin.addVariantTitle")}</DialogTitle>
          </DialogHeader>
            <form onSubmit={handleAddVariantSubmit} className="space-y-4">
            <div>
              <Label>{t("table.sku")}</Label>
              <Input name="sku" required className="mt-1" />
            </div>
            <div>
              <Label>{t("catalogAdmin.unitType")}</Label>
              <select
                name="unitType"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              >
                {UNIT_TYPES.map((u) => (
                  <option key={u} value={u}>{t(`unitTypes.${u}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("catalogAdmin.minOrderQty")}</Label>
              <Input name="minOrderQty" type="number" min={1} defaultValue={1} className="mt-1" />
            </div>
            <div>
              <Label>{t("catalogAdmin.costPrice")}</Label>
              <div className="flex items-center gap-2">
                <Input name="costPrice" type="number" min={0} step={0.01} required className="mt-1" />
                <span className="text-muted-foreground text-sm">֏</span>
              </div>
            </div>
            <div>
              <Label>{t("catalogAdmin.pricePerUnit")}</Label>
              <div className="flex items-center gap-2">
                <Input name="pricePerUnit" type="number" min={0} step={0.01} required className="mt-1" />
                <span className="text-muted-foreground text-sm">֏</span>
              </div>
            </div>
            <div>
              <Label>{t("catalogAdmin.pricePerBox")}</Label>
              <div className="flex items-center gap-2">
                <Input name="pricePerBox" type="number" min={0} step={0.01} className="mt-1" />
                <span className="text-muted-foreground text-sm">֏</span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddVariantOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createVariantMutation.isPending}>
                {t("common.add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Variant Dialog */}
      <Dialog open={!!editVariant} onOpenChange={(o) => !o && setEditVariant(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("catalogAdmin.editVariantTitle")}</DialogTitle>
          </DialogHeader>
          {editVariant && (
            <form onSubmit={handleEditVariantSubmit} className="space-y-4">
              <div>
                <Label>{t("table.sku")}</Label>
                <Input name="sku" defaultValue={editVariant.sku} required className="mt-1" />
              </div>
              <div>
                <Label>{t("catalogAdmin.unitType")}</Label>
                <select
                  name="unitType"
                  defaultValue={editVariant.unitType}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                >
                  {UNIT_TYPES.map((u) => (
                    <option key={u} value={u}>{t(`unitTypes.${u}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("catalogAdmin.minOrderQty")}</Label>
                <Input name="minOrderQty" type="number" min={1} defaultValue={editVariant.minOrderQty} className="mt-1" />
              </div>
              <div>
                <Label>{t("catalogAdmin.costPrice")}</Label>
                <div className="flex items-center gap-2">
                  <Input name="costPrice" type="number" min={0} step={0.01} defaultValue={(editVariant as ProductVariant).costPrice ?? 0} className="mt-1" />
                  <span className="text-muted-foreground text-sm">֏</span>
                </div>
              </div>
              <div>
                <Label>{t("catalogAdmin.pricePerUnit")}</Label>
                <div className="flex items-center gap-2">
                  <Input name="pricePerUnit" type="number" min={0} step={0.01} defaultValue={(editVariant as ProductVariant).pricePerUnit ?? 0} className="mt-1" />
                  <span className="text-muted-foreground text-sm">֏</span>
                </div>
              </div>
              <div>
                <Label>{t("catalogAdmin.pricePerBox")}</Label>
                <div className="flex items-center gap-2">
                  <Input name="pricePerBox" type="number" min={0} step={0.01} defaultValue={(editVariant as ProductVariant).pricePerBox ?? ""} className="mt-1" />
                  <span className="text-muted-foreground text-sm">֏</span>
                </div>
              </div>
              <div>
                <Label>{t("table.active")}</Label>
                <select
                  name="isActive"
                  defaultValue={String(editVariant.isActive)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
                >
                  <option value="true">{t("common.yes")}</option>
                  <option value="false">{t("common.no")}</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditVariant(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={updateVariantMutation.isPending}>
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Variant Dialog */}
      <AlertDialog open={!!deleteVariant} onOpenChange={(o) => !o && setDeleteVariant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("catalogAdmin.deleteVariantTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("catalogAdmin.deleteVariantDesc", { sku: deleteVariant?.sku ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVariant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Image Dialog */}
      <Dialog open={!!addImageVariant} onOpenChange={(o) => !o && setAddImageVariant(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("catalogAdmin.addImageFor", { sku: addImageVariant?.sku ?? "" })}</DialogTitle>
          </DialogHeader>
          {addImageVariant && (
            <form onSubmit={handleAddImageSubmit} className="space-y-4">
              <div>
                <Label>{t("catalogAdmin.imageUrl")}</Label>
                <Input name="imageUrl" type="url" required placeholder={t("catalogAdmin.imageUrlPlaceholder")} className="mt-1" />
              </div>
              <div>
                <Label>{t("catalogAdmin.sortOrder")}</Label>
                <Input name="sortOrder" type="number" defaultValue={0} className="mt-1" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddImageVariant(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={addImageMutation.isPending}>
                  {t("common.add")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Image Dialog */}
      <AlertDialog open={!!deleteImageVariant} onOpenChange={(o) => !o && setDeleteImageVariant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("catalogAdmin.removeImageTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("catalogAdmin.removeImageDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteImage}>{t("common.remove")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reorder Images Dialog */}
      <Dialog open={!!reorderImageVariant} onOpenChange={(o) => !o && setReorderImageVariant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("catalogAdmin.reorderImagesFor", { sku: reorderImageVariant?.sku ?? "" })}</DialogTitle>
          </DialogHeader>
          {reorderImageVariant && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {t("catalogAdmin.reorderHint")}
              </p>
              <div className="space-y-2">
                {reorderImageIds.map((imageId, idx) => {
                  const img = (reorderImageVariant.images ?? []).find((i) => i.id === imageId);
                  return (
                    <div
                      key={imageId}
                      className="flex items-center gap-2 rounded border p-2"
                    >
                      <div className="flex flex-col gap-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveImage(idx, -1)}
                          disabled={idx === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveImage(idx, 1)}
                          disabled={idx === reorderImageIds.length - 1}
                        >
                          ↓
                        </Button>
                      </div>
                      {img?.url.match(/\.(jpe?g|png|gif|webp)$/i) ? (
                        <img src={img.url} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <span className="h-12 w-12 rounded border bg-muted p-1 text-xs truncate">{img?.url ?? imageId}</span>
                      )}
                      <span className="text-muted-foreground text-sm">{idx + 1}</span>
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReorderImageVariant(null)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleReorderSubmit} disabled={reorderImageMutation.isPending}>
                  {t("catalogAdmin.saveOrder")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
