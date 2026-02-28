/**
 * Auth types — JWT payload and user context.
 */
export type Role =
  | "super_admin"
  | "admin"
  | "manager"
  | "agent"
  | "client";

export interface AccessTokenPayload {
  sub: string;
  userId: string;
  role: Role;
  clientGroupId: string | null;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  userId: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  role: Role;
  clientGroupId: string | null;
  email: string;
  fullName: string;
  preferredLanguage: string;
  isActive: boolean;
}
