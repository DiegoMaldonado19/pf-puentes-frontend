# dev: lo usa compose.local.yaml con hot reload
FROM node:24.21.0-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]

FROM dev AS build
RUN npx ng build

FROM nginxinc/nginx-unprivileged:1.30.5-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/pf-puentes-frontend/browser /usr/share/nginx/html
EXPOSE 8080
