import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { groupId } = await req.json()
    if (!groupId) return NextResponse.json({ error: 'groupId obrigatório' }, { status: 400 })

    const now = new Date()

    // Encontrar o erro mais antigo do grupo
    const errorSchedules = await prisma.schedule.findMany({
      where: { groupId, status: 'error' },
      orderBy: { adjustedAt: 'asc' }
    })

    if (errorSchedules.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum erro encontrado' })
    }

    const firstError = errorSchedules[0]
    const firstErrorDate = new Date(firstError.adjustedAt)
    let delayMs = 0

    // Se o erro for no passado, calculamos o atraso
    if (now.getTime() > firstErrorDate.getTime()) {
      delayMs = now.getTime() - firstErrorDate.getTime()
    }
    
    // Obter todos os agendamentos afetados (errors e pendentes)
    const affectedSchedules = await prisma.schedule.findMany({
      where: {
        groupId,
        status: { in: ['error', 'pending'] }
      }
    })

    // Atualizar cada um com o novo horário somado ao delay
    for (const schedule of affectedSchedules) {
      const newAdjustedAt = new Date(new Date(schedule.adjustedAt).getTime() + delayMs)
      const newScheduledAt = new Date(new Date(schedule.scheduledAt).getTime() + delayMs)
      
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          status: 'pending',
          errorMessage: null,
          adjustedAt: newAdjustedAt,
          scheduledAt: newScheduledAt
        }
      })
    }

    return NextResponse.json({ success: true, delayMs })
  } catch (err) {
    console.error("Erro ao resolver atrasos:", err)
    return NextResponse.json({ error: 'Falha ao resolver atrasos' }, { status: 500 })
  }
}
