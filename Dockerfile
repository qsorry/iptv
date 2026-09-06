# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# متغيرات NEXT_PUBLIC_* تُدمج وقت البناء؛ تُمرَّر من Coolify كـ Build Args.
ARG NEXT_PUBLIC_APP_URL
# قيم مؤقتة لاجتياز التحقق وقت البناء فقط؛ القيم الحقيقية تأتي وقت التشغيل.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-secret-not-used-at-runtime
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# curl مطلوب لفحص الصحة الذي يشغّله Coolify داخل الحاوية.
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
# ملفات الهجرة + سكربت تطبيقها عند الإقلاع.
# مخرجات standalone لا تتضمن الحزم كاملة، لذا نضع drizzle-orm و postgres (بلا تبعيات)
# بجانب السكربت مباشرة حتى يجدها Node عند الإقلاع.
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=deps --chown=app:app /app/node_modules/drizzle-orm ./scripts/node_modules/drizzle-orm
COPY --from=deps --chown=app:app /app/node_modules/postgres ./scripts/node_modules/postgres

USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD curl -fsS http://localhost:3000/api/health || exit 1
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
