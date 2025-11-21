// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Função para testar conexão
export async function testDatabaseConnection() {
  try {
    await prisma.$connect()
    console.log('✅ Banco de dados conectado com sucesso!')
    return true
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de dados:', error)
    return false
  }
}
