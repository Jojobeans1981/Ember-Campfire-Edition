FROM oven/bun:1.3.12

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001

CMD ["/app/docker-entrypoint.sh"]
