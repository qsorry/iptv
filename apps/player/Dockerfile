# استضافة نسخة الويب من Ssouq Net (للمتصفح وتلفزيونات VIDAA) كموقع ثابت.
# في Coolify: تطبيق جديد من نفس المستودع، Base Directory = apps/player، Build Pack = Dockerfile.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_API_BASE=https://com.ssouq.net
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
