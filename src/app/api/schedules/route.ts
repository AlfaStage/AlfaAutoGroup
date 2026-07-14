import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'

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
 *               type:
 *                 type: string
 *                 enum: [text, media, button, poll]
 *               content:
 *                 type: object
 *                 description: O conteúdo da mensagem em JSON. Exemplo para texto { text: "Olá" }.
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
    const data = await request.json()
    const { groupId, groupIds, type, content, scheduledAt } = data
    
    // Suportar tanto array (groupIds) quanto string (groupId) para compatibilidade
    const groupsToSchedule = Array.isArray(groupIds) && groupIds.length > 0 
      ? groupIds 
      : (groupId ? [groupId] : [])

    if (groupsToSchedule.length === 0) {
      return NextResponse.json({ error: 'É necessário informar groupId ou groupIds' }, { status: 400 })
    }

    const requestedTime = new Date(scheduledAt)
    const createdSchedules = []

    for (const gid of groupsToSchedule) {
      let adjustedAt = new Date(requestedTime)
      const oneMinBefore = new Date(adjustedAt.getTime() - 60000)
      const oneMinAfter = new Date(adjustedAt.getTime() + 60000)

      const conflicts = await prisma.schedule.findMany({
        where: {
          status: 'pending',
          adjustedAt: {
            gte: oneMinBefore,
            lte: oneMinAfter,
          }
        },
        orderBy: { adjustedAt: 'desc' }
      })

      if (conflicts.length > 0) {
        const latestConflict = conflicts[0].adjustedAt
        const randomDelay = Math.floor(Math.random() * (60 - 15 + 1)) + 15
        adjustedAt = new Date(latestConflict.getTime() + (randomDelay * 1000))
      }

      const schedule = await prisma.schedule.create({
        data: {
          groupId: gid,
          type,
          content: JSON.stringify(content),
          scheduledAt: requestedTime,
          adjustedAt,
          status: 'pending'
        }
      })
      createdSchedules.push(schedule)
      
      // Update requestedTime slightly for the next iteration to simulate base shift
      // Just so it stacks delays correctly for huge arrays
      if (groupsToSchedule.length > 1) {
          requestedTime.setTime(adjustedAt.getTime());
      }
    }

    return NextResponse.json(createdSchedules.length === 1 ? createdSchedules[0] : createdSchedules)
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
