import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'

const prisma = new PrismaClient()

/**
 * @swagger
 * /api/tags/{id}:
 *   patch:
 *     summary: Altera uma tag
 *     description: Aceita name, color, description, autoCreate, capacity, namePattern, cloneSchedules e instanceName.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Tag atualizada.
 *       404:
 *         description: Tag não encontrada.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json() as any

  const tag = await prisma.tag.findUnique({ where: { id } })
  if (!tag) return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 })

  const dados: any = {}
  if (typeof body.name === 'string' && body.name.trim()) dados.name = body.name.trim()
  if (typeof body.color === 'string') dados.color = body.color
  if ('description' in body) dados.description = body.description || null
  if ('autoCreate' in body) dados.autoCreate = Boolean(body.autoCreate)
  if ('capacity' in body) dados.capacity = Math.max(2, Number(body.capacity) || tag.capacity)
  if ('namePattern' in body) dados.namePattern = body.namePattern || null
  if ('cloneSchedules' in body) dados.cloneSchedules = Boolean(body.cloneSchedules)
  if ('instanceName' in body) dados.instanceName = body.instanceName || null

  const atualizada = await prisma.tag.update({ where: { id }, data: dados })
  return NextResponse.json(atualizada)
}

/**
 * @swagger
 * /api/tags/{id}:
 *   delete:
 *     summary: Remove uma tag
 *     description: Os grupos continuam existindo; só o vínculo com a tag é desfeito.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Tag removida.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const tag = await prisma.tag.findUnique({ where: { id } })
  if (!tag) return NextResponse.json({ error: 'Tag não encontrada' }, { status: 404 })

  await prisma.tag.delete({ where: { id } })
  return NextResponse.json({ removida: true, nome: tag.name })
}
