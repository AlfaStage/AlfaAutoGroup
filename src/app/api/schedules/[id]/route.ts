import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'

/**
 * @swagger
 * /api/schedules/{id}:
 *   patch:
 *     summary: Edita um agendamento existente
 *     description: Permite alterar status, tipo, conteúdo ou horário de um agendamento. O antiban ajustará o novo horário caso haja conflito.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do agendamento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               type:
 *                 type: string
 *               content:
 *                 type: object
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Agendamento atualizado.
 *       401:
 *         description: Não autorizado.
 *   delete:
 *     summary: Exclui um agendamento existente
 *     description: Remove o agendamento do banco de dados (cancela o disparo se ainda não tiver ocorrido).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do agendamento
 *     responses:
 *       200:
 *         description: Agendamento excluído.
 *       401:
 *         description: Não autorizado.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const data = await request.json()
    const { id } = await params
    
    const updateData: Record<string, unknown> = {}
    
    if (data.status) updateData.status = data.status
    if (data.type) updateData.type = data.type
    if (data.content) updateData.content = JSON.stringify(data.content)
    if (data.scheduledAt) {
      const requestedTime = new Date(data.scheduledAt)
      updateData.scheduledAt = requestedTime
      
      // Re-run anti-ban logic on edit
      const oneMinBefore = new Date(requestedTime.getTime() - 60000)
      const oneMinAfter = new Date(requestedTime.getTime() + 60000)

      const conflicts = await prisma.schedule.findMany({
        where: {
          status: 'pending',
          id: { not: id },
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
        updateData.adjustedAt = new Date(latestConflict.getTime() + (randomDelay * 1000))
      } else {
        updateData.adjustedAt = requestedTime
      }
    }

    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error("Erro ao atualizar agendamento:", error)
    return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    
    await prisma.schedule.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao deletar agendamento:", error)
    return NextResponse.json({ error: 'Falha ao excluir' }, { status: 500 })
  }
}
