import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'
import { validateScheduleContent, isGroupActionType } from '@/lib/schedule-types'
import { aplicarRastreio } from '@/lib/tracked-links'

/**
 * @swagger
 * /api/schedules:
 *   get:
 *     summary: Lista agendamentos de um grupo
 *     description: Retorna os agendamentos pendentes ou processados de um grupo específico.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo local.
 *     responses:
 *       200:
 *         description: Lista de agendamentos.
 *       400:
 *         description: Group ID ausente.
 *       401:
 *         description: Não autorizado.
 *   post:
 *     summary: Cria novos agendamentos de mensagem
 *     description: Agenda uma mensagem para ser enviada a um ou múltiplos grupos. Os disparos simultâneos recebem espaçamento automático.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: ID de um grupo único.
 *               groupIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Lista de IDs de múltiplos grupos (opcional se enviar groupId).
 *               schedules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [text, media, button, poll, permission, profile]
 *                     content:
 *                       type: object
 *                     scheduledAt:
 *                       type: string
 *                       format: date-time
 *                 description: Lista de múltiplos agendamentos para disparar em cada grupo.
 *               type:
 *                 type: string
 *                 enum: [text, media, button, poll, permission, profile]
 *               content:
 *                 type: object
 *                 description: "O conteúdo da mensagem em JSON. Exemplo para texto { text: 'Olá' }."
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Agendamento(s) criado(s) com sucesso. Retorna array de agendamentos criados.
 *       401:
 *         description: Não autorizado.
 */
export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const rawData = await request.json()
    
    // Suportar tanto array de agendamentos, objeto com { groupIds, schedules }, ou objeto simples
    const items: Array<{ groupIds: string[]; type: string; content: any; scheduledAt: string }> = []

    if (Array.isArray(rawData)) {
      for (const item of rawData) {
        const gids = Array.isArray(item.groupIds) && item.groupIds.length > 0
          ? item.groupIds
          : (item.groupId ? [item.groupId] : [])
        if (gids.length > 0 && item.type && item.content && item.scheduledAt) {
          items.push({ groupIds: gids, type: item.type, content: item.content, scheduledAt: item.scheduledAt })
        }
      }
    } else if (rawData && Array.isArray(rawData.schedules) && rawData.schedules.length > 0) {
      const gids = Array.isArray(rawData.groupIds) && rawData.groupIds.length > 0
        ? rawData.groupIds
        : (rawData.groupId ? [rawData.groupId] : [])
      for (const sch of rawData.schedules) {
        const itemGids = Array.isArray(sch.groupIds) && sch.groupIds.length > 0
          ? sch.groupIds
          : (sch.groupId ? [sch.groupId] : gids)
        if (itemGids.length > 0 && sch.type && sch.content && sch.scheduledAt) {
          items.push({ groupIds: itemGids, type: sch.type, content: sch.content, scheduledAt: sch.scheduledAt })
        }
      }
    } else if (rawData) {
      const gids = Array.isArray(rawData.groupIds) && rawData.groupIds.length > 0
        ? rawData.groupIds
        : (rawData.groupId ? [rawData.groupId] : [])
      items.push({ groupIds: gids, type: rawData.type, content: rawData.content, scheduledAt: rawData.scheduledAt })
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Nenhum agendamento válido informado' }, { status: 400 })
    }

    // Validar antes de gravar
    for (const item of items) {
      if (item.groupIds.length === 0) {
        return NextResponse.json({ error: 'É necessário informar groupId ou groupIds' }, { status: 400 })
      }
      const problema = validateScheduleContent(item.type, item.content)
      if (problema) {
        return NextResponse.json({ error: problema }, { status: 400 })
      }
      const requestedTime = new Date(item.scheduledAt)
      if (isNaN(requestedTime.getTime())) {
        return NextResponse.json({ error: 'scheduledAt inválido' }, { status: 400 })
      }
    }

    const host = request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') || 'http'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? proto + '://' + host : '')

    const createdSchedules = []

    for (const item of items) {
      const acaoDeGrupo = isGroupActionType(item.type)
      const requestedTime = new Date(item.scheduledAt)

      for (const gid of item.groupIds) {
        let adjustedAt = new Date(requestedTime)
        const oneMinBefore = new Date(adjustedAt.getTime() - 60000)
        const oneMinAfter = new Date(adjustedAt.getTime() + 60000)

        const conflicts = acaoDeGrupo ? [] : await prisma.schedule.findMany({
          where: {
            status: 'pending',
            adjustedAt: {
              gte: oneMinBefore,
              lte: oneMinAfter,
            }
          },
          orderBy: { adjustedAt: 'desc' }
        })

        if (!acaoDeGrupo && conflicts.length > 0) {
          const latestConflict = conflicts[0].adjustedAt
          const randomDelay = Math.floor(Math.random() * (60 - 15 + 1)) + 15
          adjustedAt = new Date(latestConflict.getTime() + (randomDelay * 1000))
        }

        // Cada grupo ganha os proprios codigos, para o clique dizer de onde veio.
        const rastreado = await aplicarRastreio(item.type, item.content, baseUrl, gid)

        const schedule = await prisma.schedule.create({
          data: {
            groupId: gid,
            type: item.type,
            content: JSON.stringify(rastreado.content),
            scheduledAt: requestedTime,
            adjustedAt,
            status: 'pending'
          }
        })

        if (rastreado.links.length) {
          await prisma.trackedLink.updateMany({
            where: { id: { in: rastreado.links.map((l: any) => l.id) } },
            data: { scheduleId: schedule.id }
          })
        }

        createdSchedules.push(schedule)

        if (!acaoDeGrupo && item.groupIds.length > 1) {
          requestedTime.setTime(adjustedAt.getTime())
        }
      }
    }

    const retornaUnico = createdSchedules.length === 1 && !Array.isArray(rawData) && !rawData?.schedules
    return NextResponse.json(retornaUnico ? createdSchedules[0] : createdSchedules)
  } catch (error) {
    console.error("Erro ao criar agendamento(s):", error)
    return NextResponse.json({ error: 'Falha ao agendar' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId')

  if (!groupId) return NextResponse.json({error: 'Group ID is required'}, {status:400})

  const schedules = await prisma.schedule.findMany({
    where: { groupId },
    orderBy: { adjustedAt: 'asc' }
  })
  return NextResponse.json(schedules)
}
