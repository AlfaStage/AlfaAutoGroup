import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Redireciona um link encurtado e registra o clique.
 *
 * Rota publica de propósito — quem clica no WhatsApp não tem sessão.
 * Não guardamos IP: user agent e referer bastam para a estatística e
 * evitam acumular dado pessoal de quem só clicou num link.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const link = await prisma.trackedLink.findUnique({ where: { code } })

  if (!link || !link.active) {
    return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
  }

  // O registro não pode atrasar nem derrubar o redirecionamento.
  prisma.linkClick
    .create({
      data: {
        linkId: link.id,
        userAgent: request.headers.get('user-agent')?.slice(0, 300) || null,
        referer: request.headers.get('referer')?.slice(0, 300) || null
      }
    })
    .catch(e => console.error('[l] falha ao registrar clique:', e))

  return NextResponse.redirect(link.url, 302)
}
