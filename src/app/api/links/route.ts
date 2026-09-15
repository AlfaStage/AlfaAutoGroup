import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'

const prisma = new PrismaClient()

/**
 * @swagger
 * /api/links:
 *   get:
 *     summary: Links rastreados e seus cliques
 *     description: >
 *       Aceita `groupId` para filtrar por grupo e `days` para limitar a
 *       janela de tempo dos cliques (padrão 30 dias).
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de links com contagem de cliques.
 *       401:
 *         description: Não autorizado.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId') || undefined
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days')) || 30))
  const desde = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const links = await prisma.trackedLink.findMany({
    where: { ...(groupId ? { groupId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      _count: { select: { clicks: true } },
      clicks: {
        where: { clickedAt: { gte: desde } },
        select: { clickedAt: true },
        orderBy: { clickedAt: 'desc' },
        take: 500
      }
    }
  })

  // Nome do grupo sem um join por link
  const ids = Array.from(new Set(links.map(l => l.groupId).filter(Boolean))) as string[]
  const grupos = ids.length
    ? await prisma.group.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, participantCount: true }
      })
    : []
  const porId = new Map(grupos.map(g => [g.id, g]))

  return NextResponse.json(links.map(l => {
    const grupo = l.groupId ? porId.get(l.groupId) : null
    const cliquesNaJanela = l.clicks.length
    const membros = grupo?.participantCount || 0

    return {
      id: l.id,
      code: l.code,
      url: l.url,
      label: l.label,
      active: l.active,
      createdAt: l.createdAt,
      grupo: grupo ? { id: grupo.id, nome: grupo.name, membros } : null,
      cliquesTotal: l._count.clicks,
      cliquesNaJanela,
      // Proporção sobre o tamanho do grupo, quando conhecido
      taxa: membros > 0 ? Number((cliquesNaJanela / membros * 100).toFixed(1)) : null,
      ultimoClique: l.clicks[0]?.clickedAt || null
    }
  }))
}
