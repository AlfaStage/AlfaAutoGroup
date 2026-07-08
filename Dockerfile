FROM node:18-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

# Generate Prisma client before building
RUN npx prisma generate

# Define DATABASE_URL for build time to prevent Prisma from crashing
ENV DATABASE_URL="file:./prisma/dev.db"

# We removed RUN npm run build here so we can build at runtime and see the exact error logs
EXPOSE 3000

ENV PORT 3000

# O prisma db push garante que o banco SQLite seja inicializado
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm run build && npm start"]
