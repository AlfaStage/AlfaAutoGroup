import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'

const prisma = new PrismaClient()

/** Chaves que o painel pode ler e gravar. */
const PERMITIDAS = new Set(['alertGroupId', 'alertsEnabled', 'dailyReportEnabled'])

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Configurações do painel
 *     description: Grupo que recebe alertas e relatórios, e os interruptores de cada um.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Configuração atual.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const linhas = await prisma.setting.findMany()
  const mapa: Record<string, string> = {}
  linhas.forEach(l => { mapa[l.key] = l.value })

  const alertGroup = mapa.alertGroupId
    ? await prisma.group.findUnique({
        where: { id: mapa.alertGroupId },
        select: { id: true, name: true, slug: true, instanceName: true }
      })
    : null

  return NextResponse.json({
    alertGroupId: mapa.alertGroupId || null,
    alertGroup,
    alertsEnabled: mapa.alertsEnabled !== 'false',
    dailyReportEnabled: mapa.dailyReportEnabled !== 'false'
  })
}

/**
 * @swagger
 * /api/settings:
 *   post:
 *     summary: Grava configurações do painel
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Configuração gravada.
 *       400:
 *         description: Chave não permitida.
 */
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Record<string, unknown>

    for (const [chave, valor] of Object.entries(body)) {
      if (!PERMITIDAS.has(chave)) {
        return NextResponse.json({ error: `Configuração desconhecida: ${chave}` }, { status: 400 })
      }
      await prisma.setting.upsert({
        where: { key: chave },
        update: { value: String(valor) },
        create: { key: chave, value: String(valor) }
      })
    }

    return NextResponse.json({ salvo: true })
  } catch (error) {
    console.error('Erro ao gravar configurações:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
