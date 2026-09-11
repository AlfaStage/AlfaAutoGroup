import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isAuthenticated } from '@/lib/auth';
import {
  getInstanceToken,
  evolutionCall,
  fetchAvatarUrl,
  normalizePhone,
  participantPhone,
  participantLid
} from '@/lib/evolution';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

// A URL de foto do WhatsApp expira, então guardamos o arquivo e só
// atualizamos de tempos em tempos — evita 25 downloads a cada sincronização.
const PICTURE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function cacheGroupPicture(token: string, jid: string): Promise<string | null> {
  const url = await fetchAvatarUrl(token, jid);
  if (!url) return null;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const uploadsDir = join(process.cwd(), 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    const filename = `group-${jid.replace(/[^a-zA-Z0-9]/g, '')}.jpg`;
    await writeFile(join(uploadsDir, filename), buffer);

    return `/api/uploads/${filename}`;
  } catch (e) {
    console.error(`[sync] falha ao baixar foto de ${jid}`, e);
    return null;
  }
}

/**
 * @swagger
 * /api/instances/{name}/sync-groups:
 *   post:
 *     summary: Sincroniza os grupos da instância
 *     description: Busca os grupos no WhatsApp e atualiza no banco de dados local, incluindo membros, permissões e fotos.
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
 *       401:
 *         description: Não autorizado.
 *       404:
 *         description: Instância não encontrada.
 *       500:
 *         description: Falha ao sincronizar.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name: instanceName } = await params;

    const token = request.headers.get('x-instance-token')
      || await getInstanceToken(instanceName);

    if (!token) {
      return NextResponse.json(
        { error: `Instância "${instanceName}" não encontrada na Evolution API` },
        { status: 404 }
      );
    }

    const listed = await evolutionCall('/group/list', { token });
    if (!listed.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch groups from Evolution', details: listed.text },
        { status: listed.status }
      );
    }

    const body: any = listed.data;
    const fetchedGroups: any[] = Array.isArray(body) ? body : (body?.data || []);

    let picturesUpdated = 0;
    let membersSynced = 0;

    for (const g of fetchedGroups) {
      const evolutionGroupId = g.JID || g.jid || g.id;
      const subject = g.Name || g.name || g.subject;
      if (!evolutionGroupId || !subject) continue;

      const existing = await prisma.group.findUnique({
        where: {
          instanceName_evolutionGroupId: { instanceName, evolutionGroupId }
        }
      });

      // Campos que a Evolution já devolve em /group/list e que o painel ignorava.
      const commonData = {
        name: subject,
        description: g.Topic || g.desc || g.Description || '',
        topic: g.Topic || '',
        instanceName,
        participantCount: Number(g.ParticipantCount || (g.Participants?.length ?? 0)) || 0,
        isAnnounce: Boolean(g.IsAnnounce),
        isLocked: Boolean(g.IsLocked),
        isApprovalRequired: Boolean(g.IsJoinApprovalRequired),
        adminOnlyAdd: String(g.MemberAddMode || '').toLowerCase() === 'admin_add',
        ownerPhone: normalizePhone(g.OwnerPN || g.OwnerJID)
      };

      const group = await prisma.group.upsert({
        where: {
          instanceName_evolutionGroupId: { instanceName, evolutionGroupId }
        },
        update: commonData,
        create: {
          ...commonData,
          evolutionGroupId,
          slug: evolutionGroupId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15)
            + Math.floor(Math.random() * 1000)
        }
      });

      // Foto: só busca se ainda não temos ou se já passou do prazo.
      const pictureStale = !existing?.picture
        || !existing?.pictureUpdatedAt
        || Date.now() - new Date(existing.pictureUpdatedAt).getTime() > PICTURE_TTL_MS;

      if (pictureStale) {
        const picture = await cacheGroupPicture(token, evolutionGroupId);
        if (picture) {
          await prisma.group.update({
            where: { id: group.id },
            data: { picture, pictureUpdatedAt: new Date() }
          });
          picturesUpdated++;
        }
        // Respira entre downloads para não sobrecarregar a instância.
        await new Promise(r => setTimeout(r, 150));
      }

      const participants = g.Participants || g.participants || [];
      if (Array.isArray(participants) && participants.length > 0) {
        await prisma.groupMember.deleteMany({ where: { groupId: group.id } });

        const membersData = participants.map((p: any) => {
          const isAdmin = Boolean(p.IsAdmin || p.isAdmin || p.admin);
          const isSuperAdmin = Boolean(p.IsSuperAdmin || p.isSuperAdmin);
          return {
            groupId: group.id,
            phone: participantPhone(p) || 'desconhecido',
            lid: participantLid(p) || null,
            displayName: p.DisplayName || p.displayName || null,
            isAdmin: isAdmin || isSuperAdmin,
            isSuperAdmin,
            role: (isAdmin || isSuperAdmin) ? 'admin' : 'participant'
          };
        });

        await prisma.groupMember.createMany({ data: membersData });
        membersSynced += membersData.length;
      }
    }

    return NextResponse.json({
      success: true,
      count: fetchedGroups.length,
      picturesUpdated,
      membersSynced
    });
  } catch (error) {
    console.error('Sync Groups Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
