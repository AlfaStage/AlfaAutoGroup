import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { destinoDoConvite } from '@shared/capacity'
import { isPreviewBot, registerAndCheckUnique } from '@shared/bot-filter'

/**
 * Link público de entrada de uma tag.
 *
 * Sempre redireciona para o convite do primeiro grupo com vaga. Se todos
 * estiverem cheios e a tag permitir, o próximo grupo é criado na hora — quem
 * clicou entra nele sem perceber que algo aconteceu.
 *
 * Registra TagClick (ignorando bots de preview) para medir o funil de entrada.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
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

    const ua = request.headers.get('user-agent') || ''
    if (!isPreviewBot(ua, request.method) && r.tag?.id) {
      const reqUrl = new URL(request.url)
      const source =
        reqUrl.searchParams.get('utm_source') ||
        reqUrl.searchParams.get('origem') ||
        reqUrl.searchParams.get('src') ||
        null
      const ipHint =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        ''
      const isUnique = registerAndCheckUnique(
        `g:${r.tag.id}:${ua.slice(0, 120)}:${ipHint}`
      )

      prisma.tagClick
        .create({
          data: {
            tagId: r.tag.id,
            groupId: r.grupo?.id || null,
            source: source ? source.slice(0, 80) : null,
            isUnique
          }
        })
        .catch(e => console.error('[g] falha ao registrar clique da tag:', e))
    }

    return NextResponse.redirect(r.link, 302)
  } catch (e) {
    console.error('[g] falha ao resolver convite:', e)
    return NextResponse.json({ error: 'Erro ao resolver o convite' }, { status: 500 })
  }
}

