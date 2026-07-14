import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'

/**
 * @swagger
 * /api/groups/{id}/participants:
 *   get:
 *     summary: Lista os participantes do grupo
 *     description: Consulta a Evolution API em tempo real para trazer os participantes atuais do grupo.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo no banco de dados local.
 *     responses:
 *       200:
 *         description: Lista de participantes retornada com sucesso.
 *       401:
 *         description: Não autorizado.
 *       404:
 *         description: Grupo ou instância não encontrados.
 *       500:
 *         description: Falha na API.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const group = await prisma.group.findUnique({
      where: { id }
    })

    if (!group || !group.instanceName || !group.evolutionGroupId) {
      return NextResponse.json({ error: 'Group or Evolution configuration not found' }, { status: 404 })
    }

    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Evolution API credentials missing' }, { status: 500 })
    }

    // Fetch instance token
    let instanceToken = '';
    try {
      const allRes = await fetch(`${apiUrl}/instance/all`, {
        headers: { 'apikey': apiKey }
      });
      if (allRes.ok) {
        const respData = await allRes.json();
        const data = Array.isArray(respData) ? respData : (respData.data || []);
        const inst = data.find((i: any) => (i.instance?.instanceName || i.name) === group.instanceName);
        if (inst) instanceToken = inst.token;
      }
    } catch (e) {
      console.error('Error fetching instances', e);
    }

    if (!instanceToken) {
       return NextResponse.json({ error: 'Instance token not found' }, { status: 404 })
    }

    // Call Evolution GO API to get group info
    const res = await fetch(`${apiUrl}/group/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instanceToken
      },
      body: JSON.stringify({ groupJid: group.evolutionGroupId })
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("Evolution API Error:", err)
      return NextResponse.json({ error: 'Failed to fetch participants from Evolution API', details: err }, { status: res.status })
    }

    const data = await res.json()
    // Retorna a lista de participantes
    const participants = data.data?.Participants || data.Participants || []
    
    return NextResponse.json({ success: true, participants })
  } catch (error) {
    console.error("Erro ao buscar participantes do grupo:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
