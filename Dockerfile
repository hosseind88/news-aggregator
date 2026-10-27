# syntax=docker/dockerfile:1

# ---- Build stage: compile the static bundle ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Serve stage: nginx serves the SPA and proxies the news APIs ----
FROM nginx:1.27-alpine
# API keys (NEWSAPI_KEY, GUARDIAN_KEY, NYT_KEY) are injected at container start, never baked in,
# by the nginx image's envsubst entrypoint, which renders /etc/nginx/templates/*.template.
# 05-default-keys.envsh defaults any key that is not provided to empty so the config stays valid.
# Upstream hosts, cache TTL and rate limits are overridable the same way (the e2e stack points
# the upstreams at a mock). Only variables matching the filter are substituted.
ENV NEWSAPI_UPSTREAM="https://newsapi.org" \
    GUARDIAN_UPSTREAM="https://content.guardianapis.com" \
    NYT_UPSTREAM="https://api.nytimes.com" \
    API_CACHE_TTL="60s" API_RATE="20r/s" API_BURST="40" \
    NGINX_ENVSUBST_FILTER="_(KEY|UPSTREAM|CACHE_TTL|RATE|BURST)$"
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 docker/nginx/05-default-keys.envsh /docker-entrypoint.d/05-default-keys.envsh
COPY docker/nginx/security-headers.conf docker/nginx/api-proxy.conf /etc/nginx/snippets/
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
