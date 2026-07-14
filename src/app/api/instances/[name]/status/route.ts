import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'

/**
 * @swagger
 * /api/instances/{name}/status:
 *   get:
 *     summary: Obtém o status da conexão da instância
 *     description: Retorna o status atual da instância (ex. open, close, connecting).
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
 *         description: Status da instância retornado com sucesso.
 *       401:
 *         description: Não autorizado.
 *       500:
 *         description: Falha ao obter status.
 */
export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name } = await params
    const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Evolution API credentials missing' }, { status: 500 })
    }

    const instanceToken = request.headers.get('x-instance-token') || apiKey

    const res = await fetch(`${apiUrl}/instance/status?instanceName=${name}`, {
      method: 'GET',
      headers: {
        'apikey': instanceToken
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch status' }, { status: res.status })
    }

    const data = await res.json()
    // Returns something like { instance: { state: "open" } } or just { state: "open" }
    // Actually according to docs it returns { instance: { instanceName: "...", state: "open" } }
    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro ao buscar status da instancia:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
