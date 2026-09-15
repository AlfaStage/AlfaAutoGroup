import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { isAuthenticated } from '@/lib/auth'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

function paraSlug(nome: string) {
  return nome
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40)
}

/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: Lista as tags com seus grupos
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Tags, cada uma com os grupos vinculados e a situação de lotação.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: {
      groups: {
        orderBy: { position: 'asc' },
        include: {
          group: {
            select: {
              id: true, name: true, slug: true, participantCount: true,
              instanceName: true, isFull: true, inviteLink: true, picture: true
            }
          }
        }
      }
    }
  })

  return NextResponse.json(tags.map(t => {
    const grupos = t.groups.map(v => ({ ...v.group, position: v.position }))
    const comVaga = grupos.find(g => !g.isFull && (g.participantCount || 0) < t.capacity)

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      color: t.color,
      description: t.description,
      autoCreate: t.autoCreate,
      capacity: t.capacity,
      namePattern: t.namePattern,
      cloneSchedules: t.cloneSchedules,
      copyAdmins: t.copyAdmins,
      instanceName: t.instanceName,
      inviteCode: t.inviteCode,
      grupos,
      totalGrupos: grupos.length,
      totalMembros: grupos.reduce((soma, g) => soma + (g.participantCount || 0), 0),
      grupoAtivo: comVaga ? { id: comVaga.id, nome: comVaga.name, membros: comVaga.participantCount } : null,
      lotada: !comVaga
    }
  }))
}

/**
 * @swagger
 * /api/tags:
 *   post:
 *     summary: Cria uma tag
 *     description: >
 *       `autoCreate` liga a criação automática do próximo grupo quando todos
 *       os da tag atingem `capacity`. `namePattern` aceita {n} e {nn}.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       201:
 *         description: Tag criada.
 *       400:
 *         description: Pedido inválido.
 *       409:
 *         description: Já existe tag com esse nome.
 */
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as any
    const name = String(body.name || '').trim()

    if (!name) return NextResponse.json({ error: 'Dê um nome para a tag' }, { status: 400 })

    const slug = paraSlug(name)
    if (!slug) return NextResponse.json({ error: 'Nome inválido' }, { status: 400 })

    const existe = await prisma.tag.findFirst({ where: { OR: [{ name }, { slug }] } })
    if (existe) return NextResponse.json({ error: 'Já existe uma tag com esse nome' }, { status: 409 })

    const tag = await prisma.tag.create({
      data: {
        name,
        slug,
        color: String(body.color || '#6366f1'),
        description: body.description ? String(body.description) : null,
        autoCreate: Boolean(body.autoCreate),
        capacity: Math.max(2, Number(body.capacity) || 950),
        namePattern: body.namePattern ? String(body.namePattern) : `${name} {n}`,
        cloneSchedules: body.cloneSchedules !== false,
        copyAdmins: body.copyAdmins !== false,
        instanceName: body.instanceName ? String(body.instanceName) : null,
        // Código do link público. Só é gerado quando a tag vai receber gente.
        inviteCode: randomBytes(5).toString('hex')
      }
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar tag:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
