import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pragmaInitialized: boolean | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()
globalForPrisma.prisma = prisma

if (!globalForPrisma.pragmaInitialized) {
  globalForPrisma.pragmaInitialized = true
  prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;')
    .then(() => prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;'))
    .then(() => prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;'))
    .then(() => prisma.$executeRawUnsafe('PRAGMA temp_store = MEMORY;'))
    .catch(() => { /* ignora em ambiente sem arquivo */ })
}
