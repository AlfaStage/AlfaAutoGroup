import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
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
  const { searchParams } = new URL(request.url)
  const groupId = searchParams.get('groupId')

  if (!groupId) return NextResponse.json({error: 'Group ID is required'}, {status:400})

  const schedules = await prisma.schedule.findMany({
    where: { groupId },
    orderBy: { adjustedAt: 'asc' }
  })
  return NextResponse.json(schedules)
}
