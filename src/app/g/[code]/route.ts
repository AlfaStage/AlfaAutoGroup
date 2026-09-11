import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { destinoDoConvite } from '@shared/capacity'

const prisma = new PrismaClient()

/**
 * Link público de entrada de uma tag.
 *
 * Sempre redireciona para o convite do primeiro grupo com vaga. Se todos
 * estiverem cheios e a tag permitir, o próximo grupo é criado na hora — quem
 * clicou entra nele sem perceber que algo aconteceu.
 *
 * Rota pública: quem clica vem de fora, sem sessão.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  try {
    const r = await destinoDoConvite(prisma, code)

    if (r.erro === 'nao_encontrado') {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    }
    if (r.erro === 'sem_grupos') {
      return NextResponse.json(
        { error: 'Esta tag ainda não tem grupos vinculados' },
        { status: 409 }
      )
    }
    if (r.erro === 'sem_link' || !r.link) {
      return NextResponse.json(
        { error: 'Não consegui obter o convite do grupo. A instância precisa ser administradora.' },
        { status: 502 }
      )
    }

    return NextResponse.redirect(r.link, 302)
  } catch (e) {
    console.error('[g] falha ao resolver convite:', e)
    return NextResponse.json({ error: 'Erro ao resolver o convite' }, { status: 500 })
  }
}
