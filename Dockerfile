FROM node:20-slim

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

# Generate Prisma client before building
RUN npx prisma generate

# Define DATABASE_URL for build time to prevent Prisma from crashing
ENV DATABASE_URL="file:./prisma/dev.db"

RUN npm run build

EXPOSE 3000

ENV PORT 3000

# O prisma db push garante que o banco SQLite seja inicializado
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node seed.js && npm start"]
