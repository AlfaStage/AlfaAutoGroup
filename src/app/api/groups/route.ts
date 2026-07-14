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
 * /api/groups:
 *   get:
 *     summary: Lista todos os grupos cadastrados localmente
 *     description: Retorna os grupos do banco de dados junto da contagem de membros e agendamentos.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de grupos.
 *       401:
 *         description: Não autorizado.
 *   post:
 *     summary: Cria um novo grupo
 *     description: Cria o grupo na Evolution API e salva o registro localmente.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               instanceName:
 *                 type: string
 *                 description: Nome da instância conectada.
 *               participants:
 *                 type: string
 *                 description: Lista de números separados por vírgula (ex: 5511999999999).
 *     responses:
 *       200:
 *         description: Grupo criado com sucesso.
 *       401:
 *         description: Não autorizado.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
