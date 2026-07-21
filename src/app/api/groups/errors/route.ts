import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const errorSchedules = await prisma.schedule.findMany({
      where: { status: 'error' },
      include: { group: true },
      orderBy: { adjustedAt: 'asc' }
    })

    const groupsMap = new Map()
    for (const schedule of errorSchedules) {
      if (!groupsMap.has(schedule.groupId)) {
        groupsMap.set(schedule.groupId, {
          group: schedule.group,
          errors: []
        })
      }
      groupsMap.get(schedule.groupId).errors.push(schedule)
    }

    return NextResponse.json({
      errorGroups: Array.from(groupsMap.values())
    })
  } catch (err) {
    console.error("Erro ao buscar erros:", err)
    return NextResponse.json({ error: 'Falha ao buscar erros' }, { status: 500 })
  }
}
