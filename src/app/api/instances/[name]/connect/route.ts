import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'

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

    const instanceToken = request.headers.get('x-instance-token') || apiKey

    const res = await fetch(`${apiUrl}/instance/connect/${name}`, {
      method: 'GET',
      headers: {
        'apikey': instanceToken
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error("Erro Evolution API (connect):", errText)
      return NextResponse.json({ error: 'Failed to connect/get QR Code', details: errText }, { status: res.status })
    }

    const data = await res.json()
    // Retorna o base64 na chave 'base64'
    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro ao buscar QR Code:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
