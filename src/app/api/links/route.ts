import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'

/**
 * @swagger
 * /api/links:
 *   get:
 *     summary: Links rastreados e seus cliques (com atribuição por ?grupid= e mapa de calor por hora)
 *     description: >
 *       Aceita `groupId` para filtrar por grupo e `days` para limitar a
 *       janela de tempo dos cliques (padrão 30 dias).
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de links com contagem de cliques totais, únicos, por grupo/tag e por hora.
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
    where: groupId
      ? {
          OR: [
            { groupId },
            { clicks: { some: { groupId, clickedAt: { gte: desde } } } }
          ]
        }
      : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      _count: { select: { clicks: true } },
      clicks: {
        where: {
          clickedAt: { gte: desde },
          ...(groupId ? { OR: [{ groupId }, { groupId: null }] } : {})
        },
        select: {
          clickedAt: true,
          groupId: true,
          isUnique: true,
          hour: true
        },
        orderBy: { clickedAt: 'desc' },
        take: 1500
      }
    }
  })

  // Coletar todos os groupIds presentes nos links ou nos cliques (?grupid=)
  const allGroupIds = new Set<string>()
  for (const l of links) {
    if (l.groupId) allGroupIds.add(l.groupId)
    for (const c of l.clicks) {
      if (c.groupId) allGroupIds.add(c.groupId)
    }
  }

  const ids = Array.from(allGroupIds)
  const grupos = ids.length
    ? await prisma.group.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          slug: true,
          participantCount: true,
          tags: {
            include: { tag: { select: { id: true, name: true, color: true } } },
            orderBy: { position: 'asc' },
            take: 1
          }
        }
      })
    : []
  const porId = new Map(grupos.map(g => [g.id, g]))

  return NextResponse.json(
    links.map(l => {
      const grupoBase = l.groupId ? porId.get(l.groupId) : null
      const cliquesFiltrados = groupId
        ? l.clicks.filter(c => (c.groupId || l.groupId) === groupId)
        : l.clicks

      const cliquesNaJanela = cliquesFiltrados.length
      let cliquesUnicos = 0
      const porGrupoMap = new Map<string, { total: number; unicos: number }>()
      const porHora = Array.from({ length: 24 }, () => 0)

      for (const c of cliquesFiltrados) {
        const unico = c.isUnique !== false
        if (unico) cliquesUnicos++

        const gid = c.groupId || l.groupId || 'direto'
        const atual = porGrupoMap.get(gid) || { total: 0, unicos: 0 }
        atual.total++
        if (unico) atual.unicos++
        porGrupoMap.set(gid, atual)

        const h = typeof c.hour === 'number' && c.hour >= 0 && c.hour <= 23
          ? c.hour
          : new Date(c.clickedAt).getHours()
        if (porHora[h] !== undefined) porHora[h]++
      }

      const porGrupo = Array.from(porGrupoMap.entries())
        .map(([gid, st]) => {
          const g = gid !== 'direto' ? porId.get(gid) : null
          const tag = g?.tags?.[0]?.tag || null
          return {
            groupId: gid === 'direto' ? null : gid,
            nome: g?.name || (gid === 'direto' ? 'Sem grupo (?grupid ausente)' : gid),
            slug: g?.slug || null,
            membros: g?.participantCount || 0,
            tag: tag ? { id: tag.id, nome: tag.name, cor: tag.color } : null,
            cliques: st.total,
            unicos: st.unicos
          }
        })
        .sort((a, b) => b.cliques - a.cliques)

      const membrosReferencia = grupoBase?.participantCount ||
        porGrupo.reduce((acc, g) => acc + (g.membros || 0), 0)

      return {
        id: l.id,
        code: l.code,
        url: l.url,
        label: l.label,
        active: l.active,
        createdAt: l.createdAt,
        grupo: grupoBase
          ? {
              id: grupoBase.id,
              nome: grupoBase.name,
              slug: grupoBase.slug,
              membros: grupoBase.participantCount || 0,
              tag: grupoBase.tags?.[0]?.tag
                ? {
                    id: grupoBase.tags[0].tag.id,
                    nome: grupoBase.tags[0].tag.name,
                    cor: grupoBase.tags[0].tag.color
                  }
                : null
            }
          : null,
        cliquesTotal: l._count.clicks,
        cliquesNaJanela,
        cliquesUnicos,
        porGrupo,
        porHora,
        taxa: membrosReferencia > 0
          ? Number(((cliquesUnicos / membrosReferencia) * 100).toFixed(1))
          : null,
        ultimoClique: cliquesFiltrados[0]?.clickedAt || null
      }
    })
  )
}

