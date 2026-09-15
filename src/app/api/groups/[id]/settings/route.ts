import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'
import { runGroupTask, VALID_ACTIONS } from '@shared/group-tasks'
import { persistGroupState } from '@/lib/group-state'

const prisma = new PrismaClient()

/**
 * @swagger
 * /api/groups/{id}/settings:
 *   post:
 *     summary: Altera permissões do grupo agora
 *     description: >
 *       Atalho do painel para aplicar permissões na hora. Aceita `action` (uma)
 *       ou `actions` (várias): announcement, not_announcement, locked, unlocked,
 *       approval_on, approval_off, admin_add, all_member_add.
 *       O estado atual é conferido antes — o que já estiver como pedido não é
 *       reaplicado, e a resposta volta com status "skipped".
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permissão aplicada, ou já valendo.
 *       400:
 *         description: Ação inválida.
 *       401:
 *         description: Não autorizado.
 *       404:
 *         description: Grupo ou instância não encontrados.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json() as { action?: string; actions?: string[] }

    const actions = Array.isArray(body.actions)
      ? body.actions
      : body.action ? [body.action] : []

    if (!actions.length) {
      return NextResponse.json({ error: 'Informe ao menos uma permissão' }, { status: 400 })
    }

    const invalid = actions.filter((a: string) => !VALID_ACTIONS.includes(a))
    if (invalid.length) {
      return NextResponse.json(
        { error: `Permissão inválida: ${invalid.join(', ')}`, permitidas: VALID_ACTIONS },
        { status: 400 }
      )
    }

    const group = await prisma.group.findUnique({ where: { id } })
    if (!group?.instanceName || !group.evolutionGroupId) {
      return NextResponse.json({ error: 'Grupo sem vínculo com a Evolution' }, { status: 404 })
    }

    // Mesmo executor do agendamento: confere o estado antes e confirma depois.
    const result = await runGroupTask({ group, kind: 'permission', payload: { actions } })

    if (result.status === 'error') {
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    if (result.groupData) {
      await persistGroupState(id, result.groupData)
    }

    return NextResponse.json({
      success: true,
      status: result.status, // done | skipped
      message: result.message,
      applied: result.applied || [],
      alreadyOk: result.alreadyOk || [],
      group: {
        isAnnounce: Boolean(result.groupData?.isAnnounce),
        isLocked: Boolean(result.groupData?.isLocked),
        isApprovalRequired: Boolean(result.groupData?.isApprovalRequired),
        adminOnlyAdd: Boolean(result.groupData?.adminOnlyAdd)
      }
    })
  } catch (error) {
    console.error('Erro ao alterar permissões do grupo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
