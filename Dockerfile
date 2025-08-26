FROM oven/bun:1.1.42-alpine AS base

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["bun", "run", "src/app.ts"]