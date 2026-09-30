FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
RUN mkdir -p /app/private-storage && chown node:node /app/private-storage && chmod 700 /app/private-storage
USER node
EXPOSE 3000 4000
CMD ["npm","run","start","-w","@alia/api"]
