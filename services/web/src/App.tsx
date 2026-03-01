import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/auth-context";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AppLayout } from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginPage } from "@/pages/LoginPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { CreateOrderPage } from "@/pages/CreateOrderPage";
import { EditOrderPage } from "@/pages/EditOrderPage";
import { OrderVersionEditPage } from "@/pages/OrderVersionEditPage";
import { OrderVersionsPage } from "@/pages/OrderVersionsPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRouteGuard } from "@/components/AdminRouteGuard";
import { SettingsPage } from "@/pages/SettingsPage";

// Lazy-loaded admin and report pages
const UsersAdminPage = lazy(() =>
  import("@/pages/admin/UsersAdminPage").then((m) => ({ default: m.UsersAdminPage }))
);
const ClientGroupsAdminPage = lazy(() =>
  import("@/pages/admin/ClientGroupsAdminPage").then((m) => ({ default: m.ClientGroupsAdminPage }))
);
const InventoryAdminPage = lazy(() =>
  import("@/pages/admin/InventoryAdminPage").then((m) => ({ default: m.InventoryAdminPage }))
);
const CatalogAdminPage = lazy(() =>
  import("@/pages/admin/CatalogAdminPage").then((m) => ({ default: m.CatalogAdminPage }))
);
const CreateProductPage = lazy(() =>
  import("@/pages/admin/CatalogAdminPage").then((m) => ({ default: m.CreateProductPage }))
);
const ProductAdminDetailPage = lazy(() =>
  import("@/pages/admin/CatalogAdminPage").then((m) => ({ default: m.ProductAdminDetailPage }))
);
const AuditLogsPage = lazy(() =>
  import("@/pages/admin/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage }))
);
const I18nAdminPage = lazy(() =>
  import("@/pages/admin/I18nAdminPage").then((m) => ({ default: m.I18nAdminPage }))
);
const ReportsLandingPage = lazy(() =>
  import("@/pages/reports/ReportsLandingPage").then((m) => ({ default: m.ReportsLandingPage }))
);
const SalesByDatePage = lazy(() =>
  import("@/pages/reports/SalesByDatePage").then((m) => ({ default: m.SalesByDatePage }))
);
const SalesByManagerPage = lazy(() =>
  import("@/pages/reports/SalesByManagerPage").then((m) => ({ default: m.SalesByManagerPage }))
);
const SalesByClientPage = lazy(() =>
  import("@/pages/reports/SalesByClientPage").then((m) => ({ default: m.SalesByClientPage }))
);
const SalesByProductPage = lazy(() =>
  import("@/pages/reports/SalesByProductPage").then((m) => ({ default: m.SalesByProductPage }))
);

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
    <Routes>
      <Route path="/" element={<Navigate to="/catalog" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/catalog" element={<AppLayout><CatalogPage /></AppLayout>} />
      <Route path="/catalog/:id" element={<AppLayout><ProductDetailPage /></AppLayout>} />
      <Route path="/orders" element={<AppLayout><ProtectedRoute><OrdersPage /></ProtectedRoute></AppLayout>} />
      <Route path="/orders/new" element={<AppLayout><ProtectedRoute><CreateOrderPage /></ProtectedRoute></AppLayout>} />
      <Route path="/orders/:id" element={<AppLayout><ProtectedRoute><OrderDetailPage /></ProtectedRoute></AppLayout>} />
      <Route path="/orders/:id/edit" element={<AppLayout><ProtectedRoute><EditOrderPage /></ProtectedRoute></AppLayout>} />
      <Route path="/orders/:id/version-edit" element={<AppLayout><ProtectedRoute><OrderVersionEditPage /></ProtectedRoute></AppLayout>} />
      <Route path="/orders/:id/versions" element={<AppLayout><ProtectedRoute><OrderVersionsPage /></ProtectedRoute></AppLayout>} />
      <Route path="/admin/users" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin"]}><UsersAdminPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/admin/client-groups" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin", "manager", "agent"]}><ClientGroupsAdminPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/admin/inventory" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin", "manager", "agent"]}><InventoryAdminPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/admin/catalog" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin"]}><CatalogAdminPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/admin/catalog/products/new" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin"]}><CreateProductPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/admin/catalog/products/:id" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin"]}><ProductAdminDetailPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/reports" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin", "manager", "agent"]}><ReportsLandingPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/reports/sales-by-date" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin", "manager", "agent"]}><SalesByDatePage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/reports/sales-by-manager" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin", "manager"]}><SalesByManagerPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/reports/sales-by-client" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin", "manager", "agent"]}><SalesByClientPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/reports/sales-by-product" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin", "manager", "agent"]}><SalesByProductPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/admin/audit" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin", "admin"]}><AuditLogsPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="/settings" element={<AppLayout><ProtectedRoute><SettingsPage /></ProtectedRoute></AppLayout>} />
      <Route path="/admin/i18n" element={<AppLayout><ProtectedRoute><AdminRouteGuard allowedRoles={["super_admin"]}><I18nAdminPage /></AdminRouteGuard></ProtectedRoute></AppLayout>} />
      <Route path="*" element={<Navigate to="/catalog" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <I18nProvider>
              <AppRoutes />
              <Toaster duration={5000} />
            </I18nProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
  );
}
