import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'
import { validateScheduleContent, isGroupActionType } from '@/lib/schedule-types'
import { aplicarRastreio } from '@/lib/tracked-links'

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

    const atual = await prisma.schedule.findUnique({ where: { id } })
    if (!atual) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

    const updateData: Record<string, unknown> = {}
    const tipoFinal = data.type || atual.type

    // Conteúdo passa pela mesma validação da criação — inclusive as regras
    // de combinação de botões e de permissões.
    if (data.content !== undefined) {
      const problema = validateScheduleContent(tipoFinal, data.content)
      if (problema) return NextResponse.json({ error: problema }, { status: 400 })

      const host = request.headers.get('host')
      const proto = request.headers.get('x-forwarded-proto') || 'http'
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? proto + '://' + host : '')

      // Links marcados para rastreio no conteúdo novo ganham código e
      // ficam amarrados a este agendamento.
      const rastreado = await aplicarRastreio(tipoFinal, data.content, baseUrl, atual.groupId)
      updateData.content = JSON.stringify(rastreado.content)

      if (rastreado.links.length) {
        await prisma.trackedLink.updateMany({
          where: { id: { in: rastreado.links.map((l: any) => l.id) } },
          data: { scheduleId: id }
        })
      }
    }

    if (data.type) updateData.type = data.type

    if (data.status) {
      const permitidos = ['pending', 'deactivated', 'error', 'sent', 'skipped']
      if (!permitidos.includes(data.status)) {
        return NextResponse.json(
          { error: `Status inválido: "${data.status}". Aceitos: ${permitidos.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.status = data.status
      // Reativar zera o histórico de falha, senão o agendamento volta
      // carregando um erro que já foi resolvido.
      if (data.status === 'pending') {
        updateData.errorMessage = null
        updateData.attempts = 0
      }
    }

    if (data.scheduledAt) {
      const requestedTime = new Date(data.scheduledAt)
      if (isNaN(requestedTime.getTime())) {
        return NextResponse.json({ error: 'scheduledAt inválido' }, { status: 400 })
      }
      updateData.scheduledAt = requestedTime

      // Permissão e perfil não sofrem o jitter: fechar o grupo às 22h
      // precisa ser às 22h.
      if (isGroupActionType(tipoFinal)) {
        updateData.adjustedAt = requestedTime
      } else {
        const oneMinBefore = new Date(requestedTime.getTime() - 60000)
        const oneMinAfter = new Date(requestedTime.getTime() + 60000)

        const conflicts = await prisma.schedule.findMany({
          where: {
            status: 'pending',
            id: { not: id },
            adjustedAt: { gte: oneMinBefore, lte: oneMinAfter }
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
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nada para alterar' }, { status: 400 })
    }

    const schedule = await prisma.schedule.update({ where: { id }, data: updateData })
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
