import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type GroupStateSnapshot = {
  name?: string
  topic?: string
  isAnnounce?: boolean
  isLocked?: boolean
  isApprovalRequired?: boolean
  adminOnlyAdd?: boolean
}

/**
 * Espelha no banco local o estado que a Evolution confirmou depois de uma
 * mudança. Evita ter que ressincronizar o grupo inteiro só para o painel
 * mostrar o botão certo.
 */
export async function persistGroupState(groupId: string, groupData: GroupStateSnapshot | null) {
  if (!groupData) return

  await prisma.group.update({
    where: { id: groupId },
    data: {
      isAnnounce: Boolean(groupData.isAnnounce),
      isLocked: Boolean(groupData.isLocked),
      isApprovalRequired: Boolean(groupData.isApprovalRequired),
      adminOnlyAdd: Boolean(groupData.adminOnlyAdd),
      ...(groupData.name ? { name: groupData.name } : {}),
      ...(typeof groupData.topic === 'string'
        ? { topic: groupData.topic, description: groupData.topic }
        : {})
    }
  })
}
