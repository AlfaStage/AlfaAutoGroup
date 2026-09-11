import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import bcrypt from 'bcryptjs'
import { gerarChave } from '@/lib/api-keys'

const prisma = new PrismaClient()

/**
 * Criar e listar chaves exige sessão do painel — nunca uma chave de API.
 * Assim uma chave vazada não consegue emitir novas chaves para si mesma.
 */
async function usuarioDaSessao() {
  const session = await getServerSession()
  const email = (session as any)?.user?.email
  if (!email) return null
  return prisma.user.findUnique({ where: { email } })
}

/**
 * @swagger
 * /api/keys:
 *   get:
 *     summary: Lista as chaves de API
 *     description: Só a sessão do painel acessa. As chaves em si nunca são devolvidas, apenas o prefixo.
 *     responses:
 *       200:
 *         description: Lista de chaves.
 *       401:
 *         description: Não autorizado.
 */
export async function GET() {
  const usuario = await usuarioDaSessao()
  if (!usuario) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const chaves = await prisma.apiKey.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true
    }
  })

  return NextResponse.json(chaves)
}

/**
 * @swagger
 * /api/keys:
 *   post:
 *     summary: Cria uma chave de API
 *     description: >
 *       Exige a senha da conta como confirmação. A chave em texto é devolvida
 *       uma única vez nesta resposta — depois disso só existe o hash.
 *     responses:
 *       201:
 *         description: Chave criada. O campo `key` não aparece novamente.
 *       400:
 *         description: Pedido inválido.
 *       401:
 *         description: Não autorizado ou senha incorreta.
 */
export async function POST(request: Request) {
  try {
    const usuario = await usuarioDaSessao()
    if (!usuario) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { name, password, scopes } = await request.json() as {
      name?: string
      password?: string
      scopes?: string
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Dê um nome para a chave' }, { status: 400 })
    }
    if (!password) {
      return NextResponse.json({ error: 'Confirme sua senha' }, { status: 400 })
    }

    const senhaOk = await bcrypt.compare(password, usuario.password)
    if (!senhaOk) {
      return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }

    const escopo = scopes === 'read' ? 'read' : 'read,write'
    const { chave, hash, prefix } = gerarChave()

    const registro = await prisma.apiKey.create({
      data: { name: name.trim(), hash, prefix, scopes: escopo }
    })

    return NextResponse.json({
      id: registro.id,
      name: registro.name,
      prefix: registro.prefix,
      scopes: registro.scopes,
      createdAt: registro.createdAt,
      // única vez que a chave aparece
      key: chave
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar chave de API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
