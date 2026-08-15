FROM node:22.22.0-alpine AS dependencies

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

ARG APP_SURFACE=customer
ARG APP_URL=http://localhost:3000
ARG CUSTOMER_APP_URL=http://localhost:3000
ARG STAFF_APP_URL=http://localhost:3001
ARG ACCOUNTS_ENABLED=true
ARG CLOUD_DESIGNS_ENABLED=true

ENV APP_SURFACE=$APP_SURFACE \
    NEXT_PUBLIC_APP_SURFACE=$APP_SURFACE \
    NEXT_PUBLIC_APP_URL=$APP_URL \
    NEXT_PUBLIC_CUSTOMER_APP_URL=$CUSTOMER_APP_URL \
    NEXT_PUBLIC_STAFF_APP_URL=$STAFF_APP_URL \
    NEXT_PUBLIC_ACCOUNTS_ENABLED=$ACCOUNTS_ENABLED \
    NEXT_PUBLIC_CLOUD_DESIGNS_ENABLED=$CLOUD_DESIGNS_ENABLED

COPY . .
RUN npm run build

FROM node:22.22.0-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
