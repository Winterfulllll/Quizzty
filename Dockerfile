FROM oven/bun:1.3.2-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

FROM deps AS builder
COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/
COPY tsconfig.base.json ./
WORKDIR /app/apps/api
RUN bunx prisma generate
RUN bun run build

FROM oven/bun:1.3.2-alpine AS prod-deps
WORKDIR /app
COPY --from=builder /app/apps/api/package.json ./
RUN bun install --production

FROM node:22-alpine AS prisma-cli
WORKDIR /tmp/prisma
RUN npm init -y && npm install prisma@7.6.0

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prisma-cli /tmp/prisma/node_modules/prisma ./node_modules/prisma
COPY --from=prisma-cli /tmp/prisma/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/generated ./generated
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
