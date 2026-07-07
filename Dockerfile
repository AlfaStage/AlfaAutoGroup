FROM node:18-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

# Generate Prisma client before building
RUN npx prisma generate

RUN npm run build

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# O prisma db push garante que o banco SQLite seja inicializado na primeira execução no Coolify
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm start"]
