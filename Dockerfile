FROM oven/bun:1.4.2-debian
WORKDIR /app
COPY package.json bun.lock tsconfig.json turbo.json ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tests ./tests
RUN bun install --frozen-lockfile
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build bun run db:generate
RUN bun run build
ENV NODE_ENV=production HOST=0.0.0.0
USER bun
CMD ["bun", "apps/api/src/index.ts"]
