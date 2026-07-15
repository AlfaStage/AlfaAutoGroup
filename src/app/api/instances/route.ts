import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'

/**
 * @swagger
 * /api/instances:
 *   get:
 *     summary: Lista todas as instâncias do WhatsApp (Evolution API)
 *     description: Retorna as instâncias configuradas e seus status de conexão.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Lista de instâncias.
 *       401:
 *         description: Não autorizado (Sessão inválida ou Bearer token incorreto).
 *       500:
 *         description: Erro interno.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: 'Não autorizado', debug: process.env.AI_API_KEY }, { status: 401 })

  try { const apiUrl = process.env.EVOLUTION_API_URL
    const apiKey = process.env.EVOLUTION_API_KEY

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Evolution API credentials missing' }, { status: 500 })
    }

    const res = await fetch(`${apiUrl}/instance/all`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch instances' }, { status: res.status })
    }

    const data = await res.json()
    // Data is usually an array of instances
    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro ao buscar instancias:", error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
