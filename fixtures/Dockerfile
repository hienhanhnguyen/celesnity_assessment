FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY data ./data

ENV FIXTURES_PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
	CMD wget -qO- http://localhost:4000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "src/server.ts"]
