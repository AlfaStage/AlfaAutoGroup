import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"

async function isAuthenticated(request: Request) {
  const aiToken = request.headers.get('authorization')?.replace('Bearer ', '');
  if (aiToken && aiToken === process.env.AI_API_KEY) return true;
  const session = await getServerSession();
  if (session) return true;
  return false;
}

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
 *     summary: Cria um novo agendamento de mensagem
 *     description: Agenda uma mensagem para ser enviada a um grupo em uma data/hora específica.
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
 *         description: Agendamento criado com sucesso.
 *       401:
 *         description: Não autorizado.
 */
export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await request.json()
    const { groupId, type, content, scheduledAt } = data
    
    const requestedTime = new Date(scheduledAt)
    let adjustedAt = new Date(scheduledAt)

    const oneMinBefore = new Date(requestedTime.getTime() - 60000)
    const oneMinAfter = new Date(requestedTime.getTime() + 60000)

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
        groupId,
        type,
        content: JSON.stringify(content),
        scheduledAt: requestedTime,
        adjustedAt,
        status: 'pending'
      }
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error("Erro ao criar agendamento:", error)
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
