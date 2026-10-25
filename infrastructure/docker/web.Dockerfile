FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci
COPY . .
ARG API_INTERNAL_URL=http://api:4000
ARG SITE_URL
ENV API_INTERNAL_URL=$API_INTERNAL_URL SITE_URL=$SITE_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @kt/web
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER node
CMD ["node","node_modules/next/dist/bin/next","start","apps/web","--port","3000","--hostname","0.0.0.0"]
