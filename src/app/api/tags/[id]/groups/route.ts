import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'

const prisma = new PrismaClient()

/**
 * @swagger
 * /api/tags/{id}/groups:
 *   post:
 *     summary: Define quais grupos pertencem à tag
 *     description: >
 *       Recebe `groupIds` na ordem de preenchimento. A ordem importa: o link
 *       público sempre manda gente para o primeiro grupo com vaga.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Vínculos atualizados.
 *       404:
 *         description: Tag não encontrada.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { groupIds } = await request.json() as { groupIds?: string[] }

    const tag = await prisma.tag.findUnique({ where: { id } })
    if (!tag) return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 })

    const ids = Array.isArray(groupIds) ? groupIds : []

    // Só aceita grupos que existem de verdade
    const existentes = await prisma.group.findMany({
      where: { id: { in: ids } },
      select: { id: true }
    })
    const validos = ids.filter(gid => existentes.some(e => e.id === gid))

    await prisma.groupTag.deleteMany({ where: { tagId: id } })

    for (let i = 0; i < validos.length; i++) {
      await prisma.groupTag.create({
        data: { tagId: id, groupId: validos[i], position: i }
      })
    }

    return NextResponse.json({ tagId: id, vinculados: validos.length })
  } catch (error) {
    console.error('Erro ao vincular grupos à tag:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
