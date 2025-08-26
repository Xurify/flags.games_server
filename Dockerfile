FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json ./
RUN bun install
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD bun run scripts/healthcheck.ts || exit 1
CMD ["bun", "run", "src/app.ts"]