import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthenticated } from '@/lib/auth'

/**
 * @swagger
 * /api/groups/{id}/action:
 *   post:
 *     summary: Executa uma ação de gerenciamento no grupo
 *     description: Permite alterar o nome, descrição ou foto do grupo no WhatsApp.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do grupo no banco de dados local.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - value
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [name, description, picture]
 *               value:
 *                 type: string
 *                 description: O novo valor (texto ou base64 da imagem)
 *     responses:
 *       200:
 *         description: Ação executada com sucesso.
 *       400:
 *         description: Dados inválidos.
 *       401:
 *         description: Não autorizado.
 *       404:
 *         description: Grupo não encontrado.
 *       500:
 *         description: Falha ao executar ação.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { action, value } = await request.json()

    if (!action || !value) {
      return NextResponse.json({ error: 'Action and value are required' }, { status: 400 })
    }

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

    let endpoint = ''
    let payload = {}

    if (action === 'picture') {
      endpoint = `/group/photo`
      payload = { groupJid: group.evolutionGroupId, image: value }
    } else if (action === 'description') {
      endpoint = `/group/description`
      payload = { groupJid: group.evolutionGroupId, description: value }
    } else if (action === 'name') {
      endpoint = `/group/name`
      payload = { groupJid: group.evolutionGroupId, name: value }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Call Evolution GO API
    const res = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instanceToken
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("Evolution API Error:", err)
      return NextResponse.json({ error: 'Failed to update on Evolution API', details: err }, { status: res.status })
    }

    // Update local DB
    if (action === 'description') {
      await prisma.group.update({
        where: { id },
        data: { description: value }
      })
    } else if (action === 'name') {
      await prisma.group.update({
        where: { id },
        data: { name: value }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro na action do grupo:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
