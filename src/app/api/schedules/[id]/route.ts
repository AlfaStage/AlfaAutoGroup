import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
