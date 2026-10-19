import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'
import { CATALOGO_VARIAVEIS } from '@shared/variables'

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || undefined
    const tagId = searchParams.get('tagId') || undefined
    const instanceName = searchParams.get('instanceName') || undefined
    const campaign = searchParams.get('campaign') || undefined
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days')) || 14))
    const desde = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const whereGroup: any = {}
    if (instanceName) whereGroup.instanceName = instanceName
    if (tagId) whereGroup.tags = { some: { tagId } }

    const schedules = await prisma.schedule.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {
          OR: [
            { status: { in: ['pending', 'processing', 'deactivated', 'error'] } },
            { updatedAt: { gte: desde } }
          ]
        }),
        ...(campaign ? { campaign } : {}),
        ...(Object.keys(whereGroup).length > 0 ? { group: whereGroup } : {})
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
            instanceName: true,
            participantCount: true,
            tags: {
              include: { tag: { select: { id: true, name: true, color: true } } },
              orderBy: { position: 'asc' },
              take: 1
            }
          }
        }
      },
      orderBy: { adjustedAt: 'asc' },
      take: 400
    })

    // Buscar cliques de links associados a agendamentos para enriquecer métricas de campanhas
    const scheduleIdsWithCampaign = schedules.filter(s => s.campaign).map(s => s.id)
    const trackedLinks = scheduleIdsWithCampaign.length > 0
      ? await prisma.trackedLink.findMany({
          where: { scheduleId: { in: scheduleIdsWithCampaign } },
          select: {
            scheduleId: true,
            _count: { select: { clicks: true } }
          }
        })
      : []

    const clicksByScheduleId = new Map<string, number>()
    for (const tl of trackedLinks) {
      if (tl.scheduleId) {
        clicksByScheduleId.set(
          tl.scheduleId,
          (clicksByScheduleId.get(tl.scheduleId) || 0) + tl._count.clicks
        )
      }
    }

    const campanhasMap = new Map<
      string,
      {
        nome: string
        total: number
        enviados: number
        pendentes: number
        pausados: number
        falhados: number
        gruposSet: Set<string>
        membrosAlcancados: number
        cliques: number
        ultimoDisparo: Date | null
      }
    >()

    let pendentes = 0
    let pausados = 0
    let enviadosRecentes = 0
    let errosPendentes = 0

    const timeline = schedules.map(s => {
      if (s.status === 'pending' || s.status === 'processing') pendentes++
      else if (s.status === 'deactivated') pausados++
      else if (s.status === 'sent') enviadosRecentes++
      else if (s.status === 'error') errosPendentes++

      const campName = s.campaign ? String(s.campaign).trim() : null
      if (campName) {
        let c = campanhasMap.get(campName)
        if (!c) {
          c = {
            nome: campName,
            total: 0,
            enviados: 0,
            pendentes: 0,
            pausados: 0,
            falhados: 0,
            gruposSet: new Set(),
            membrosAlcancados: 0,
            cliques: 0,
            ultimoDisparo: null
          }
          campanhasMap.set(campName, c)
        }
        c.total++
        if (s.status === 'sent') c.enviados++
        else if (s.status === 'pending' || s.status === 'processing') c.pendentes++
        else if (s.status === 'deactivated') c.pausados++
        else if (s.status === 'error') c.falhados++

        if (s.group?.id && !c.gruposSet.has(s.group.id)) {
          c.gruposSet.add(s.group.id)
          c.membrosAlcancados += s.group.participantCount || 0
        }
        c.cliques += clicksByScheduleId.get(s.id) || 0
        if (!c.ultimoDisparo || new Date(s.adjustedAt) > new Date(c.ultimoDisparo)) {
          c.ultimoDisparo = s.adjustedAt
        }
      }

      let resumoConteudo = ''
      try {
        const parsed = JSON.parse(s.content)
        resumoConteudo =
          parsed.text ||
          parsed.caption ||
          parsed.title ||
          parsed.name ||
          parsed.description ||
          s.type
      } catch {
        resumoConteudo = s.type
      }

      const tag = s.group?.tags?.[0]?.tag || null

      return {
        id: s.id,
        type: s.type,
        status: s.status,
        campaign: s.campaign || null,
        scheduledAt: s.scheduledAt,
        adjustedAt: s.adjustedAt,
        errorMessage: s.errorMessage || null,
        resumo: String(resumoConteudo || '').slice(0, 140),
        cliques: clicksByScheduleId.get(s.id) || 0,
        grupo: s.group
          ? {
              id: s.group.id,
              nome: s.group.name,
              slug: s.group.slug,
              instanceName: s.group.instanceName,
              membros: s.group.participantCount || 0,
              tag: tag ? { id: tag.id, nome: tag.name, cor: tag.color } : null
            }
          : null
      }
    })

    const campanhas = Array.from(campanhasMap.values())
      .map(c => ({
        nome: c.nome,
        total: c.total,
        enviados: c.enviados,
        pendentes: c.pendentes,
        pausados: c.pausados,
        falhados: c.falhados,
        grupos: c.gruposSet.size,
        membrosAlcancados: c.membrosAlcancados,
        cliques: c.cliques,
        ctr:
          c.membrosAlcancados > 0
            ? Number(((c.cliques / c.membrosAlcancados) * 100).toFixed(1))
            : 0,
        ultimoDisparo: c.ultimoDisparo
      }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      resumoFila: {
        pendentes,
        pausados,
        enviadosRecentes,
        errosPendentes
      },
      timeline,
      campanhas,
      catalogoVariaveis: CATALOGO_VARIAVEIS
    })
  } catch (error) {
    console.error('[queue GET] erro:', error)
    return NextResponse.json({ error: 'Erro ao consultar fila e campanhas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const action = String(body?.action || '')
    const tagId = body?.tagId ? String(body.tagId) : undefined
    const instanceName = body?.instanceName ? String(body.instanceName) : undefined
    const groupId = body?.groupId ? String(body.groupId) : undefined
    const campaign = body?.campaign ? String(body.campaign) : undefined
    const scheduleIds: string[] | undefined = Array.isArray(body?.scheduleIds)
      ? body.scheduleIds
      : undefined

    const whereGroup: any = {}
    if (instanceName) whereGroup.instanceName = instanceName
    if (tagId) whereGroup.tags = { some: { tagId } }

    const baseFilter: any = {
      ...(groupId ? { groupId } : {}),
      ...(campaign ? { campaign } : {}),
      ...(scheduleIds && scheduleIds.length > 0 ? { id: { in: scheduleIds } } : {}),
      ...(Object.keys(whereGroup).length > 0 ? { group: whereGroup } : {})
    }

    if (action === 'pause') {
      const updated = await prisma.schedule.updateMany({
        where: {
          ...baseFilter,
          status: 'pending'
        },
        data: {
          status: 'deactivated',
          skipReason: 'Pausado manualmente pelo controle de fila'
        }
      })
      return NextResponse.json({ ok: true, action: 'pause', affected: updated.count })
    }

    if (action === 'resume') {
      const toResume = await prisma.schedule.findMany({
        where: {
          ...baseFilter,
          status: 'deactivated'
        },
        orderBy: { adjustedAt: 'asc' }
      })

      const now = Date.now()
      let cursorTime = now + 15000

      for (const sch of toResume) {
        const origTime = new Date(sch.adjustedAt).getTime()
        const nextAdjusted = origTime > now ? new Date(origTime) : new Date(cursorTime)
        if (origTime <= now) {
          cursorTime += (20 + Math.floor(Math.random() * 25)) * 1000
        }
        await prisma.schedule.update({
          where: { id: sch.id },
          data: {
            status: 'pending',
            adjustedAt: nextAdjusted,
            skipReason: null
          }
        })
      }

      return NextResponse.json({ ok: true, action: 'resume', affected: toResume.length })
    }

    if (action === 'delay') {
      const minutes = Number(body?.minutes) || 30
      const deltaMs = minutes * 60 * 1000

      const toDelay = await prisma.schedule.findMany({
        where: {
          ...baseFilter,
          status: 'pending'
        },
        select: { id: true, scheduledAt: true, adjustedAt: true }
      })

      for (const sch of toDelay) {
        await prisma.schedule.update({
          where: { id: sch.id },
          data: {
            scheduledAt: new Date(new Date(sch.scheduledAt).getTime() + deltaMs),
            adjustedAt: new Date(new Date(sch.adjustedAt).getTime() + deltaMs)
          }
        })
      }

      return NextResponse.json({
        ok: true,
        action: 'delay',
        minutes,
        affected: toDelay.length
      })
    }

    return NextResponse.json({ error: 'Ação inválida (use pause, resume ou delay)' }, { status: 400 })
  } catch (error) {
    console.error('[queue POST] erro:', error)
    return NextResponse.json({ error: 'Erro ao executar controle de fila' }, { status: 500 })
  }
}
