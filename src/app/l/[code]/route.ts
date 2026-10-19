import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  isPreviewBot,
  registerAndCheckUnique,
  horaAtualSP,
  resolveGroupParam,
  enrichDestinationUrlWithUtm
} from '@shared/bot-filter'

/**
 * Redireciona um link encurtado e registra o clique com atribuição por grupo/tag.
 *
 * Aceita ?grupid=<id|slug|jid> (ou ?groupid= / ?g=) para saber exatamente
 * de qual grupo de WhatsApp veio o clique, filtra bots de preview (WhatsApp,
 * Facebook, Telegram, HEAD) e injeta UTMs automáticas no URL de destino.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const link = await prisma.trackedLink.findUnique({ where: { code } })

  if (!link || !link.active) {
    return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
  }

  const reqUrl = new URL(request.url)
  const rawGroupParam =
    reqUrl.searchParams.get('grupid') ||
    reqUrl.searchParams.get('groupid') ||
    reqUrl.searchParams.get('g') ||
    link.groupId ||
    null

  const groupMeta = rawGroupParam ? await resolveGroupParam(prisma, rawGroupParam) : null
  const ua = request.headers.get('user-agent') || ''
  const bot = isPreviewBot(ua, request.method)

  if (!bot) {
    const ipHint =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      ''
    const isUnique = registerAndCheckUnique(
      `l:${link.id}:${groupMeta?.id || 'none'}:${ua.slice(0, 120)}:${ipHint}`
    )
    const hour = horaAtualSP()

    prisma.linkClick
      .create({
        data: {
          linkId: link.id,
          groupId: groupMeta?.id || link.groupId || null,
          isUnique,
          hour,
          userAgent: ua.slice(0, 300) || null,
          referer: request.headers.get('referer')?.slice(0, 300) || null
        }
      })
      .catch(e => console.error('[l] falha ao registrar clique:', e))
  }

  const tagMeta = groupMeta?.tags?.[0]?.tag || null
  const destinationUrl = enrichDestinationUrlWithUtm(
    link.url,
    groupMeta,
    tagMeta,
    link.label || null
  )
  return NextResponse.redirect(destinationUrl, 302)
}

