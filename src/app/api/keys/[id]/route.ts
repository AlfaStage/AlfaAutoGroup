import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'

const prisma = new PrismaClient()

/**
 * @swagger
 * /api/keys/{id}:
 *   delete:
 *     summary: Revoga uma chave de API
 *     description: A chave deixa de funcionar na hora. O registro é mantido para histórico.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Revogada.
 *       401:
 *         description: Não autorizado.
 *       404:
 *         description: Chave não encontrada.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession()
  if (!(session as any)?.user?.email) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  const chave = await prisma.apiKey.findUnique({ where: { id } })
  if (!chave) return NextResponse.json({ error: 'Chave não encontrada' }, { status: 404 })

  if (chave.revokedAt) {
    return NextResponse.json({ ...chave, hash: undefined })
  }

  const atualizada = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() }
  })

  return NextResponse.json({ ...atualizada, hash: undefined })
}
