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
# API keys are injected at container start (not build time) by the nginx image's
# envsubst entrypoint, which renders /etc/nginx/templates/*.template.
# Defaults keep the rendered config valid when a key is not provided.
ENV NEWSAPI_KEY="" GUARDIAN_KEY="" NYT_KEY="" \
    NGINX_ENVSUBST_FILTER="_KEY$"
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
