import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'
import { getInstanceToken, evolutionCall } from '@/lib/evolution'

/**
 * @swagger
 * /api/groups:
 *   get:
 *     summary: Lista todos os grupos cadastrados localmente
 *     description: Retorna os grupos do banco de dados junto da contagem de membros e agendamentos. Pode ser filtrado por instância.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: instanceName
 *         required: false
 *         schema:
 *           type: string
 *         description: Filtra os grupos que pertencem a uma instância específica.
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
 *                 description: "Nome da instância conectada."
 *               participants:
 *                 type: string
 *                 description: "Lista de números separados por vírgula (ex: 5511999999999)."
 *     responses:
 *       200:
 *         description: Grupo criado com sucesso.
 *       401:
 *         description: Não autorizado.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const instanceName = searchParams.get('instanceName')
    
    const whereClause = instanceName ? { instanceName } : {}

    const groups = await prisma.group.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { members: true, schedules: true }
        },
        schedules: {
          select: { status: true }
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

    // 1. Criar o grupo real na Evolution GO.
    // A rota e /group/create (nao /group/createGroup), o campo e groupName
    // (nao subject) e a chamada exige o token da instancia, nao a chave global.
    const token = await getInstanceToken(instanceName)
    if (!token) {
      return NextResponse.json(
        { error: `Instancia "${instanceName}" nao encontrada na Evolution API` },
        { status: 404 }
      )
    }

    const evoPayload = {
      groupName: name,
      participants: participants
        ? participants.split(',').map((p: string) => p.trim()).filter(Boolean)
        : []
    }

    const created = await evolutionCall('/group/create', {
      method: 'POST',
      token,
      body: evoPayload
    })

    if (!created.ok) {
      console.error("Evolution API erro ao criar grupo:", created.text)
      return NextResponse.json(
        { error: 'Failed to create group in WhatsApp', details: created.text },
        { status: created.status }
      )
    }

    const evoData: any = created.data || {}
    const evolutionGroupId =
      evoData.JID || evoData.jid || evoData.id || evoData.groupId
      || evoData.data?.JID || evoData.data?.jid || evoData.data?.id || evoData.data?.groupId
      || '';

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
