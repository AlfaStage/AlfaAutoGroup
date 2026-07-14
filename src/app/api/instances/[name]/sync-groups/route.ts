import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '@/lib/auth';

const prisma = new PrismaClient();
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

/**
 * @swagger
 * /api/instances/{name}/sync-groups:
 *   post:
 *     summary: Sincroniza os grupos da instância
 *     description: Busca os grupos no WhatsApp e atualiza no banco de dados local.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome da instância
 *     responses:
 *       200:
 *         description: Grupos sincronizados com sucesso.
 *       400:
 *         description: Token ausente.
 *       401:
 *         description: Não autorizado.
 *       500:
 *         description: Falha ao sincronizar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name: instanceName } = await params;
    const token = request.headers.get('x-instance-token') || EVOLUTION_API_KEY;

    if (!token || !EVOLUTION_API_URL) {
      return NextResponse.json({ error: 'Missing token or API URL' }, { status: 400 });
    }

    // 1. Fetch groups from Evolution GO
    const groupsRes = await fetch(`${EVOLUTION_API_URL}/group/list?instanceName=${instanceName}`, {
      headers: { 'apikey': token }
    });

    if (!groupsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch groups from Evolution' }, { status: groupsRes.status });
    }

    const groupsData = await groupsRes.json();
    const fetchedGroups = Array.isArray(groupsData) ? groupsData : (groupsData.data || []);

    // 2. Synchronize Database
    for (const g of fetchedGroups) {
      const evolutionGroupId = g.id || g.jid || g.JID;
      const subject = g.subject || g.name || g.Name;
      if (!evolutionGroupId || !subject) continue;

      const group = await prisma.group.upsert({
        where: { 
          instanceName_evolutionGroupId: {
            instanceName: instanceName,
            evolutionGroupId: evolutionGroupId
          }
        },
        update: {
          name: subject,
          description: g.desc || g.Description || '',
          instanceName: instanceName
        },
        create: {
          evolutionGroupId: evolutionGroupId,
          name: subject,
          description: g.desc || g.Description || '',
          slug: evolutionGroupId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) + Math.floor(Math.random() * 1000),
          instanceName: instanceName
        }
      });

      // Synchronize members
      const participants = g.participants || g.Participants || [];
      if (Array.isArray(participants) && participants.length > 0) {
        // Delete old members for this group to avoid duplicates
        await prisma.groupMember.deleteMany({
          where: { groupId: group.id }
        });

        // Insert new members
        const membersData = participants.map((p: any) => ({
          groupId: group.id,
          phone: p.id || p.jid || p.JID || p.PhoneNumber || 'unknown',
          role: p.admin || p.isAdmin || p.IsAdmin ? 'admin' : 'participant'
        }));

        await prisma.groupMember.createMany({
          data: membersData
        });
      }
    }

    // 3. Configurar Webhook apenas se estiver em produção
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL) {
      try {
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`;
        
        await fetch(`${EVOLUTION_API_URL}/instance/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY || token
          },
          body: JSON.stringify({
            instanceName: instanceName,
            webhookUrl: webhookUrl,
            subscribe: ["MESSAGE"],
            immediate: true
          })
        });
      } catch (e) {
        console.error(`Error configuring webhook for ${instanceName}`, e);
      }
    }

    return NextResponse.json({ success: true, count: fetchedGroups.length });
  } catch (error) {
    console.error('Sync Groups Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
