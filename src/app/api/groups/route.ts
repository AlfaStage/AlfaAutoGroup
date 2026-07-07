import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const groups = await prisma.group.findMany({
      include: {
        _count: {
          select: { members: true, schedules: true }
        }
      }
    })
    return NextResponse.json(groups)
  } catch (error) {
    console.error("Erro ao buscar grupos:", error)
    return NextResponse.json({ error: 'Falha ao buscar' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { name, slug, description, picture, participants, instanceName } = data
    
    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY
    
    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Evolution API credentials missing' }, { status: 500 })
    }

    // 1. Chamar a Evolution API para criar o grupo real
    const evoPayload = {
      subject: name,
      description: description || '',
      participants: participants ? participants.split(',').map((p: string) => p.trim()) : []
    }

    console.log("Criando grupo na Evolution API:", evoPayload);
    const res = await fetch(`${apiUrl}/group/createGroup?instanceName=${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(evoPayload)
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error("Evolution API erro ao criar grupo:", errText)
      return NextResponse.json({ error: 'Failed to create group in WhatsApp', details: errText }, { status: res.status })
    }

    const evoData = await res.json()
    console.log("Resposta Evolution API (Group):", evoData)
    
    // O ID do grupo geralmente vem no campo 'id', 'groupId' ou dentro de 'data'
    const evolutionGroupId = evoData.id || evoData.groupId || evoData.data?.id || evoData.data?.groupId || '';

    // 2. Salvar no banco de dados local com o ID gerado
    const group = await prisma.group.create({
      data: {
        name,
        slug,
        description,
        picture,
        evolutionGroupId: evolutionGroupId || 'ID_PENDENTE_API', 
        instanceName
      }
    })

    return NextResponse.json(group)
  } catch (error) {
    console.error("Erro ao criar grupo:", error)
    return NextResponse.json({ error: 'Falha ao criar' }, { status: 500 })
  }
}
