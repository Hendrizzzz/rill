FROM node:24.18.0-alpine3.24 AS build

WORKDIR /workspace
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/index.html frontend/tsconfig*.json frontend/vite.config.ts frontend/eslint.config.js frontend/vercel.json ./
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.3-alpine3.24

COPY ops/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html

EXPOSE 8080
