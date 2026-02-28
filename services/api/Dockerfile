# ─── Stage 1: Builder ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ─── Stage 2: Runner ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk --no-cache add wget

WORKDIR /app

# Copy package files and full node_modules from builder (includes tsx for prisma db seed)
COPY package.json package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules

# Copy from builder: Prisma schema, dist, and src (seed imports from src)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

EXPOSE 3000

# Migrations → seed (tsx) → start server
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/server.js"]
