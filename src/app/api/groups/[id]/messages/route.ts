import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'

/**
 * @swagger
 * /api/groups/{id}/messages:
 *   get:
 *     summary: Lista as mensagens do grupo
 *     description: Retorna o histórico das últimas 100 mensagens enviadas/recebidas no grupo armazenadas localmente.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo no banco de dados local.
 *     responses:
 *       200:
 *         description: Lista de mensagens.
 *       401:
 *         description: Não autorizado.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const messages = await prisma.message.findMany({
      where: { groupId: id },
      orderBy: { timestamp: 'asc' },
      take: 100 // Last 100 messages
    })

    const formattedMessages = messages.map(m => ({
      id: m.id,
      content: m.content,
      fromMe: m.sender === 'Sistema/Você',
      participant: m.sender !== 'Sistema/Você' ? m.sender.split('@')[0] : null,
      timestamp: m.timestamp
    }))

    return NextResponse.json(formattedMessages)
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
