FROM node:20-alpine

WORKDIR /app

# Có thể cài thêm công cụ IPP client hoặc gói hỗ trợ CUPS nếu cần tích hợp sâu hơn
RUN apk add --no-cache curl bash

COPY package*.json ./
RUN npm install --only=production

COPY dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]

