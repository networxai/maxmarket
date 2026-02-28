/**
 * Auth service — login, refresh (rotation), logout.
 * Passwords: bcrypt. Refresh tokens: JWT signed, hash stored in DB (SHA-256).
 */
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { sha256 } from "../lib/hash.js";
import { appConfig } from "../config.js";
import type { AccessTokenPayload, RefreshTokenPayload, AuthUser } from "./types.js";
import { writeAudit } from "../audit/audit-service.js";

const BCRYPT_ROUNDS = 12;

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function signAccessToken(payload: Omit<AccessTokenPayload, "iat" | "exp">): string {
  return jwt.sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    } as AccessTokenPayload,
    appConfig.jwt.accessSecret,
    { algorithm: "HS256" }
  );
}

function signRefreshToken(userId: string, jti: string): string {
  const payload: Omit<RefreshTokenPayload, "iat" | "exp" | "jti"> = {
    sub: userId,
    userId,
  };
  return jwt.sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    } as RefreshTokenPayload,
    appConfig.jwt.refreshSecret,
    { algorithm: "HS256", jwtid: jti }
  );
}

function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, appConfig.jwt.refreshSecret, {
    algorithms: ["HS256"],
  }) as RefreshTokenPayload;
  return decoded;
}

function userToAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  preferredLanguage: string;
  clientGroupId: string | null;
  isActive: boolean;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as AuthUser["role"],
    preferredLanguage: user.preferredLanguage,
    clientGroupId: user.clientGroupId,
    isActive: user.isActive,
  };
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function login(
  email: string,
  password: string,
  opts: { ipAddress?: string; userAgent?: string; correlationId?: string }
): Promise<LoginResult> {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
  });

  if (!user || !user.isActive) {
    await writeAudit({
      eventType: "auth.login_attempt",
      payload: {
        attemptedEmail: email,
        userId: null,
        success: false,
        ipAddress: opts.ipAddress ?? null,
        userAgent: opts.userAgent ?? null,
      },
      correlationId: opts.correlationId ?? undefined,
      ipAddress: opts.ipAddress ?? undefined,
    });
    throw new Error("INVALID_CREDENTIALS");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await writeAudit({
      eventType: "auth.login_attempt",
      actorId: user.id,
      actorRole: user.role,
      payload: {
        attemptedEmail: email,
        userId: user.id,
        success: false,
        ipAddress: opts.ipAddress ?? null,
        userAgent: opts.userAgent ?? null,
      },
      correlationId: opts.correlationId ?? undefined,
      ipAddress: opts.ipAddress ?? undefined,
    });
    throw new Error("INVALID_CREDENTIALS");
  }

  const jti = randomUUID();
  const refreshToken = signRefreshToken(user.id, jti);
  const tokenHash = sha256(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  await writeAudit({
    eventType: "auth.login_attempt",
    actorId: user.id,
    actorRole: user.role,
    payload: {
      attemptedEmail: email,
      userId: user.id,
      success: true,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
    },
    correlationId: opts.correlationId ?? undefined,
    ipAddress: opts.ipAddress ?? undefined,
  });

  const accessToken = signAccessToken({
    sub: user.id,
    userId: user.id,
    role: user.role as AccessTokenPayload["role"],
    clientGroupId: user.clientGroupId,
  });

  return {
    accessToken,
    refreshToken,
    user: userToAuthUser(user),
  };
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export async function refresh(refreshTokenRaw: string): Promise<RefreshResult> {
  try {
    verifyRefreshToken(refreshTokenRaw);
  } catch {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const tokenHash = sha256(refreshTokenRaw);
  const record = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  if (record.usedAt !== null) {
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId },
      data: { usedAt: new Date() },
    });
    throw new Error("REFRESH_TOKEN_REUSED");
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const jti = randomUUID();
  const newRefreshToken = signRefreshToken(record.userId, jti);
  const newHash = sha256(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: record.userId,
      tokenHash: newHash,
      expiresAt,
    },
  });

  const accessToken = signAccessToken({
    sub: record.user.id,
    userId: record.user.id,
    role: record.user.role as AccessTokenPayload["role"],
    clientGroupId: record.user.clientGroupId,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logout(refreshTokenRaw: string): Promise<void> {
  const tokenHash = sha256(refreshTokenRaw);
  const record = await prisma.refreshToken.findFirst({
    where: { tokenHash },
  });
  if (record) {
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  }
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, appConfig.jwt.accessSecret, {
    algorithms: ["HS256"],
  }) as AccessTokenPayload;
  return decoded;
}
