# Cloud Run 用。next build の standalone 出力だけを小さいイメージに入れる
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# 画面からモックではなく本物の /api/interpret を呼ぶ（ビルド時に埋め込まれる）
ENV NEXT_PUBLIC_USE_API=1
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# 管理者（root）ではなく、node イメージに用意されている一般ユーザーで動かす
USER node
CMD ["node", "server.js"]
