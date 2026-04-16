FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY index.html ./
COPY vite.config.js ./
COPY mock-util.js ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts
COPY mock-fs ./mock-fs

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
