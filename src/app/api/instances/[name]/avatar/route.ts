import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'

/**
 * @swagger
 * /api/instances/{name}/avatar:
 *   get:
 *     summary: Obtém a foto de perfil de um contato
 *     description: Retorna a URL da foto de perfil de um contato (JID) no WhatsApp. Redireciona para a URL.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome da instância
 *       - in: query
 *         name: jid
 *         required: true
 *         schema:
 *           type: string
 *         description: O número ou JID do contato
 *     responses:
 *       307:
 *         description: Redireciona para a imagem
 *       400:
 *         description: JID não informado
 *       404:
 *         description: Avatar não encontrado
 *       401:
 *         description: Não autorizado
 */
export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await params
    const { searchParams } = new URL(request.url)
    const jid = searchParams.get('jid')
    
    if (!jid) {
      return NextResponse.json({ error: 'Missing jid' }, { status: 400 })
    }

    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY
    const instanceToken = request.headers.get('x-instance-token') || apiKey

    if (!apiUrl || !instanceToken) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 })
    }

    const res = await fetch(`${apiUrl}/user/avatar?instanceName=${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': instanceToken
      },
      body: JSON.stringify({ number: jid, preview: false }),
      cache: 'no-store'
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch avatar' }, { status: res.status })
    }

    const data = await res.json()
    if (data.error || !data.data?.url) {
      // Retorna uma imagem em branco ou um 404
      return new NextResponse(null, { status: 404 })
    }
    return NextResponse.redirect(data.data.url)
  } catch (error) {
    console.error("Erro ao buscar avatar:", error)
    return new NextResponse('Internal error', { status: 500 })
  }
}
