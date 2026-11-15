FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# drop sourcemaps (9.6M) — debug-only, shouldn't be served publicly
RUN npm run build && rm -f dist/assets/*.map

# Official NGINX-maintained unprivileged variant: master runs as non-root,
# pid/temp paths live in /tmp, listens on 8080. Pinned to a verified stable
# release; bump deliberately (Docker Hub: nginxinc/nginx-unprivileged).
FROM nginxinc/nginx-unprivileged:1.30.6-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Numeric non-root user matching the homelab managed-runtime default. No chown
# needed: the content is world-readable and the base keeps pid/temp in /tmp.
# (The base's own uid 101 works too.)
USER 1000:1000
EXPOSE 8080
# busybox wget ships in the base image — no extra packages for the probe.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
