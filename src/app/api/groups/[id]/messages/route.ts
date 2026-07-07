import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
