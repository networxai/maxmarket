import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import type { Role } from "@/types/api";

interface AdminRouteGuardProps {
  children: ReactNode;
  /** Roles allowed. User must be one of these. */
  allowedRoles: Role[];
}

export function AdminRouteGuard({ children, allowedRoles }: AdminRouteGuardProps) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/catalog" replace />;
  }

  return <>{children}</>;
}
