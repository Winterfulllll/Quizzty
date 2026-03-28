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

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/generated ./generated
COPY --from=builder /app/apps/api/package.json ./
EXPOSE 4000
CMD ["node", "dist/main.js"]
