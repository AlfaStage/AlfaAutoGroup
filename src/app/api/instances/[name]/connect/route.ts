import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'

// A Evolution GO identifica a instância pelo token no header `apikey`, e não
// por um nome na URL. A chave global não é aceita em /instance/qr.
async function resolveInstanceToken(apiUrl: string, apiKey: string, name: string) {
  const res = await fetch(`${apiUrl}/instance/all`, {
    headers: { apikey: apiKey },
    cache: 'no-store'
  })
  if (!res.ok) return null

  const body = await res.json()
  const list = Array.isArray(body) ? body : (body.data || [])
  const found = list.find((i: any) => (i.name || i.instance?.instanceName) === name)
  return found?.token || null
}

async function fetchQr(apiUrl: string, token: string) {
  const res = await fetch(`${apiUrl}/instance/qr`, {
    headers: { apikey: token },
    cache: 'no-store'
  })
  const text = await res.text()

  let body: any = null
  try { body = JSON.parse(text) } catch { /* resposta não-JSON */ }

  return { ok: res.ok, status: res.status, body, text }
}

/**
 * @swagger
 * /api/instances/{name}/connect:
 *   get:
 *     summary: Obtém o QR Code de conexão de uma instância
 *     description: Retorna os dados para conectar uma instância do WhatsApp (geralmente base64 do QR Code).
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Nome da instância
 *     responses:
 *       200:
 *         description: Sucesso. Retorna o QR Code em base64 e código de emparelhamento.
 *       401:
 *         description: Não autorizado.
 *       404:
 *         description: Instância não encontrada na Evolution API.
 *       500:
 *         description: Falha ao obter conexão.
 */
export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await params;
    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Evolution API credentials missing' }, { status: 500 })
    }

    const token = request.headers.get('x-instance-token')
      || await resolveInstanceToken(apiUrl, apiKey, name)

    if (!token) {
      return NextResponse.json(
        { error: `Instância "${name}" não encontrada na Evolution API` },
        { status: 404 }
      )
    }

    let qr = await fetchQr(apiUrl, token)
    let qrcode: string = qr.body?.data?.qrcode || qr.body?.qrcode || ''

    // Sem QR em cache: abre a conexão e tenta de novo.
    if (!qrcode) {
      await fetch(`${apiUrl}/instance/connect`, {
        method: 'POST',
        headers: { apikey: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate: true })
      })

      await new Promise(resolve => setTimeout(resolve, 1500))

      qr = await fetchQr(apiUrl, token)
      qrcode = qr.body?.data?.qrcode || qr.body?.qrcode || ''
    }

    if (!qrcode) {
      console.error("Erro Evolution API (qr):", qr.text)
      return NextResponse.json(
        { error: 'Failed to connect/get QR Code', details: qr.text },
        { status: qr.ok ? 502 : qr.status }
      )
    }

    // O front aceita data.base64 ou data.data.qrcode; devolve os dois.
    return NextResponse.json({ base64: qrcode, qrcode, data: qr.body?.data ?? qr.body })
  } catch (error) {
    console.error("Erro ao buscar QR Code:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
